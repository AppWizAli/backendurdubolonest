import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RoleCode, SupportConversationStatus, SupportMessageSenderType, SupportMessageStatus, SupportMessageType, UserStatus } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedPrincipal } from '../common/auth/auth.types';
import { AuditService } from '../common/audit/audit.service';
import { SupportConversationQueryDto, SupportMessageQueryDto } from './dto/support-chat.dto';

const WELCOME_TEXT = 'Welcome to Urdu Bolo Support.\nHow can we help you today?';

@Injectable()
export class SupportChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async principalFromToken(token: string): Promise<AuthenticatedPrincipal | null> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; sid: string }>(token, {
        publicKey: Buffer.from(this.config.getOrThrow<string>('JWT_PUBLIC_KEY_B64'), 'base64').toString('utf8'),
        algorithms: ['RS256'],
        issuer: this.config.getOrThrow<string>('JWT_ISSUER'),
        audience: this.config.getOrThrow<string>('JWT_AUDIENCE'),
      });
      const session = await this.prisma.refreshSession.findFirst({
        where: { id: payload.sid, userId: payload.sub, revokedAt: null, expiresAt: { gt: new Date() }, user: { deletedAt: null } },
        select: {
          user: {
            select: {
              id: true,
              status: true,
              roles: { select: { role: { select: { code: true, permissions: { select: { permission: { select: { code: true } } } } } } } },
              permissions: { where: { granted: true }, select: { permission: { select: { code: true } } } },
            },
          },
        },
      });
      if (!session || session.user.status !== UserStatus.ACTIVE) return null;
      const permissions = new Set<string>();
      for (const role of session.user.roles) for (const item of role.role.permissions) permissions.add(item.permission.code);
      for (const item of session.user.permissions) permissions.add(item.permission.code);
      return { id: session.user.id, sessionId: payload.sid, roles: session.user.roles.map((item) => item.role.code) as RoleCode[], permissions: [...permissions], status: session.user.status };
    } catch {
      return null;
    }
  }

  isStaff(actor: AuthenticatedPrincipal) {
    return actor.roles.includes(RoleCode.SUPER_ADMIN) || actor.roles.includes(RoleCode.ADMIN) || actor.roles.includes(RoleCode.SUB_ADMIN) || actor.roles.includes(RoleCode.MODERATOR) || actor.permissions.includes('messages.read');
  }

  async ensureConversationForUser(userId: string) {
    const existing = await this.prisma.supportConversation.findFirst({ where: { userId, deletedAt: null }, include: this.conversationInclude() });
    if (existing) return existing;
    return this.prisma.$transaction(async (tx) => {
      const conversation = await tx.supportConversation.create({ data: { userId, status: SupportConversationStatus.OPEN } });
      const message = await tx.supportMessage.create({
        data: {
          conversationId: conversation.id,
          senderType: SupportMessageSenderType.SYSTEM,
          messageType: SupportMessageType.SYSTEM,
          text: WELCOME_TEXT,
          status: SupportMessageStatus.DELIVERED,
          deliveredAt: new Date(),
        },
      });
      return tx.supportConversation.update({
        where: { id: conversation.id },
        data: { lastMessageId: message.id, lastMessageAt: message.createdAt },
        include: this.conversationInclude(),
      });
    });
  }

  async getMyConversation(actor: AuthenticatedPrincipal) {
    const conversation = await this.ensureConversationForUser(actor.id);
    return this.presentConversation(conversation);
  }

  async listMyMessages(actor: AuthenticatedPrincipal, query: SupportMessageQueryDto) {
    const conversation = await this.ensureConversationForUser(actor.id);
    return this.listConversationMessages(conversation.id, actor, query);
  }

  async listConversations(actor: AuthenticatedPrincipal, query: SupportConversationQueryDto) {
    this.assertStaff(actor);
    const where: Prisma.SupportConversationWhereInput = {
      deletedAt: null,
      ...(query.status === 'UNREAD' ? { adminUnreadCount: { gt: 0 } } : query.status ? { status: query.status } : {}),
      ...(query.search ? {
        user: {
          OR: [
            { username: { contains: query.search.trim(), mode: 'insensitive' } },
            { email: { contains: query.search.trim().toLowerCase(), mode: 'insensitive' } },
          ],
        },
      } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.supportConversation.findMany({
        where,
        include: this.conversationInclude(),
        orderBy: { lastMessageAt: query.sort === 'oldest' ? 'asc' : 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.supportConversation.count({ where }),
    ]);
    return { items: items.map((item) => this.presentConversation(item)), page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) };
  }

  async stats(actor: AuthenticatedPrincipal) {
    this.assertStaff(actor);
    const [total, unread, waiting, resolved, blocked] = await this.prisma.$transaction([
      this.prisma.supportConversation.count({ where: { deletedAt: null } }),
      this.prisma.supportConversation.count({ where: { deletedAt: null, adminUnreadCount: { gt: 0 } } }),
      this.prisma.supportConversation.count({ where: { deletedAt: null, status: SupportConversationStatus.WAITING } }),
      this.prisma.supportConversation.count({ where: { deletedAt: null, status: SupportConversationStatus.RESOLVED } }),
      this.prisma.supportConversation.count({ where: { deletedAt: null, status: SupportConversationStatus.BLOCKED } }),
    ]);
    return { total, unread, waiting, resolved, blocked };
  }

  async listConversationMessages(conversationId: string, actor: AuthenticatedPrincipal, query: SupportMessageQueryDto) {
    const conversation = await this.requireConversation(conversationId, actor);
    const visibleWhere = this.isStaff(actor) ? { deletedByAdmin: false } : { deletedByUser: false };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.supportMessage.findMany({
        where: { conversationId: conversation.id, ...visibleWhere },
        include: { sender: { select: { id: true, username: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.supportMessage.count({ where: { conversationId: conversation.id, ...visibleWhere } }),
    ]);
    return { items: items.reverse().map((item) => this.presentMessage(item)), page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) };
  }

  async sendUserMessage(actor: AuthenticatedPrincipal, text: string, requestId?: string) {
    const conversation = await this.ensureConversationForUser(actor.id);
    const message = await this.createMessage(conversation.id, actor, SupportMessageSenderType.USER, text);
    if (requestId) await this.audit.write({ actorId: actor.id, action: 'support.message_user_create', resource: 'support_conversation', resourceId: conversation.id, outcome: 'SUCCESS', requestId });
    return message;
  }

  async sendAdminMessage(conversationId: string, actor: AuthenticatedPrincipal, text: string, requestId?: string) {
    this.assertStaff(actor);
    const conversation = await this.requireConversation(conversationId, actor);
    const message = await this.createMessage(conversation.id, actor, SupportMessageSenderType.ADMIN, text);
    if (requestId) await this.audit.write({ actorId: actor.id, action: 'support.message_admin_create', resource: 'support_conversation', resourceId: conversation.id, outcome: 'SUCCESS', requestId });
    return message;
  }

  async markSeen(conversationId: string, actor: AuthenticatedPrincipal) {
    const conversation = await this.requireConversation(conversationId, actor);
    const now = new Date();
    const seenSenderType = this.isStaff(actor) ? SupportMessageSenderType.USER : SupportMessageSenderType.ADMIN;
    await this.prisma.$transaction([
      this.prisma.supportMessage.updateMany({ where: { conversationId: conversation.id, senderType: seenSenderType, status: { not: SupportMessageStatus.SEEN } }, data: { status: SupportMessageStatus.SEEN, seenAt: now } }),
      this.prisma.supportConversation.update({ where: { id: conversation.id }, data: this.isStaff(actor) ? { adminUnreadCount: 0, adminLastSeenAt: now } : { userUnreadCount: 0, userLastSeenAt: now } }),
    ]);
    return { success: true, conversationId: conversation.id, seenAt: now };
  }

  async updateStatus(conversationId: string, actor: AuthenticatedPrincipal, status: SupportConversationStatus) {
    this.assertStaff(actor);
    const conversation = await this.requireConversation(conversationId, actor);
    const updated = await this.prisma.supportConversation.update({ where: { id: conversation.id }, data: { status, assignedAdminId: actor.id }, include: this.conversationInclude() });
    return this.presentConversation(updated);
  }

  async deleteMessage(messageId: string, actor: AuthenticatedPrincipal) {
    const message = await this.prisma.supportMessage.findUnique({ where: { id: messageId }, include: { conversation: true } });
    if (!message) throw new NotFoundException('Message not found');
    await this.requireConversation(message.conversationId, actor);
    const item = await this.prisma.supportMessage.update({ where: { id: messageId }, data: this.isStaff(actor) ? { deletedByAdmin: true } : { deletedByUser: true }, include: { sender: { select: { id: true, username: true, email: true } } } });
    return this.presentMessage(item);
  }

  private async createMessage(conversationId: string, actor: AuthenticatedPrincipal, senderType: SupportMessageSenderType, text: string) {
    const now = new Date();
    const message = await this.prisma.$transaction(async (tx) => {
      const item = await tx.supportMessage.create({
        data: {
          conversationId,
          senderType,
          senderId: actor.id,
          messageType: SupportMessageType.TEXT,
          text: text.trim(),
          status: SupportMessageStatus.DELIVERED,
          deliveredAt: now,
        },
        include: { sender: { select: { id: true, username: true, email: true } } },
      });
      await tx.supportConversation.update({
        where: { id: conversationId },
        data: {
          assignedAdminId: senderType === SupportMessageSenderType.ADMIN ? actor.id : undefined,
          status: senderType === SupportMessageSenderType.USER ? SupportConversationStatus.WAITING : SupportConversationStatus.OPEN,
          lastMessageId: item.id,
          lastMessageAt: item.createdAt,
          adminUnreadCount: senderType === SupportMessageSenderType.USER ? { increment: 1 } : undefined,
          userUnreadCount: senderType === SupportMessageSenderType.ADMIN ? { increment: 1 } : undefined,
        },
      });
      return item;
    });
    return this.presentMessage(message);
  }

  private async requireConversation(conversationId: string, actor: AuthenticatedPrincipal) {
    const conversation = await this.prisma.supportConversation.findFirst({ where: { id: conversationId, deletedAt: null }, include: this.conversationInclude() });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (!this.isStaff(actor) && conversation.userId !== actor.id) throw new ForbiddenException('Conversation is not available');
    return conversation;
  }

  private assertStaff(actor: AuthenticatedPrincipal) {
    if (!this.isStaff(actor)) throw new ForbiddenException('Support chat inbox is not available');
  }

  private conversationInclude() {
    return {
      user: { select: { id: true, username: true, email: true, profileImageKey: true, lastLoginAt: true } },
      assignedAdmin: { select: { id: true, username: true, email: true } },
      messages: { orderBy: { createdAt: 'desc' as const }, take: 1, select: { id: true, text: true, messageType: true, senderType: true, createdAt: true } },
    };
  }

  private presentConversation(conversation: any) {
    const last = conversation.messages?.[0] ?? null;
    return {
      id: conversation.id,
      userId: conversation.userId,
      assignedAdminId: conversation.assignedAdminId,
      status: conversation.status,
      lastMessageId: conversation.lastMessageId,
      lastMessageAt: conversation.lastMessageAt,
      userUnreadCount: conversation.userUnreadCount,
      adminUnreadCount: conversation.adminUnreadCount,
      userLastSeenAt: conversation.userLastSeenAt,
      adminLastSeenAt: conversation.adminLastSeenAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      user: conversation.user,
      assignedAdmin: conversation.assignedAdmin,
      lastMessage: last ? { id: last.id, text: last.text, messageType: last.messageType, senderType: last.senderType, createdAt: last.createdAt } : null,
    };
  }

  private presentMessage(message: any) {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderType: message.senderType,
      senderId: message.senderId,
      messageType: message.messageType,
      text: message.text,
      mediaUrl: message.mediaUrl,
      thumbnail: message.thumbnail,
      voiceDuration: message.voiceDuration,
      fileSize: message.fileSize ? message.fileSize.toString() : null,
      mimeType: message.mimeType,
      replyToMessageId: message.replyToMessageId,
      status: message.status,
      deliveredAt: message.deliveredAt,
      seenAt: message.seenAt,
      deletedByUser: message.deletedByUser,
      deletedByAdmin: message.deletedByAdmin,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      sender: message.sender,
    };
  }
}
