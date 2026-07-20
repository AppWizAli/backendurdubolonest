import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Permissions } from '../common/auth/permissions.decorator';
import { CurrentPrincipal } from '../common/auth/current-principal.decorator';
import { AuthenticatedPrincipal } from '../common/auth/auth.types';
import { AssignPermissionDto, AssignRoleDto, AssignRolePermissionDto, CreatePermissionDto, CreateRoleDto, UpdatePermissionDto, UpdateRoleDto } from './dto/rbac.dto';
import { RbacService } from './rbac.service';

@ApiTags('Roles and Permissions') @ApiBearerAuth() @Controller('api/v1/rbac')
export class RbacController {
  constructor(private readonly rbac: RbacService) {}
  @Get('roles') @Permissions('roles.read') roles() { return this.rbac.listRoles(); }
  @Get('roles/:id') @Permissions('roles.read') role(@Param('id', ParseUUIDPipe) id: string) { return this.rbac.findRole(id); }
  @Post('roles') @Permissions('roles.write') createRole(@Body() dto: CreateRoleDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.rbac.createRole(dto, p, r.requestId!); }
  @Patch('roles/:id') @Permissions('roles.write') updateRole(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoleDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.rbac.updateRole(id, dto, p, r.requestId!); }
  @Delete('roles/:id') @Permissions('roles.write') deleteRole(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.rbac.deleteRole(id, p, r.requestId!); }
  @Get('permissions') @Permissions('permissions.read') permissions() { return this.rbac.listPermissions(); }
  @Post('permissions') @Permissions('permissions.write') createPermission(@Body() dto: CreatePermissionDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.rbac.createPermission(dto, p, r.requestId!); }
  @Patch('permissions/:id') @Permissions('permissions.write') updatePermission(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePermissionDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.rbac.updatePermission(id, dto, p, r.requestId!); }
  @Delete('permissions/:id') @Permissions('permissions.write') deletePermission(@Param('id', ParseUUIDPipe) id: string, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.rbac.deletePermission(id, p, r.requestId!); }
  @Post('users/:userId/roles') @Permissions('roles.write') assignRole(@Param('userId', ParseUUIDPipe) userId: string, @Body() dto: AssignRoleDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.rbac.assignRole(userId, dto, p, r.requestId!); }
  @Delete('users/:userId/roles') @Permissions('roles.write') removeRole(@Param('userId', ParseUUIDPipe) userId: string, @Body() dto: AssignRoleDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.rbac.removeRole(userId, dto, p, r.requestId!); }
  @Post('roles/:roleId/permissions') @Permissions('roles.write') assignRolePermission(@Param('roleId', ParseUUIDPipe) roleId: string, @Body() dto: AssignRolePermissionDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.rbac.assignRolePermission(roleId, dto, p, r.requestId!); }
  @Delete('roles/:roleId/permissions/:permissionId') @Permissions('roles.write') removeRolePermission(@Param('roleId', ParseUUIDPipe) roleId: string, @Param('permissionId', ParseUUIDPipe) permissionId: string, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.rbac.removeRolePermission(roleId, permissionId, p, r.requestId!); }
  @Post('users/:userId/permissions') @Permissions('permissions.write') assignUserPermission(@Param('userId', ParseUUIDPipe) userId: string, @Body() dto: AssignPermissionDto, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.rbac.assignUserPermission(userId, dto, p, r.requestId!); }
  @Delete('users/:userId/permissions/:permissionId') @Permissions('permissions.write') removeUserPermission(@Param('userId', ParseUUIDPipe) userId: string, @Param('permissionId', ParseUUIDPipe) permissionId: string, @CurrentPrincipal() p: AuthenticatedPrincipal, @Req() r: Request) { return this.rbac.removeUserPermission(userId, permissionId, p, r.requestId!); }
}
