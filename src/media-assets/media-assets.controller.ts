import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentPrincipal } from '../common/auth/current-principal.decorator';
import { AuthenticatedPrincipal } from '../common/auth/auth.types';
import { Permissions } from '../common/auth/permissions.decorator';
import { MediaAssetListQueryDto } from '../content/dto/content-query.dto';
import { CreateMediaAssetDto, UpdateMediaAssetDto } from './dto/media-asset.dto';
import { MediaAssetsService } from './media-assets.service';

@ApiTags('Media Assets') @ApiBearerAuth() @Controller('api/v1/media-assets')
export class MediaAssetsController {
  constructor(private readonly media: MediaAssetsService) {}
  @Get() @Permissions('media.read') list(@Query() q: MediaAssetListQueryDto) { return this.media.list(q); }
  @Get(':id') @Permissions('media.read') details(@Param('id', ParseUUIDPipe) id: string) { return this.media.details(id); }
  @Get(':id/validate') @Permissions('media.read') validate(@Param('id', ParseUUIDPipe) id: string) { return this.media.validate(id); }
  @Post() @Permissions('media.write') create(@Body() d: CreateMediaAssetDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.media.create(d, p, r.requestId!); }
  @Patch(':id') @Permissions('media.write') update(@Param('id', ParseUUIDPipe) id: string, @Body() d: UpdateMediaAssetDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.media.update(id, d, p, r.requestId!); }
  @Delete(':id') @Permissions('media.write') remove(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.media.remove(id, p, r.requestId!); }
  @Post(':id/restore') @Permissions('media.write') restore(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.media.restore(id, p, r.requestId!); }
}
