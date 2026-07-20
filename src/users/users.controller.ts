import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentPrincipal } from '../common/auth/current-principal.decorator';
import { AuthenticatedPrincipal } from '../common/auth/auth.types';
import { Permissions } from '../common/auth/permissions.decorator';
import { CreateUserDto, ListUsersDto, UpdateProfileDto, UpdateStatusDto } from './dto/user.dto';
import { UsersService } from './users.service';

@ApiTags('Users') @ApiBearerAuth() @Controller('api/v1/users')
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @Get('me') me(@CurrentPrincipal() p: AuthenticatedPrincipal) { return this.users.findById(p.id); }
  @Get() @Permissions('users.read') list(@Query() q: ListUsersDto) { return this.users.list(q); }
  @Post() @Permissions('users.write') create(@Body() dto: CreateUserDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.users.create(dto, p, r.requestId!); }
  @Get(':id') @Permissions('users.read') find(@Param('id', ParseUUIDPipe) id: string) { return this.users.findById(id); }
  @Patch(':id/profile') updateProfile(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProfileDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.users.updateProfile(id, dto, p, r.requestId!); }
  @Patch(':id/status') @Permissions('users.status') updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStatusDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.users.updateStatus(id, dto, p, r.requestId!); }
  @Delete(':id') @Permissions('users.delete') remove(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.users.remove(id, p, r.requestId!); }
}
