import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';
import { RoleCode } from '@prisma/client';

export class CreateRoleDto { @IsEnum(RoleCode) code!: RoleCode; @IsString() @Length(2, 80) name!: string; @IsOptional() @IsString() @Length(1, 255) description?: string; }
export class UpdateRoleDto { @IsOptional() @IsString() @Length(2, 80) name?: string; @IsOptional() @IsString() @Length(1, 255) description?: string; }
export class CreatePermissionDto { @IsString() @Length(3, 120) @Matches(/^[a-z0-9]+(?:[._:-][a-z0-9]+)+$/) code!: string; @IsOptional() @IsString() @Length(1, 255) description?: string; }
export class UpdatePermissionDto { @IsOptional() @IsString() @Length(1, 255) description?: string; }
export class AssignRoleDto { @IsEnum(RoleCode) role!: RoleCode; }
export class AssignPermissionDto { @IsUUID() permissionId!: string; @IsOptional() @IsBoolean() granted?: boolean; }
export class AssignRolePermissionDto { @IsUUID() permissionId!: string; }
