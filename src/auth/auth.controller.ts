import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { ChangePasswordDto, DeviceRegistrationDto, LoginDto, RefreshTokenDto, RegisterDto } from './dto/login.dto';
import { Public } from '../common/auth/public.decorator';
import { CurrentPrincipal } from '../common/auth/current-principal.decorator';
import { AuthenticatedPrincipal } from '../common/auth/auth.types';
import { RateLimit } from '../common/security/rate-limit.decorator';
import { randomUUID } from 'node:crypto';

@ApiTags('Authentication')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @RateLimit({ limit: 3, windowSeconds: 60, scope: 'register' })
  @Post('register')
  @ApiOperation({ summary: 'Register a regular user account' })
  register(@Body() dto: RegisterDto, @Req() request: Request) { return this.auth.register(dto, request.ip ?? 'unknown', request.get('user-agent') ?? 'unknown', request.requestId ?? randomUUID()); }

  @Public()
  @RateLimit({ limit: 5, windowSeconds: 60, scope: 'login' })
  @Post('login')
  @ApiOperation({ summary: 'Authenticate a user' })
  login(@Body() dto: LoginDto, @Req() request: Request) { return this.auth.login(dto, request.ip ?? 'unknown', request.get('user-agent') ?? 'unknown', request.requestId ?? randomUUID()); }

  @Public()
  @RateLimit({ limit: 10, windowSeconds: 60, scope: 'refresh' })
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto, @Req() request: Request) { return this.auth.refresh(dto.refreshToken, request.ip ?? 'unknown', request.get('user-agent') ?? 'unknown', request.requestId ?? randomUUID()); }

  @Public()
  @Post('logout')
  logout(@Body() dto: RefreshTokenDto, @Req() request: Request) { return this.auth.logout(dto.refreshToken, request.requestId ?? randomUUID(), request.ip ?? 'unknown', request.get('user-agent') ?? 'unknown'); }

  @Get('me')
  @ApiBearerAuth()
  me(@CurrentPrincipal() principal: AuthenticatedPrincipal) { return this.auth.currentUser(principal); }

  @Get('sessions')
  @ApiBearerAuth()
  sessions(@CurrentPrincipal() principal: AuthenticatedPrincipal) { return this.auth.sessions(principal); }

  @Get('login-history')
  @ApiBearerAuth()
  loginHistory(@CurrentPrincipal() principal: AuthenticatedPrincipal) { return this.auth.loginHistory(principal); }

  @Delete('sessions/:id')
  @ApiBearerAuth()
  revokeSession(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id', ParseUUIDPipe) id: string, @Req() request: Request) { return this.auth.revokeSession(principal, id, request.requestId!); }

  @Post('logout-all')
  @ApiBearerAuth()
  logoutAll(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Req() request: Request) { return this.auth.logoutAll(principal, request.requestId!); }

  @Post('device')
  @ApiBearerAuth()
  registerDevice(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: DeviceRegistrationDto, @Req() request: Request) { return this.auth.registerDevice(principal, dto.deviceId, dto.fingerprint, dto.deviceName, dto.deviceToken, request.requestId!); }

  @Get('devices')
  @ApiBearerAuth()
  devices(@CurrentPrincipal() principal: AuthenticatedPrincipal) { return this.auth.devices(principal); }

  @Delete('devices/:id')
  @ApiBearerAuth()
  revokeDevice(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id', ParseUUIDPipe) id: string, @Req() request: Request) { return this.auth.revokeDevice(principal, id, request.requestId!); }

  @Post('password')
  @ApiBearerAuth()
  changePassword(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: ChangePasswordDto, @Req() request: Request) { return this.auth.changePassword(principal, dto.currentPassword, dto.newPassword, request.requestId!); }
}
