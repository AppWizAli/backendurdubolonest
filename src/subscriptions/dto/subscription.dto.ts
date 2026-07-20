import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';
import { PaymentMethod } from '@prisma/client';
import { PageQueryDto } from '../../common/pagination/page.dto';

export class CreatePlanDto { @IsString() @Length(2, 50) code!: string; @IsString() @Length(2, 120) name!: string; @IsInt() @Min(1) pricePkr!: number; @IsInt() @Min(1) durationDays!: number; }
export class UpdatePlanDto { @IsOptional() @IsString() @Length(2, 120) name?: string; @IsOptional() @IsInt() @Min(1) pricePkr?: number; @IsOptional() @IsInt() @Min(1) durationDays?: number; @IsOptional() @IsBoolean() isActive?: boolean; }
export class CreateSubscriptionDto { @IsUUID() userId!: string; @IsUUID() planId!: string; @IsOptional() @IsString() @Length(1, 500) note?: string; }
export class PaymentDto { @IsUUID() userId!: string; @IsOptional() @IsUUID() planId?: string; @IsInt() @Min(0) amountPkr!: number; @IsEnum(PaymentMethod) method!: PaymentMethod; @IsOptional() @IsString() @Length(1, 160) reference?: string; @IsOptional() @IsString() @Length(1, 512) proofKey?: string; @IsOptional() @IsString() @Length(1, 500) note?: string; @IsOptional() @IsDateString() paidAt?: string; }
export class ExtendSubscriptionDto { @IsInt() @Min(1) days!: number; @IsOptional() @IsString() @Length(1, 500) note?: string; }
export class CancelSubscriptionDto { @IsOptional() @IsString() @Length(1, 500) note?: string; }
export class SubscriptionHistoryQueryDto extends PageQueryDto { @IsOptional() @IsUUID() userId?: string; }
