import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { CurrentPrincipal } from '../common/auth/current-principal.decorator';
import { AuthenticatedPrincipal } from '../common/auth/auth.types';
import { Permissions } from '../common/auth/permissions.decorator';
import { Public } from '../common/auth/public.decorator';
import { RateLimit } from '../common/security/rate-limit.decorator';
import {
  AccountDeletionRequestDto, AdminRoleDto, AssignTrendingDto, CreateAdminDto, CreateBannerDto, CreateCommentDto, CreateNotificationDto, CreateReleaseDto, CreateSubscriptionRequestDto, LegacyListDto, MarkMessageDto, MessageListDto, MobileSupportMessageDto, RecordViewDto, RemoteConfigDto, ReviewAccountDeletionRequestDto, ReviewSubscriptionRequestDto, SearchDto, SecurityBlockDto, SecurityIncidentDto, SendAdminNotificationDto, SendGroupMessageDto, SendMessageDto, SubscriptionSettingsDto, UpdateBannerDto, UpdateCommentDto, UpdateNotificationDto, UpdateReleaseDto, UpdateTrendingDto,
} from './legacy.dto';
import { LegacyService } from './legacy.service';

@ApiTags('Legacy Business Parity')
@ApiBearerAuth()
@Controller('api/v1')
export class LegacyController {
  constructor(private readonly legacy: LegacyService) {}

  @Get('admins') @Permissions('users.read') listAdmins(@Query() query: LegacyListDto) { return this.legacy.listAdmins(query); }
  @Post('admins') @Permissions('users.write') createAdmin(@Body() dto: CreateAdminDto, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.createAdmin(dto, actor, request.requestId!); }
  @Post('admins/:userId/roles') @Permissions('roles.write') assignAdminRole(@Param('userId', ParseUUIDPipe) userId: string, @Body() dto: AdminRoleDto, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.assignAdminRole(userId, dto, actor, request.requestId!); }
  @Delete('admins/:userId/roles') @Permissions('roles.write') removeAdminRole(@Param('userId', ParseUUIDPipe) userId: string, @Body() dto: AdminRoleDto, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.removeAdminRole(userId, dto, actor, request.requestId!); }

  @Public() @Get('notifications/latest') @ApiOperation({ summary: 'Get the newest public notification' }) latestNotification() { return this.legacy.latestNotification(); }
  @Get('notifications') @Permissions('notifications.read') listNotifications(@Query() query: LegacyListDto) { return this.legacy.listNotifications(query); }
  @Post('notifications') @Permissions('notifications.write') createNotification(@Body() dto: CreateNotificationDto, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.createNotification(dto, actor, request.requestId!); }
  @Patch('notifications/:id') @Permissions('notifications.write') updateNotification(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateNotificationDto, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.updateNotification(id, dto, actor, request.requestId!); }
  @Delete('notifications/:id') @Permissions('notifications.write') deleteNotification(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.deleteNotification(id, actor, request.requestId!); }
  @Post('notifications/:id/send') @Permissions('notifications.send') sendNotification(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.sendNotification(id, actor, request.requestId!); }
  @Post('notifications/:id/read') markNotificationRead(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() actor: AuthenticatedPrincipal) { return this.legacy.markNotificationRead(id, actor); }
  @Get('mobile/notifications') listMobileNotifications(@Query() query: LegacyListDto, @CurrentPrincipal() actor: AuthenticatedPrincipal) { return this.legacy.listMobileNotifications(actor, query); }

  @Get('favorites') listFavorites(@CurrentPrincipal() actor: AuthenticatedPrincipal) { return this.legacy.listFavorites(actor); }
  @Post('favorites/:dramaId') addFavorite(@Param('dramaId', ParseUUIDPipe) dramaId: string, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.addFavorite(dramaId, actor, request.requestId!); }
  @Delete('favorites/:dramaId') removeFavorite(@Param('dramaId', ParseUUIDPipe) dramaId: string, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.removeFavorite(dramaId, actor, request.requestId!); }

