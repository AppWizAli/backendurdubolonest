import { IsOptional, IsString, IsUUID, IsUrl, Length } from 'class-validator';

export class FirebaseTestDto {
  @IsUUID()
  userId!: string;

  @IsString()
  @Length(1, 120)
  title!: string;

  @IsString()
  @Length(1, 1000)
  message!: string;
}

export class DrmValidationDto {
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  licenseUrl?: string;
}
