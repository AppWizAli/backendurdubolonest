import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { ContentVisibility, EpisodeStatus, MediaStatus, MediaType } from '@prisma/client';
import { PageQueryDto } from '../../common/pagination/page.dto';

const booleanQuery = ({ value }: { value: unknown }) => value === true || value === 'true' ? true : value === false || value === 'false' ? false : value;

export class ContentListQueryDto extends PageQueryDto {
  @IsOptional() @IsString() @Length(1, 100) search?: string;
  @IsOptional() @IsString() @IsIn(['name', 'slug', 'title', 'seasonNumber', 'episodeNumber', 'createdAt', 'updatedAt', 'version']) sort = 'createdAt';
  @IsOptional() @IsString() @IsIn(['asc', 'desc']) order: 'asc' | 'desc' = 'desc';
  @IsOptional() @Transform(booleanQuery) @IsBoolean() includeDeleted?: boolean;
}

export class DramaListQueryDto extends ContentListQueryDto {
  @IsOptional() @Transform(booleanQuery) @IsBoolean() published?: boolean;
}

export class SeasonListQueryDto extends ContentListQueryDto {
  @IsOptional() @IsUUID() dramaId?: string;
}

export class EpisodeListQueryDto extends ContentListQueryDto {
  @IsOptional() @IsUUID() seasonId?: string;
  @IsOptional() @IsUUID() dramaId?: string;
  @IsOptional() @Transform(booleanQuery) @IsBoolean() published?: boolean;
  @IsOptional() @IsEnum(ContentVisibility) visibility?: ContentVisibility;
  @IsOptional() @Transform(booleanQuery) @IsBoolean() premium?: boolean;
  @IsOptional() @IsEnum(EpisodeStatus) status?: EpisodeStatus;
}

export class MediaAssetListQueryDto extends ContentListQueryDto {
  @IsOptional() @IsUUID() episodeId?: string;
  @IsOptional() @IsEnum(MediaStatus) status?: MediaStatus;
  @IsOptional() @IsEnum(MediaType) mediaType?: MediaType;
}

export class BulkIdsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @IsUUID('4', { each: true }) ids!: string[];
}
