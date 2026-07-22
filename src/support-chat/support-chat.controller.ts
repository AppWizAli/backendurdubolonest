import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { SupportConversationStatus } from '@prisma/client';
import { CurrentPrincipal } from '../common/auth/current-principal.decorator';
import { AuthenticatedPrincipal } from '../common/auth/auth.types';
import { Permissions } from '../common/auth/permissions.decorator';
import { RateLimit } from '../common/security/rate-limit.decorator';
import { CreateSupportMessageDto, SupportConversationQueryDto, SupportMessageQueryDto, UpdateSupportConversationStatusDto } from './dto/support-chat.dto';
import { SupportChatGateway } from './support-chat.gateway';
import { SupportChatService } from './support-chat.service';
import { InitUploadDto, UploadChunkDto } from '../uploads/uploads.dto';
import { UploadsService } from '../uploads/uploads.service';

@ApiTags('Support Chat')
@ApiBearerAuth()
@Controller('api/v1/support')
export class SupportChatController {
  constructor(private readonly support: SupportChatService, private readonly gateway: SupportChatGateway, private readonly uploads: UploadsService) {}

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
    const message = await this.support.sendUserMessage(actor, dto, request.requestId!);
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
    const message = await this.support.sendAdminMessage(id, actor, dto, request.requestId!);
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

  @Post('conversation/me/uploads/init')
  initUpload(@Body() dto: InitUploadDto, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) {
    return this.uploads.init({ ...dto, purpose: 'support_attachment' }, actor, request.requestId!);
  }

  @Post('conversation/me/uploads/:id/chunks')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('chunk', { limits: { fileSize: 16 * 1024 * 1024 } }))
  uploadChunk(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UploadChunkDto, @UploadedFile() file: { buffer: Buffer; size: number }, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) {
    return this.uploads.chunk(id, dto.chunkIndex, file, actor, request.requestId!);
  }

  @Post('conversation/me/uploads/:id/complete')
  completeUpload(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) {
    return this.uploads.complete(id, actor, request.requestId!);
  }
}
