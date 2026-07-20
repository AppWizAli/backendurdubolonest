import { IsEmail, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(12, 128)
  password!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9._:-]{8,128}$/)
  deviceId?: string;
}

export class RegisterDto {
  @IsString() @Length(2, 80) @Matches(/^[\p{L}0-9 ._-]+$/u) username!: string;
  @IsEmail() email!: string;
  @IsString() @Length(12, 128) @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/) password!: string;
  @IsOptional() @IsString() @Matches(/^[a-zA-Z0-9._:-]{8,128}$/) deviceId?: string;
}

export class RefreshTokenDto {
  @IsString()
  @Length(40, 256)
  refreshToken!: string;
}

export class ChangePasswordDto {
  @IsString()
  @Length(12, 128)
  currentPassword!: string;

  @IsString()
  @Length(12, 128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/, {
    message: 'newPassword must contain upper, lower, number, and symbol',
  })
  newPassword!: string;
}

export class DeviceRegistrationDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9._:-]{8,128}$/)
  deviceId!: string;

  @IsString()
  @Length(16, 512)
  fingerprint!: string;

  @IsOptional()
  @IsString()
  @Length(1, 160)
  deviceName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 512)
  deviceToken?: string;
}

export class SessionIdDto {
  @IsUUID()
  id!: string;
}
