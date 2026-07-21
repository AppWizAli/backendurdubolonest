import { Body, Controller, Delete, Param, ParseUUIDPipe, Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentPrincipal } from '../common/auth/current-principal.decorator';
import { AuthenticatedPrincipal } from '../common/auth/auth.types';
import { Permissions } from '../common/auth/permissions.decorator';
import { UploadsService } from './uploads.service';
import { InitUploadDto, UploadChunkDto } from './uploads.dto';

@ApiTags('Uploads') @ApiBearerAuth() @Controller('api/v1/uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}
  @Post('init') @Permissions('media.write') init(@Body() dto: InitUploadDto, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.uploads.init(dto, actor, request.requestId!); }
  @Post(':id/chunks') @Permissions('media.write') @ApiConsumes('multipart/form-data') @UseInterceptors(FileInterceptor('chunk', { limits: { fileSize: 16 * 1024 * 1024 } })) chunk(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UploadChunkDto, @UploadedFile() file: { buffer: Buffer; size: number }, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.uploads.chunk(id, dto.chunkIndex, file, actor, request.requestId!); }
  @Post(':id/complete') @Permissions('media.write') complete(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.uploads.complete(id, actor, request.requestId!); }
  @Delete(':id') @Permissions('media.write') cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.uploads.cancel(id, actor, request.requestId!); }
}
