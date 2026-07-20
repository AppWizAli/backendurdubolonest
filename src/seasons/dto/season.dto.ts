import { IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';

export class CreateSeasonDto {
  @IsUUID() dramaId!: string;
  @IsInt() @Min(1) seasonNumber!: number;
  @IsOptional() @IsString() @Length(1, 200) title?: string;
  @IsOptional() @IsInt() @Min(0) totalEpisodes?: number;
  @IsOptional() @IsString() @Length(1, 512) thumbnailKey?: string;
}

export class UpdateSeasonDto {
  @IsOptional() @IsUUID() dramaId?: string;
  @IsOptional() @IsInt() @Min(1) seasonNumber?: number;
  @IsOptional() @IsString() @Length(1, 200) title?: string;
  @IsOptional() @IsInt() @Min(0) totalEpisodes?: number;
  @IsOptional() @IsString() @Length(1, 512) thumbnailKey?: string;
}
