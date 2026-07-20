import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsDateString, IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';
import { PageQueryDto } from '../../common/pagination/page.dto';

export class CreateGroupDto { @IsString() @Length(2, 120) name!: string; }
export class UpdateGroupDto { @IsString() @Length(2, 120) name!: string; }
export class GroupMemberDto { @IsUUID() userId!: string; @IsDateString() startsAt!: string; @IsDateString() endsAt!: string; @IsOptional() @IsString() @Length(1, 5000) comment?: string; @IsOptional() @IsBoolean() subscription?: boolean; }
export class DirectGrantDto { @IsUUID() userId!: string; @IsUUID() episodeId!: string; @IsDateString() startsAt!: string; @IsDateString() endsAt!: string; @IsOptional() @IsString() @Length(1, 500) note?: string; }
export class GroupGrantDto { @IsUUID() groupId!: string; @IsUUID() episodeId!: string; @IsDateString() startsAt!: string; @IsDateString() endsAt!: string; @IsOptional() @IsString() @Length(1, 500) note?: string; }
export class BulkDirectGrantDto { @IsUUID() userId!: string; @IsArray() @ArrayUnique() @ArrayMaxSize(500) @IsUUID('4', { each: true }) episodeIds!: string[]; @IsDateString() startsAt!: string; @IsDateString() endsAt!: string; @IsOptional() @IsString() @Length(1, 500) note?: string; }
export class BulkGroupGrantDto { @IsUUID() groupId!: string; @IsArray() @ArrayUnique() @ArrayMaxSize(500) @IsUUID('4', { each: true }) episodeIds!: string[]; @IsDateString() startsAt!: string; @IsDateString() endsAt!: string; @IsOptional() @IsString() @Length(1, 500) note?: string; }
export class AccessListDto extends PageQueryDto { @IsOptional() @IsString() @Length(1, 100) search?: string; @IsOptional() @IsUUID() episodeId?: string; @IsOptional() @IsUUID() userId?: string; @IsOptional() @IsUUID() groupId?: string; }
