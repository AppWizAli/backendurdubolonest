import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentPrincipal } from '../common/auth/current-principal.decorator';
import { AuthenticatedPrincipal } from '../common/auth/auth.types';
import { Permissions } from '../common/auth/permissions.decorator';
import { Public } from '../common/auth/public.decorator';
import { RateLimit } from '../common/security/rate-limit.decorator';
import { BulkIdsDto, DramaListQueryDto } from '../content/dto/content-query.dto';
import { CreateDramaDto, UpdateDramaDto } from './dto/drama.dto';
import { DramasService } from './dramas.service';

@ApiTags('Dramas') @ApiBearerAuth() @Controller('api/v1/dramas')
export class DramasController {
  constructor(private readonly dramas: DramasService) {}
  @Public() @Get() @ApiOperation({ summary: 'List visible dramas' }) list(@Query() q: DramaListQueryDto, @CurrentPrincipal() p?: AuthenticatedPrincipal) { return this.dramas.list(q, p); }
  @Public() @Get(':id') details(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p?: AuthenticatedPrincipal) { return this.dramas.details(id, p); }
  @Post() @Permissions('content.write') create(@Body() d: CreateDramaDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.dramas.create(d, p, r.requestId!); }
  @Patch(':id') @Permissions('content.write') update(@Param('id', ParseUUIDPipe) id: string, @Body() d: UpdateDramaDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.dramas.update(id, d, p, r.requestId!); }
  @Delete(':id') @Permissions('content.write') remove(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.dramas.remove(id, p, r.requestId!); }
  @Post(':id/restore') @Permissions('content.write') restore(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.dramas.restore(id, p, r.requestId!); }
  @Post(':id/publish') @Permissions('content.write') publish(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.dramas.publish(id, true, p, r.requestId!); }
  @Post(':id/unpublish') @Permissions('content.write') unpublish(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.dramas.publish(id, false, p, r.requestId!); }
  @Post('bulk/publish') @Permissions('content.write') @RateLimit({ limit: 20, windowSeconds: 60, scope: 'content-bulk' }) bulkPublish(@Body() d: BulkIdsDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.dramas.bulk(d, 'publish', p, r.requestId!); }
  @Post('bulk/unpublish') @Permissions('content.write') bulkUnpublish(@Body() d: BulkIdsDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.dramas.bulk(d, 'unpublish', p, r.requestId!); }
  @Post('bulk/delete') @Permissions('content.write') bulkDelete(@Body() d: BulkIdsDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.dramas.bulk(d, 'delete', p, r.requestId!); }
  @Post('bulk/restore') @Permissions('content.write') bulkRestore(@Body() d: BulkIdsDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.dramas.bulk(d, 'restore', p, r.requestId!); }
}
