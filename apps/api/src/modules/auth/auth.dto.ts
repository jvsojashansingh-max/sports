import { IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class RequestOtpDto {
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/)
  phone!: string;
}

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  requestId!: string;

  @IsString()
  @MinLength(4)
  otp!: string;

  @IsString()
  @IsNotEmpty()
  deviceId!: string;
}

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;

  @IsString()
  @IsNotEmpty()
  deviceId!: string;
}

export class LinkGoogleDto {
  @IsString()
  @IsNotEmpty()
  googleSub!: string;

  @IsString()
  @IsOptional()
  email?: string;
}
