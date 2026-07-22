import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { SupportConversationStatus } from '@prisma/client';
import { CurrentPrincipal } from '../common/auth/current-principal.decorator';
import { AuthenticatedPrincipal } from '../common/auth/auth.types';
import { Permissions } from '../common/auth/permissions.decorator';
import { RateLimit } from '../common/security/rate-limit.decorator';
import { CreateSupportMessageDto, SupportConversationQueryDto, SupportMessageQueryDto, UpdateSupportConversationStatusDto } from './dto/support-chat.dto';
import { SupportChatGateway } from './support-chat.gateway';
import { SupportChatService } from './support-chat.service';

@ApiTags('Support Chat')
@ApiBearerAuth()
@Controller('api/v1/support')
export class SupportChatController {
  constructor(private readonly support: SupportChatService, private readonly gateway: SupportChatGateway) {}

  @Get('conversation/me')
  myConversation(@CurrentPrincipal() actor: AuthenticatedPrincipal) {
    return this.support.getMyConversation(actor);
  }

  @Get('conversation/me/messages')
  myMessages(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Query() query: SupportMessageQueryDto) {
    return this.support.listMyMessages(actor, query);
  }

  @Post('conversation/me/messages')
  @RateLimit({ limit: 30, windowSeconds: 300, scope: 'support-chat' })
  async sendMyMessage(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() dto: CreateSupportMessageDto, @Req() request: Request) {
    const message = await this.support.sendUserMessage(actor, dto.text, request.requestId!);
    this.gateway.emitMessage(message.conversationId, message);
    this.gateway.emitConversationUpdated(message.conversationId);
    return message;
  }

  @Post('conversations/:id/seen')
  async markSeen(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() actor: AuthenticatedPrincipal) {
    const result = await this.support.markSeen(id, actor);
    this.gateway.emitSeen(id, actor.id, result.seenAt);
    return result;
  }

  @Get('admin/stats')
  @Permissions('messages.read')
  stats(@CurrentPrincipal() actor: AuthenticatedPrincipal) {
    return this.support.stats(actor);
  }

  @Get('admin/conversations')
  @Permissions('messages.read')
  conversations(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Query() query: SupportConversationQueryDto) {
    return this.support.listConversations(actor, query);
  }

  @Get('admin/conversations/:id/messages')
  @Permissions('messages.read')
  adminMessages(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Query() query: SupportMessageQueryDto) {
    return this.support.listConversationMessages(id, actor, query);
  }

  @Post('admin/conversations/:id/messages')
  @Permissions('messages.write')
  async sendAdminMessage(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() dto: CreateSupportMessageDto, @Req() request: Request) {
    const message = await this.support.sendAdminMessage(id, actor, dto.text, request.requestId!);
    this.gateway.emitMessage(id, message);
    this.gateway.emitConversationUpdated(id);
    return message;
  }

  @Patch('admin/conversations/:id/status')
  @Permissions('messages.write')
  async updateStatus(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() dto: UpdateSupportConversationStatusDto) {
    const conversation = await this.support.updateStatus(id, actor, dto.status as SupportConversationStatus);
    this.gateway.emitConversationUpdated(id, conversation);
    return conversation;
  }

  @Delete('messages/:id')
  async deleteMessage(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() actor: AuthenticatedPrincipal) {
    const message = await this.support.deleteMessage(id, actor);
    this.gateway.emitDeleted(message.conversationId, message);
    return message;
  }
}
