import { IsEmail, IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
import { RoleCode, UserStatus } from '@prisma/client';
import { PageQueryDto } from '../../common/pagination/page.dto';

export class CreateUserDto {
  @IsString() @Length(2, 80) @Matches(/^[\p{L}0-9 ._-]+$/u) username!: string;
  @IsEmail() email!: string;
  @IsString() @Length(12, 128) @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/) password!: string;
  @IsOptional() @IsEnum(RoleCode) role?: RoleCode;
}

export class UpdateProfileDto {
  @IsOptional() @IsString() @Length(2, 80) @Matches(/^[\p{L}0-9 ._-]+$/u) username?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @Length(1, 512) profileImageKey?: string;
}

export class UpdateStatusDto {
  @IsEnum(UserStatus) status!: UserStatus;
}

export class ListUsersDto extends PageQueryDto {
  @IsOptional() @IsString() @Length(1, 100) search?: string;
  @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
  @IsOptional() @IsEnum(RoleCode) role?: RoleCode;
}
