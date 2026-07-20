import { IsEnum, IsHexadecimal, IsInt, IsObject, IsOptional, IsString, IsUUID, Length, Matches, Min } from 'class-validator';
import { MediaStatus, MediaType } from '@prisma/client';

export class CreateMediaAssetDto {
  @IsUUID() episodeId!: string;
  @IsEnum(MediaType) mediaType!: MediaType;
  @IsString() @Length(2, 80) provider!: string;
  @IsString() @Length(8, 10000) @Matches(/^(?!https?:\/\/)/i, { message: 'encryptedLocator must not be a URL' }) encryptedLocator!: string;
  @IsOptional() @IsHexadecimal() @Length(64, 64) checksum?: string;
  @IsOptional() @IsEnum(MediaStatus) status?: MediaStatus;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
  @IsOptional() @IsInt() @Min(1) version?: number;
  @IsOptional() @IsInt() @Min(0) durationSeconds?: number;
  @IsOptional() @IsString() @Matches(/^\d+$/) sizeBytes?: string;
}

export class UpdateMediaAssetDto {
  @IsOptional() @IsEnum(MediaType) mediaType?: MediaType;
  @IsOptional() @IsString() @Length(2, 80) provider?: string;
  @IsOptional() @IsString() @Length(8, 10000) @Matches(/^(?!https?:\/\/)/i, { message: 'encryptedLocator must not be a URL' }) encryptedLocator?: string;
  @IsOptional() @IsHexadecimal() @Length(64, 64) checksum?: string;
  @IsOptional() @IsEnum(MediaStatus) status?: MediaStatus;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
  @IsOptional() @IsInt() @Min(1) version?: number;
  @IsOptional() @IsInt() @Min(0) durationSeconds?: number;
  @IsOptional() @IsString() @Matches(/^\d+$/) sizeBytes?: string;
}
