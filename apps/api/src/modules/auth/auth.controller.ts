import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequireIdempotency } from '../../common/decorators/require-idempotency.decorator';
import type { RequestUser } from '../../common/auth/request-user';
import { AuthService } from './auth.service';
import { LinkGoogleDto, RefreshDto, RequestOtpDto, VerifyOtpDto } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('request-otp')
  @Public()
  @RequireIdempotency()
  requestOtp(
    @Body() body: RequestOtpDto,
    @Headers('x-forwarded-for') forwardedFor?: string,
    @Headers('x-real-ip') realIp?: string,
  ) {
    return this.authService.requestOtp(body, resolveClientIp(forwardedFor, realIp));
  }

  @Post('verify-otp')
  @Public()
  @RequireIdempotency()
  verifyOtp(@Body() body: VerifyOtpDto) {
    return this.authService.verifyOtp(body);
  }

  @Post('refresh')
  @Public()
  @RequireIdempotency()
  refresh(@Body() body: RefreshDto) {
    return this.authService.refresh(body);
  }

  @Post('logout')
  @RequireIdempotency()
  logout(
    @CurrentUser() user: RequestUser,
    @Headers('x-device-id') deviceId?: string,
    @Headers('authorization') _auth?: string,
  ) {
    return this.authService.logout(user.id, deviceId);
  }

  @Get('google/start')
  @Public()
  googleStart(@Query('deviceId') deviceId = 'unknown-device') {
    return this.authService.googleStart(deviceId);
  }

  @Get('google/callback')
  @Public()
  googleCallback(@Query('code') code: string, @Query('state') state: string) {
    return this.authService.googleCallback(code, state);
  }

  @Post('link-google')
  @RequireIdempotency()
  linkGoogle(@CurrentUser() user: RequestUser, @Body() body: LinkGoogleDto) {
    return this.authService.linkGoogle(user.id, body);
  }
}

function resolveClientIp(forwardedFor?: string, realIp?: string): string | null {
  const forwarded = (forwardedFor ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .find((entry) => entry.length > 0);
  if (forwarded) {
    return forwarded;
  }
  if (realIp && realIp.trim().length > 0) {
    return realIp.trim();
  }
  return null;
}
