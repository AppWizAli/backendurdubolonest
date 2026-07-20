import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentPrincipal } from '../common/auth/current-principal.decorator';
import { AuthenticatedPrincipal } from '../common/auth/auth.types';
import { Permissions } from '../common/auth/permissions.decorator';
import { Public } from '../common/auth/public.decorator';
import { BulkIdsDto, SeasonListQueryDto } from '../content/dto/content-query.dto';
import { CreateSeasonDto, UpdateSeasonDto } from './dto/season.dto';
import { SeasonsService } from './seasons.service';

@ApiTags('Seasons') @ApiBearerAuth() @Controller('api/v1/seasons')
export class SeasonsController {
  constructor(private readonly seasons: SeasonsService) {}
  @Public() @Get() list(@Query() q: SeasonListQueryDto, @CurrentPrincipal() p?: AuthenticatedPrincipal) { return this.seasons.list(q, p); }
  @Public() @Get(':id') details(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p?: AuthenticatedPrincipal) { return this.seasons.details(id, p); }
  @Post() @Permissions('content.write') create(@Body() d: CreateSeasonDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.seasons.create(d, p, r.requestId!); }
  @Patch(':id') @Permissions('content.write') update(@Param('id', ParseUUIDPipe) id: string, @Body() d: UpdateSeasonDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.seasons.update(id, d, p, r.requestId!); }
  @Delete(':id') @Permissions('content.write') remove(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.seasons.remove(id, p, r.requestId!); }
  @Post(':id/restore') @Permissions('content.write') restore(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.seasons.restore(id, p, r.requestId!); }
  @Post('bulk/delete') @Permissions('content.write') bulkDelete(@Body() d: BulkIdsDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.seasons.bulk(d, 'delete', p, r.requestId!); }
  @Post('bulk/restore') @Permissions('content.write') bulkRestore(@Body() d: BulkIdsDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.seasons.bulk(d, 'restore', p, r.requestId!); }
}