  @Get('messages') listMessages(@Query() query: MessageListDto, @CurrentPrincipal() actor: AuthenticatedPrincipal) { return this.legacy.listMessages(actor, query); }
  @Post('messages/read') markMessagesRead(@Body() dto: MarkMessageDto, @CurrentPrincipal() actor: AuthenticatedPrincipal) { return this.legacy.markMessagesRead(actor, dto); }
  @Post('messages') @Permissions('messages.write') sendMessage(@Body() dto: SendMessageDto, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.sendMessage(dto, actor, request.requestId!); }
  @Post('messages/groups') @Permissions('messages.write') sendGroupMessage(@Body() dto: SendGroupMessageDto, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.sendGroupMessage(dto, actor, request.requestId!); }
  @Post('messages/admin-notification') @Permissions('notifications.send') sendAdminNotification(@Body() dto: SendAdminNotificationDto, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.sendAdminNotification(dto.message, actor, request.requestId!); }
  @Post('mobile/support/messages') @RateLimit({ limit: 12, windowSeconds: 300, scope: 'mobile-support' }) sendMobileSupportMessage(@Body() dto: MobileSupportMessageDto, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.sendMobileSupportMessage(dto.message, actor, request.requestId!); }
  @Post('account/deletion-requests') @RateLimit({ limit: 3, windowSeconds: 86400, scope: 'account-deletion' }) requestAccountDeletion(@Body() dto: AccountDeletionRequestDto, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.requestAccountDeletion(dto, actor, request.requestId!); }
  @Get('account/deletion-requests') listOwnAccountDeletionRequests(@CurrentPrincipal() actor: AuthenticatedPrincipal) { return this.legacy.listOwnAccountDeletionRequests(actor); }
  @Get('admin/account-deletion-requests') @Permissions('users.write') listAccountDeletionRequests(@Query() query: LegacyListDto) { return this.legacy.listAccountDeletionRequests(query); }
  @Patch('admin/account-deletion-requests/:id') @Permissions('users.write') reviewAccountDeletionRequest(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewAccountDeletionRequestDto, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.reviewAccountDeletionRequest(id, dto, actor, request.requestId!); }

  @Public() @Get('banners') @ApiOperation({ summary: 'List active banners' }) listPublicBanners() { return this.legacy.listBanners(); }
  @Get('admin/banners') @Permissions('banners.read') listAdminBanners() { return this.legacy.listBanners(true); }
  @Post('banners') @Permissions('banners.write') createBanner(@Body() dto: CreateBannerDto, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.createBanner(dto, actor, request.requestId!); }
  @Patch('banners/:id') @Permissions('banners.write') updateBanner(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBannerDto, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.updateBanner(id, dto, actor, request.requestId!); }
  @Delete('banners/:id') @Permissions('banners.write') deleteBanner(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.deleteBanner(id, actor, request.requestId!); }

  @Public() @Get('trending') @ApiOperation({ summary: 'List trending dramas' }) listTrending() { return this.legacy.listTrending(); }
  @Get('admin/trending') @Permissions('trending.read') listAdminTrending() { return this.legacy.listTrending(); }
  @Post('trending') @Permissions('trending.write') assignTrending(@Body() dto: AssignTrendingDto, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.assignTrending(dto, actor, request.requestId!); }
  @Patch('trending/:id') @Permissions('trending.write') updateTrending(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTrendingDto, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.updateTrending(id, dto, actor, request.requestId!); }
  @Delete('trending/:id') @Permissions('trending.write') deleteTrending(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.deleteTrending(id, actor, request.requestId!); }

  @Public() @Get('app/releases/latest') @ApiOperation({ summary: 'Get the active app release metadata' }) latestRelease() { return this.legacy.latestRelease(); }
  @Get('app/releases/:id/download') @ApiOperation({ summary: 'Download an active app release through the allowlisted provider proxy' }) async downloadRelease(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request, @Res() response: Response) { const result = await this.legacy.downloadRelease(id, request.get('range')); response.status(result.response.status).setHeader('content-type', result.response.headers.get('content-type') ?? 'application/vnd.android.package-archive'); const length = result.response.headers.get('content-length'); const range = result.response.headers.get('content-range'); if (length) response.setHeader('content-length', length); if (range) response.setHeader('content-range', range); response.setHeader('accept-ranges', result.response.headers.get('accept-ranges') ?? 'bytes'); if (result.originalName) response.setHeader('content-disposition', `attachment; filename="${result.originalName.replace(/[^A-Za-z0-9._-]/g, '_')}"`); if (!result.response.body) return response.end(); return Readable.fromWeb(result.response.body as any).pipe(response); }
  @Get('app/releases') @Permissions('app.release.read') listReleases(@Query() query: LegacyListDto) { return this.legacy.listReleases(query); }
  @Post('app/releases') @Permissions('app.release.write') createRelease(@Body() dto: CreateReleaseDto, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.createRelease(dto, actor, request.requestId!); }
  @Patch('app/releases/:id') @Permissions('app.release.write') updateRelease(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateReleaseDto, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.updateRelease(id, dto, actor, request.requestId!); }
  @Delete('app/releases/:id') @Permissions('app.release.write') deleteRelease(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.deleteRelease(id, actor, request.requestId!); }

