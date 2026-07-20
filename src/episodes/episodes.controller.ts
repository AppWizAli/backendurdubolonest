import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentPrincipal } from '../common/auth/current-principal.decorator';
import { AuthenticatedPrincipal } from '../common/auth/auth.types';
import { Permissions } from '../common/auth/permissions.decorator';
import { Public } from '../common/auth/public.decorator';
import { BulkIdsDto, EpisodeListQueryDto } from '../content/dto/content-query.dto';
import { CreateEpisodeDto, UpdateEpisodeDto } from './dto/episode.dto';
import { EpisodesService } from './episodes.service';

@ApiTags('Episodes') @ApiBearerAuth() @Controller('api/v1/episodes')
export class EpisodesController {
  constructor(private readonly episodes: EpisodesService) {}
  @Public() @Get() list(@Query() q: EpisodeListQueryDto, @CurrentPrincipal() p?: AuthenticatedPrincipal) { return this.episodes.list(q, p); }
  @Public() @Get(':id') details(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p?: AuthenticatedPrincipal) { return this.episodes.details(id, p); }
  @Post() @Permissions('content.write') create(@Body() d: CreateEpisodeDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.episodes.create(d, p, r.requestId!); }
  @Patch(':id') @Permissions('content.write') update(@Param('id', ParseUUIDPipe) id: string, @Body() d: UpdateEpisodeDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.episodes.update(id, d, p, r.requestId!); }
  @Delete(':id') @Permissions('content.write') remove(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.episodes.remove(id, p, r.requestId!); }
  @Post(':id/restore') @Permissions('content.write') restore(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.episodes.restore(id, p, r.requestId!); }
  @Post(':id/publish') @Permissions('content.write') publish(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.episodes.publish(id, true, p, r.requestId!); }
  @Post(':id/unpublish') @Permissions('content.write') unpublish(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.episodes.publish(id, false, p, r.requestId!); }
  @Post('bulk/publish') @Permissions('content.write') bulkPublish(@Body() d: BulkIdsDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.episodes.bulk(d, 'publish', p, r.requestId!); }
  @Post('bulk/unpublish') @Permissions('content.write') bulkUnpublish(@Body() d: BulkIdsDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.episodes.bulk(d, 'unpublish', p, r.requestId!); }
  @Post('bulk/delete') @Permissions('content.write') bulkDelete(@Body() d: BulkIdsDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.episodes.bulk(d, 'delete', p, r.requestId!); }
  @Post('bulk/restore') @Permissions('content.write') bulkRestore(@Body() d: BulkIdsDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.episodes.bulk(d, 'restore', p, r.requestId!); }
}
