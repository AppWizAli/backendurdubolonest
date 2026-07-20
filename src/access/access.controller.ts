import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentPrincipal } from '../common/auth/current-principal.decorator';
import { AuthenticatedPrincipal } from '../common/auth/auth.types';
import { Permissions } from '../common/auth/permissions.decorator';
import { AccessListDto, BulkDirectGrantDto, BulkGroupGrantDto, CreateGroupDto, DirectGrantDto, GroupGrantDto, GroupMemberDto, UpdateGroupDto } from './dto/access.dto';
import { AccessService } from './access.service';

@ApiTags('Access Control') @ApiBearerAuth() @Controller('api/v1/access')
export class AccessController {
  constructor(private readonly access: AccessService) {}
  @Get('groups') @Permissions('access.read') groups() { return this.access.listGroups(); }
  @Get('groups/:groupId/members') @Permissions('access.read') members(@Param('groupId', ParseUUIDPipe) groupId: string, @Query() q: AccessListDto) { return this.access.listMembers(groupId, q); }
  @Post('groups') @Permissions('access.write') createGroup(@Body() d: CreateGroupDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.access.createGroup(d, p, r.requestId!); }
  @Patch('groups/:id') @Permissions('access.write') updateGroup(@Param('id', ParseUUIDPipe) id: string, @Body() d: UpdateGroupDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.access.updateGroup(id, d, p, r.requestId!); }
  @Delete('groups/:id') @Permissions('access.write') deleteGroup(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.access.deleteGroup(id, p, r.requestId!); }
  @Post('groups/:groupId/members') @Permissions('access.write') addMember(@Param('groupId', ParseUUIDPipe) id: string, @Body() d: GroupMemberDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.access.addMember(id, d, p, r.requestId!); }
  @Delete('groups/:groupId/members/:userId') @Permissions('access.write') removeMember(@Param('groupId', ParseUUIDPipe) gid: string, @Param('userId', ParseUUIDPipe) uid: string, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.access.removeMember(gid, uid, p, r.requestId!); }
  @Post('grants/direct') @Permissions('access.write') grantDirect(@Body() d: DirectGrantDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.access.grantDirect(d, p, r.requestId!); }
  @Post('grants/group') @Permissions('access.write') grantGroup(@Body() d: GroupGrantDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.access.grantGroup(d, p, r.requestId!); }
  @Post('grants/direct/bulk') @Permissions('access.write') grantDirectBulk(@Body() d: BulkDirectGrantDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.access.grantDirectBulk(d, p, r.requestId!); }
  @Post('grants/group/bulk') @Permissions('access.write') grantGroupBulk(@Body() d: BulkGroupGrantDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.access.grantGroupBulk(d, p, r.requestId!); }
  @Get('grants') @Permissions('access.read') grants(@Query() q: AccessListDto) { return this.access.listGrants(q); }
  @Get('grants/:id/history') @Permissions('access.read') grantHistory(@Param('id', ParseUUIDPipe) id: string) { return this.access.history(id); }
  @Delete('grants/:id') @Permissions('access.write') revoke(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.access.revokeGrant(id, p, r.requestId!); }
  @Get('episodes/:episodeId/validate') validate(@Param('episodeId', ParseUUIDPipe) id: string, @CurrentPrincipal() p: AuthenticatedPrincipal) { return this.access.validate(id, p); }
  @Get('me/episodes') myUnlockedEpisodes(@Query() q: AccessListDto, @CurrentPrincipal() p: AuthenticatedPrincipal) { return this.access.listMyUnlockedEpisodes(p, q); }
}
