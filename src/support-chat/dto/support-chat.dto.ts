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
  @IsString() @Length(1, 5000) text!: string;
  @IsOptional() @IsUUID() replyToMessageId?: string;
}

export class UpdateSupportConversationStatusDto {
  @IsIn(['OPEN', 'WAITING', 'RESOLVED', 'BLOCKED']) status!: 'OPEN' | 'WAITING' | 'RESOLVED' | 'BLOCKED';
}

export class SupportTypingDto {
  @IsUUID() conversationId!: string;
  @IsOptional() @IsIn(['typing', 'stop']) state?: 'typing' | 'stop';
}
