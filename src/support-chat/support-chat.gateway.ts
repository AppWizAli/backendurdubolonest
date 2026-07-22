import { Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthenticatedPrincipal } from '../common/auth/auth.types';
import { SupportChatService } from './support-chat.service';

type AuthedSocket = Socket & { data: { principal?: AuthenticatedPrincipal; roomsJoined?: Set<string> } };

@WebSocketGateway({
  namespace: '/support-chat',
  cors: { origin: true, credentials: true },
})
export class SupportChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(SupportChatGateway.name);
  private readonly onlineUsers = new Map<string, number>();

  constructor(private readonly support: SupportChatService) {}

  async handleConnection(client: AuthedSocket) {
    const token = this.extractToken(client);
    const principal = token ? await this.support.principalFromToken(token) : null;
    if (!principal) {
      client.emit('unauthorized', { message: 'Authentication is required' });
      client.disconnect(true);
      return;
    }
    client.data.principal = principal;
    client.data.roomsJoined = new Set();
    this.trackOnline(principal.id, 1);
    client.join(`user:${principal.id}`);
    if (this.support.isStaff(principal)) client.join('support:admins');
    this.server.emit('user_connected', { userId: principal.id });
  }

  handleDisconnect(client: AuthedSocket) {
    const principal = client.data.principal;
    if (!principal) return;
    this.trackOnline(principal.id, -1);
    if (!this.onlineUsers.has(principal.id)) this.server.emit('user_disconnected', { userId: principal.id, lastSeenAt: new Date() });
  }

  @SubscribeMessage('support:join')
  async join(@ConnectedSocket() client: AuthedSocket, @MessageBody() payload?: { conversationId?: string }) {
    const principal = this.requirePrincipal(client);
    const conversation = payload?.conversationId
      ? await this.support.listConversationMessages(payload.conversationId, principal, { page: 1, limit: 1 })
      : await this.support.getMyConversation(principal);
    const conversationId = payload?.conversationId ?? (conversation as any).id;
    client.join(`support:${conversationId}`);
    client.data.roomsJoined?.add(`support:${conversationId}`);
    client.emit('support:joined', { conversationId, onlineUsers: [...this.onlineUsers.keys()] });
    return { conversationId };
  }

  @SubscribeMessage('support:message')
  async sendMessage(@ConnectedSocket() client: AuthedSocket, @MessageBody() payload: { conversationId?: string; text?: string }) {
    const principal = this.requirePrincipal(client);
    const text = payload?.text?.trim();
    if (!text) return { error: 'Message is required' };
    const message = this.support.isStaff(principal) && payload.conversationId
      ? await this.support.sendAdminMessage(payload.conversationId, principal, text)
      : await this.support.sendUserMessage(principal, text);
    this.emitMessage(message.conversationId, message);
    this.emitConversationUpdated(message.conversationId);
    return message;
  }

  @SubscribeMessage('typing')
  typing(@ConnectedSocket() client: AuthedSocket, @MessageBody() payload: { conversationId: string }) {
    const principal = this.requirePrincipal(client);
    client.to(`support:${payload.conversationId}`).emit('typing', { conversationId: payload.conversationId, userId: principal.id });
    return { success: true };
  }

  @SubscribeMessage('stop_typing')
  stopTyping(@ConnectedSocket() client: AuthedSocket, @MessageBody() payload: { conversationId: string }) {
    const principal = this.requirePrincipal(client);
    client.to(`support:${payload.conversationId}`).emit('stop_typing', { conversationId: payload.conversationId, userId: principal.id });
    return { success: true };
  }

  @SubscribeMessage('message_seen')
  async seen(@ConnectedSocket() client: AuthedSocket, @MessageBody() payload: { conversationId: string }) {
    const principal = this.requirePrincipal(client);
    const result = await this.support.markSeen(payload.conversationId, principal);
    this.emitSeen(payload.conversationId, principal.id, result.seenAt);
    return result;
  }

  emitMessage(conversationId: string, message: unknown) {
    this.server?.to(`support:${conversationId}`).emit('message_received', message);
    this.server?.to('support:admins').emit('message_received', message);
  }

  emitConversationUpdated(conversationId: string, conversation?: unknown) {
    this.server?.to(`support:${conversationId}`).emit('conversation_updated', { conversationId, conversation });
    this.server?.to('support:admins').emit('conversation_updated', { conversationId, conversation });
  }

  emitSeen(conversationId: string, userId: string, seenAt: Date) {
    this.server?.to(`support:${conversationId}`).emit('message_seen', { conversationId, userId, seenAt });
    this.server?.to('support:admins').emit('message_seen', { conversationId, userId, seenAt });
  }

  emitDeleted(conversationId: string, message: unknown) {
    this.server?.to(`support:${conversationId}`).emit('message_deleted', message);
    this.server?.to('support:admins').emit('message_deleted', message);
  }

  private extractToken(client: Socket) {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) return authToken.trim();
    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
    return null;
  }

  private requirePrincipal(client: AuthedSocket) {
    const principal = client.data.principal;
    if (!principal) {
      this.logger.warn('Socket message received without authenticated principal');
      client.disconnect(true);
      throw new Error('Unauthorized');
    }
    return principal;
  }

  private trackOnline(userId: string, delta: 1 | -1) {
    const next = Math.max(0, (this.onlineUsers.get(userId) ?? 0) + delta);
    if (next === 0) this.onlineUsers.delete(userId);
    else this.onlineUsers.set(userId, next);
  }
}
