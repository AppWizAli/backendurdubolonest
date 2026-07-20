import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsBoolean, IsDateString, IsDefined, IsEmail, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import { RoleCode } from '@prisma/client';
import { PageQueryDto } from '../common/pagination/page.dto';

export class LegacyListDto extends PageQueryDto {
  @IsOptional() @IsString() @Length(1, 100) search?: string;
  @IsOptional() @IsString() @IsIn(['createdAt', 'updatedAt', 'position', 'status']) sort = 'createdAt';
  @IsOptional() @IsString() @IsIn(['asc', 'desc']) order: 'asc' | 'desc' = 'desc';
}

export class CreateNotificationDto {
  @IsString() @Length(1, 255) title!: string;
  @IsString() @Length(1, 10000) message!: string;
  @IsOptional() @IsString() @Length(1, 512) imageKey?: string;
}

export class UpdateNotificationDto extends CreateNotificationDto {}

export class MessageListDto extends LegacyListDto {
  @IsOptional() @IsIn(['unread', 'read']) status?: string;
}

export class SendAdminNotificationDto {
  @IsString() @Length(1, 10000) message!: string;
}

export class MobileSupportMessageDto {
  @IsString() @Length(1, 4000) message!: string;
}

export class AccountDeletionRequestDto {
  @IsOptional() @IsString() @Length(1, 2000) reason?: string;
}

export class ReviewAccountDeletionRequestDto {
  @IsIn(['approved', 'rejected']) status!: 'approved' | 'rejected';
  @IsOptional() @IsString() @Length(1, 5000) adminNote?: string;
}

export class AdminRoleDto {
  @IsEnum(RoleCode) role!: RoleCode;
}

export class CreateAdminDto {
  @IsString() @Length(2, 80) username!: string;
  @IsEmail() email!: string;
  @IsString() @Length(12, 128) password!: string;
  @IsEnum(RoleCode) role!: RoleCode;
}

export class SendMessageDto {
  @IsUUID() userId!: string;
  @IsString() @Length(1, 10000) message!: string;
}

export class SendGroupMessageDto {
  @IsUUID() groupId!: string;
  @IsString() @Length(1, 10000) message!: string;
}

export class MarkMessageDto {
  @IsOptional() @IsUUID() messageId?: string;
}

export class CreateBannerDto {
  @IsOptional() @IsString() @Length(1, 512) imageKey?: string;
  @IsOptional() @IsString() @Length(1, 512) videoKey?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateBannerDto extends CreateBannerDto {}

export class AssignTrendingDto {
  @IsUUID() dramaId!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) position!: number;
}

export class UpdateTrendingDto extends AssignTrendingDto {}

export class CreateReleaseDto {
  @IsOptional() @IsString() @Length(1, 60) versionName?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) versionCode?: number;
  @IsString() @Length(1, 512) storageKey!: string;
  @IsOptional() @IsString() @Length(1, 255) originalName?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) fileSize?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateReleaseDto extends CreateReleaseDto {}

export class RemoteConfigDto {
  @IsString() @Length(1, 120) configKey!: string;
  @IsDefined() value!: unknown;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class SubscriptionSettingsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) monthlyAmountPkr?: number;
  @IsOptional() @IsString() @Length(3, 10) currency?: string;
  @IsOptional() @IsUUID() defaultGroupId?: string;
  @IsOptional() @IsString() @Length(1, 50) jazzcashNumber?: string;
  @IsOptional() @IsString() @Length(1, 160) jazzcashTitle?: string;
  @IsOptional() @IsString() @Length(1, 50) easypaisaNumber?: string;
  @IsOptional() @IsString() @Length(1, 160) easypaisaTitle?: string;
  @IsOptional() @IsString() @Length(1, 160) bankName?: string;
  @IsOptional() @IsString() @Length(1, 160) bankAccountTitle?: string;
  @IsOptional() @IsString() @Length(1, 80) bankAccountNumber?: string;
  @IsOptional() @IsString() @Length(1, 80) bankIban?: string;
  @IsOptional() @IsString() @Length(1, 10000) paymentInstructions?: string;
}

export class CreateSubscriptionRequestDto {
  @IsOptional() @IsUUID() groupId?: string;
  @IsOptional() @IsUUID() planId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) amountPkr?: number;
  @IsOptional() @IsString() @Length(1, 40) paymentMethod?: string;
  @IsOptional() @IsString() @Length(1, 512) screenshotKey?: string;
  @IsOptional() @IsString() @Length(1, 5000) note?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(24) monthsAdded?: number;
}

export class ReviewSubscriptionRequestDto {
  @IsIn(['approved', 'rejected']) status!: 'approved' | 'rejected';
  @IsOptional() @IsString() @Length(1, 5000) adminNote?: string;
  @IsOptional() @IsDateString() subscriptionStartDate?: string;
  @IsOptional() @IsDateString() subscriptionEndDate?: string;
}

export class SecurityBlockDto {
  @IsBoolean() isBlocked!: boolean;
  @IsOptional() @IsString() @Length(1, 1000) message?: string;
}

export class SecurityIncidentDto {
  @IsString() @Length(1, 80) incidentType!: string;
  @IsOptional() @IsString() @Length(1, 160) incidentLabel?: string;
  @IsOptional() @IsString() @Length(1, 120) appArea?: string;
  @IsOptional() @IsString() @Length(1, 160) deviceModel?: string;
  @IsOptional() @IsString() @Length(1, 120) manufacturer?: string;
  @IsOptional() @IsString() @Length(1, 60) androidVersion?: string;
  @IsOptional() @IsString() @Length(1, 60) appVersion?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) appVersionCode?: number;
  @IsOptional() @IsString() @Length(1, 160) packageName?: string;
  @IsOptional() @IsString() @Length(1, 160) deviceId?: string;
  @IsOptional() @IsString() @Length(1, 120) deviceBrand?: string;
  @IsOptional() @IsString() @Length(1, 160) deviceProduct?: string;
  @IsOptional() @IsString() @Length(1, 160) deviceHardware?: string;
  @IsOptional() @IsString() @Length(1, 255) deviceFingerprint?: string;
  @IsOptional() @Type(() => Number) latitude?: number;
  @IsOptional() @Type(() => Number) longitude?: number;
  @IsOptional() @Type(() => Number) locationAccuracy?: number;
  @IsOptional() @IsDefined() extra?: unknown;
  @IsOptional() @IsIn(['info', 'warning', 'critical']) severity?: string;
}

export class CreateCommentDto {
  @IsOptional() @IsUUID() episodeId?: string;
  @IsOptional() @IsUUID() groupId?: string;
  @IsString() @Length(1, 5000) body!: string;
}

export class UpdateCommentDto {
  @IsOptional() @IsString() @Length(1, 5000) body?: string;
  @IsOptional() @IsIn(['visible', 'hidden']) status?: string;
}

export class RecordViewDto {
  @IsUUID() episodeId!: string;
}

export class SearchDto extends PageQueryDto {
  @IsString() @Length(1, 100) q!: string;
}
