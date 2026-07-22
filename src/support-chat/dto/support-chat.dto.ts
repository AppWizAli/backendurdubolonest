import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';

export class SupportMessageQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 40;
}

export class SupportConversationQueryDto extends SupportMessageQueryDto {
  @IsOptional() @IsString() @Length(1, 120) search?: string;
  @IsOptional() @IsIn(['OPEN', 'WAITING', 'RESOLVED', 'BLOCKED', 'UNREAD']) status?: 'OPEN' | 'WAITING' | 'RESOLVED' | 'BLOCKED' | 'UNREAD';
  @IsOptional() @IsIn(['newest', 'oldest']) sort?: 'newest' | 'oldest';
}

export class CreateSupportMessageDto {
  @IsOptional() @IsString() @Length(1, 5000) text?: string;
  @IsOptional() @IsString() @Length(1, 5000) message?: string;
  @IsOptional() @IsIn(['TEXT', 'IMAGE', 'VIDEO', 'VOICE', 'FILE']) messageType?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'VOICE' | 'FILE';
  @IsOptional() @IsString() @Length(1, 2048) mediaUrl?: string;
  @IsOptional() @IsString() @Length(1, 2048) thumbnail?: string;
  @IsOptional() @IsString() @Length(1, 160) mimeType?: string;
  @IsOptional() @IsString() @Length(1, 255) originalName?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) fileSize?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) voiceDuration?: number;
  @IsOptional() @IsUUID() replyToMessageId?: string;
}

export class UpdateSupportConversationStatusDto {
  @IsIn(['OPEN', 'WAITING', 'RESOLVED', 'BLOCKED']) status!: 'OPEN' | 'WAITING' | 'RESOLVED' | 'BLOCKED';
}

export class SupportTypingDto {
  @IsUUID() conversationId!: string;
  @IsOptional() @IsIn(['typing', 'stop']) state?: 'typing' | 'stop';
}
