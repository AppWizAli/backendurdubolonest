import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Permissions } from '../common/auth/permissions.decorator';
import { CurrentPrincipal } from '../common/auth/current-principal.decorator';
import { AuthenticatedPrincipal } from '../common/auth/auth.types';
import { AdminToolsService } from './admin-tools.service';
import { DrmValidationDto, FirebaseTestDto } from './admin-tools.dto';

@ApiTags('Admin Tools')
@ApiBearerAuth()
@Controller('api/v1/admin')
export class AdminToolsController {
  constructor(private readonly tools: AdminToolsService) {}
  @Get('firebase/status') @Permissions('notifications.read') firebaseStatus() { return this.tools.firebaseStatus(); }
  @Post('firebase/test') @Permissions('notifications.send') firebaseTest(@Body() dto: FirebaseTestDto, @CurrentPrincipal() actor: AuthenticatedPrincipal, @Req() request: Request) { return this.tools.sendFirebaseTest(dto, actor, request.requestId!); }
  @Get('drm/status') @Permissions('media.read') drmStatus() { return this.tools.drmStatus(); }
  @Post('drm/validate') @Permissions('media.write') validateDrm(@Body() dto: DrmValidationDto) { return this.tools.validateDrm(dto); }
}
