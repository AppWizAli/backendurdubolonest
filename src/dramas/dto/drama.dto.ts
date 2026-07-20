import { IsBoolean, IsInt, IsOptional, IsString, Length, Matches, Min } from 'class-validator';

export class CreateDramaDto {
  @IsString() @Length(2, 200) name!: string;
  @IsString() @Length(2, 220) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug!: string;
  @IsOptional() @IsInt() @Min(0) dramaNumber?: number;
  @IsOptional() @IsInt() @Min(0) totalSeasons?: number;
  @IsOptional() @IsString() @Length(1, 10000) description?: string;
  @IsOptional() @IsString() @Length(1, 512) thumbnailKey?: string;
  @IsOptional() @IsBoolean() isPublished?: boolean;
}

export class UpdateDramaDto {
  @IsOptional() @IsString() @Length(2, 200) name?: string;
  @IsOptional() @IsString() @Length(2, 220) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug?: string;
  @IsOptional() @IsInt() @Min(0) dramaNumber?: number;
  @IsOptional() @IsInt() @Min(0) totalSeasons?: number;
  @IsOptional() @IsString() @Length(1, 10000) description?: string;
  @IsOptional() @IsString() @Length(1, 512) thumbnailKey?: string;
  @IsOptional() @IsBoolean() isPublished?: boolean;
}