  @Public() @Get('remote-config') @ApiOperation({ summary: 'Get active mobile remote configuration' }) getRemoteConfig() { return this.legacy.getRemoteConfig(); }
  @Get('admin/remote-config') @Permissions('settings.read') listRemoteConfig() { return this.legacy.listRemoteConfig(); }
  @Put('admin/remote-config') @Permissions('settings.write') upsertRemoteConfig(@Body() dto: RemoteConfigDto, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.upsertRemoteConfig(dto, actor, request.requestId!); }

  @Public() @Get('subscription/settings') getSubscriptionSettings() { return this.legacy.getSubscriptionSettings(); }
  @Get('subscription/requests') listSubscriptionRequests(@Query() query: LegacyListDto, @CurrentPrincipal() actor: AuthenticatedPrincipal) { return this.legacy.listSubscriptionRequests(query, actor); }
  @Post('subscription/requests') createSubscriptionRequest(@Body() dto: CreateSubscriptionRequestDto, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.createSubscriptionRequest(dto, actor, request.requestId!); }
  @Patch('subscription/requests/:id') @Permissions('subscriptions.write') reviewSubscriptionRequest(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewSubscriptionRequestDto, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.reviewSubscriptionRequest(id, dto, actor, request.requestId!); }
  @Patch('subscription/settings') @Permissions('settings.write') updateSubscriptionSettings(@Body() dto: SubscriptionSettingsDto, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.updateSubscriptionSettings(dto, actor, request.requestId!); }

  @Get('security/block-status') getSecurityBlock(@CurrentPrincipal() actor: AuthenticatedPrincipal) { return this.legacy.getSecurityBlock(actor); }
  @Patch('admin/users/:userId/security-block') @Permissions('users.status') setSecurityBlock(@Param('userId', ParseUUIDPipe) userId: string, @Body() dto: SecurityBlockDto, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.setSecurityBlock(userId, dto, actor, request.requestId!); }
  @Post('security/incidents') reportIncident(@Body() dto: SecurityIncidentDto, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.reportIncident(dto, actor, request, request.requestId!); }
  @Get('security/incidents') @Permissions('security.read') listIncidents(@Query() query: LegacyListDto) { return this.legacy.listIncidents(query); }
  @Delete('security/incidents/:id') @Permissions('security.write') deleteIncident(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.deleteIncident(id, actor, request.requestId!); }

  @Get('episodes/:episodeId/comments') listComments(@Param('episodeId', ParseUUIDPipe) episodeId: string, @Query() query: LegacyListDto) { return this.legacy.listComments(episodeId, query); }
  @Post('comments') createComment(@Body() dto: CreateCommentDto, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.createComment(dto, actor, request.requestId!); }
  @Patch('comments/:id') updateComment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCommentDto, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.updateComment(id, dto, actor, request.requestId!); }
  @Delete('comments/:id') deleteComment(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.deleteComment(id, actor, request.requestId!); }

  @Post('analytics/views') recordView(@Body() dto: RecordViewDto, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.legacy.recordView(dto, actor, request); }
  @Get('analytics/views') @Permissions('analytics.read') analytics(@Query() query: LegacyListDto) { return this.legacy.analytics(query); }
  @Get('reports/dashboard') @Permissions('reports.read') dashboard() { return this.legacy.dashboard(); }
  @Get('search') search(@Query() query: SearchDto, @CurrentPrincipal() actor: AuthenticatedPrincipal) { return this.legacy.search(query, actor); }
}
