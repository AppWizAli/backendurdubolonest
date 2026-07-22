import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class InitUploadDto {
  @IsIn(['episode_video', 'thumbnail', 'notification_image', 'banner', 'apk', 'support_attachment'])
  purpose!: string;
  @IsOptional() @IsUUID() targetId?: string;
  @IsString() originalName!: string;
  @IsString() mimeType!: string;
  @IsInt() @Min(1) @Max(20_000_000_000) sizeBytes!: number;
  @IsInt() @Min(1) @Max(10_000) totalChunks!: number;
}

export class UploadChunkDto {
  @Type(() => Number)
  @IsInt() @Min(0) @Max(10_000) chunkIndex!: number;
}
