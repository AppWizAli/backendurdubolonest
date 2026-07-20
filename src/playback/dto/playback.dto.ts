import { IsInt, IsOptional, IsString, IsUUID, Length, Max, Min, Matches } from 'class-validator';
import { PageQueryDto } from '../../common/pagination/page.dto';

export class PlaybackDeviceDto {
  @IsString() @Matches(/^[a-zA-Z0-9._:-]{8,128}$/) deviceId!: string;
  @IsString() @Length(16, 512) fingerprint!: string;
}

export class HeartbeatDto {
  @IsString() @Matches(/^[a-zA-Z0-9._:-]{8,128}$/) deviceId!: string;
  @IsString() @Length(16, 512) fingerprint!: string;
  @IsInt() @Min(0) @Max(86_400) positionSeconds!: number;
  @IsOptional() @IsInt() @Min(0) @Max(86_400) bufferedSeconds?: number;
}

export class StopPlaybackDto extends PlaybackDeviceDto {}

export class PlaybackHistoryQueryDto extends PageQueryDto {
  @IsOptional() @IsUUID() episodeId?: string;
}
