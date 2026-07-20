import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';
import { ContentVisibility, DownloadAccess, EpisodeStatus } from '@prisma/client';

export class CreateEpisodeDto {
  @IsUUID() seasonId!: string;
  @IsInt() @Min(1) episodeNumber!: number;
  @IsOptional() @IsString() @Length(1, 200) title?: string;
  @IsOptional() @IsString() @Length(1, 10000) description?: string;
  @IsOptional() @IsString() @Length(1, 512) thumbnailKey?: string;
  @IsOptional() @IsBoolean() isPublished?: boolean;
  @IsOptional() @IsEnum(ContentVisibility) visibility?: ContentVisibility;
  @IsOptional() @IsBoolean() isPremium?: boolean;
  @IsOptional() @IsEnum(DownloadAccess) downloadAccess?: DownloadAccess;
  @IsOptional() @IsEnum(EpisodeStatus) status?: EpisodeStatus;
}

export class UpdateEpisodeDto {
  @IsOptional() @IsUUID() seasonId?: string;
  @IsOptional() @IsInt() @Min(1) episodeNumber?: number;
  @IsOptional() @IsString() @Length(1, 200) title?: string;
  @IsOptional() @IsString() @Length(1, 10000) description?: string;
  @IsOptional() @IsString() @Length(1, 512) thumbnailKey?: string;
  @IsOptional() @IsBoolean() isPublished?: boolean;
  @IsOptional() @IsEnum(ContentVisibility) visibility?: ContentVisibility;
  @IsOptional() @IsBoolean() isPremium?: boolean;
  @IsOptional() @IsEnum(DownloadAccess) downloadAccess?: DownloadAccess;
  @IsOptional() @IsEnum(EpisodeStatus) status?: EpisodeStatus;
}
