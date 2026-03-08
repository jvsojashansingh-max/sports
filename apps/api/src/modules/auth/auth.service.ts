import { createHash, createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { ConflictException, HttpException, Injectable, UnauthorizedException } from '@nestjs/common';
import { IdentityProvider, type UserRole } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { LinkGoogleDto, RefreshDto, RequestOtpDto, VerifyOtpDto } from './auth.dto';

type SessionTokens = {
  accessToken: string;
  refreshToken: string;
};

type AuthUser = {
  id: string;
  role: UserRole;
  defaultCityId: string | null;
  vendorId: string | null;
};

const DEMO_DEFAULT_CITY_ID = '00000000-0000-4000-8000-0000000003e9';

@Injectable()
export class AuthService {
  private readonly phoneOtpWindow = new Map<string, number[]>();
  private readonly ipOtpWindow = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async requestOtp(dto: RequestOtpDto, ipAddress: string | null) {
    this.assertRateLimit(`phone:${dto.phone}`, this.phoneOtpWindow, 5, 60_000);
    if (ipAddress) {
      this.assertRateLimit(`ip:${ipAddress}`, this.ipOtpWindow, 20, 60_000);
    }

    const requestId = randomUUID();
    const otp = randomOtp();
    await this.prisma.otpRequest.create({
      data: {
        id: requestId,
        phone: dto.phone,
        otpHash: hashText(otp),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    return {
      requestId,
      devOtp: otp,
    };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<SessionTokens & { user: Omit<AuthUser, 'vendorId'> }> {
    const request = await this.prisma.otpRequest.findUnique({
      where: { id: dto.requestId },
    });
    if (!request || request.consumedAt || request.expiresAt < new Date()) {
      throw new UnauthorizedException('UNAUTHENTICATED');
    }
    if (hashText(dto.otp) !== request.otpHash) {
      throw new UnauthorizedException('UNAUTHENTICATED');
    }

    const consumed = await this.prisma.otpRequest.updateMany({
      where: {
        id: dto.requestId,
        consumedAt: null,
      },
      data: {
        consumedAt: new Date(),
      },
    });
    if (consumed.count !== 1) {
      throw new UnauthorizedException('UNAUTHENTICATED');
    }

    const user = await this.findOrCreatePhoneUser(request.phone);

    const tokens = await this.issueTokens(user, dto.deviceId);
    await this.auditService.log({
      actorUserId: user.id,
      action: 'auth.verify_otp',
      objectType: 'user',
      objectId: user.id,
      beforeJson: null,
      afterJson: { phone: request.phone },
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        role: user.role,
        defaultCityId: user.defaultCityId,
      },
    };
  }

  async refresh(dto: RefreshDto): Promise<SessionTokens> {
    const existingSession = await this.prisma.session.findFirst({
      where: {
        refreshTokenHash: hashText(dto.refreshToken),
        revokedAt: null,
        deviceId: dto.deviceId,
      },
      include: {
        user: true,
      },
    });
    if (!existingSession) {
      throw new UnauthorizedException('UNAUTHENTICATED');
    }

    await this.prisma.session.update({
      where: { id: existingSession.id },
      data: { revokedAt: new Date() },
    });

    const user: AuthUser = {
      id: existingSession.user.id,
      role: existingSession.user.role as UserRole,
      vendorId: await this.resolveVendorIdForUser(existingSession.user.id),
      defaultCityId: existingSession.user.defaultCityId,
    };

    return this.issueTokens(user, dto.deviceId);
  }

  async logout(userId: string, deviceId?: string) {
    await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(deviceId ? { deviceId } : {}),
      },
      data: {
        revokedAt: new Date(),
      },
    });
    return { ok: true };
  }

  googleStart(deviceId: string) {
    const state = this.signGoogleState(deviceId);
    return {
      deviceId,
      state,
      url: `/auth/google/callback?code=stub-google-sub&state=${encodeURIComponent(state)}`,
    };
  }

  async googleCallback(code: string, state: string) {
    if (!this.verifyGoogleState(state)) {
      throw new UnauthorizedException('UNAUTHENTICATED');
    }

    const providerSubject = code?.trim() || 'google_stub_sub';
    const identity = await this.prisma.userIdentity.findUnique({
      where: {
        provider_providerSubject: {
          provider: IdentityProvider.GOOGLE,
          providerSubject,
        },
      },
      include: { user: true },
    });

    const user = identity?.user ?? (await this.prisma.user.create({ data: {} }));
    if (!identity) {
      await this.prisma.userIdentity.create({
        data: {
          userId: user.id,
          provider: IdentityProvider.GOOGLE,
          providerSubject,
          isPrimary: false,
        },
      });
    }

    const authUser: AuthUser = {
      id: user.id,
      role: user.role as UserRole,
      defaultCityId: user.defaultCityId,
      vendorId: await this.resolveVendorIdForUser(user.id),
    };
    const tokens = await this.issueTokens(authUser, 'google-device');

    return {
      ...tokens,
      user: {
        id: authUser.id,
        role: authUser.role,
        defaultCityId: authUser.defaultCityId,
      },
    };
  }

  async linkGoogle(userId: string, dto: LinkGoogleDto) {
    const existing = await this.prisma.userIdentity.findUnique({
      where: {
        provider_providerSubject: {
          provider: IdentityProvider.GOOGLE,
          providerSubject: dto.googleSub,
        },
      },
    });

    if (existing && existing.userId !== userId) {
      throw new ConflictException('CONFLICT: identity already linked');
    }

    if (!existing) {
      await this.prisma.userIdentity.create({
        data: {
          userId,
          provider: IdentityProvider.GOOGLE,
          providerSubject: dto.googleSub,
          email: dto.email,
          isPrimary: false,
        },
      });
    }

    await this.auditService.log({
      actorUserId: userId,
      action: 'auth.link_google',
      objectType: 'user',
      objectId: userId,
      beforeJson: null,
      afterJson: {
        googleSub: dto.googleSub,
      },
    });

    return { ok: true };
  }

  private async issueTokens(user: AuthUser, deviceId: string): Promise<SessionTokens> {
    const accessToken = encodeAccessToken(user.id, user.role, user.vendorId);
    const refreshToken = `r_${deviceId}_${randomUUID()}`;
    await this.prisma.session.create({
      data: {
        userId: user.id,
        deviceId,
        refreshTokenHash: hashText(refreshToken),
      },
    });
    return {
      accessToken,
      refreshToken,
    };
  }

  private async findOrCreatePhoneUser(phone: string): Promise<AuthUser> {
    const identity = await this.prisma.userIdentity.findUnique({
      where: {
        provider_providerSubject: {
          provider: IdentityProvider.PHONE_OTP,
          providerSubject: phone,
        },
      },
      include: {
        user: true,
      },
    });

    if (identity?.user) {
      return {
        id: identity.user.id,
        role: identity.user.role as UserRole,
        defaultCityId: identity.user.defaultCityId,
        vendorId: await this.resolveVendorIdForUser(identity.user.id),
      };
    }

    const user = await this.prisma.user.create({
      data: {
        role: 'PLAYER',
        status: 'ACTIVE',
        defaultCityId: this.shouldDefaultToDemoCity() ? DEMO_DEFAULT_CITY_ID : undefined,
      },
    });
    await this.prisma.userIdentity.create({
      data: {
        userId: user.id,
        provider: IdentityProvider.PHONE_OTP,
        providerSubject: phone,
        isPrimary: true,
      },
    });

    return {
      id: user.id,
      role: user.role as UserRole,
      defaultCityId: user.defaultCityId,
      vendorId: await this.resolveVendorIdForUser(user.id),
    };
  }

  private async resolveVendorIdForUser(userId: string): Promise<string | null> {
    const vendor = await this.prisma.vendor.findFirst({
      where: {
        ownerUserId: userId,
        status: 'APPROVED',
      },
      select: { id: true },
    });
    return vendor?.id ?? null;
  }

  private signGoogleState(deviceId: string): string {
    const payload = JSON.stringify({
      deviceId,
      ts: Date.now(),
    });
    const payloadEncoded = Buffer.from(payload, 'utf8').toString('base64url');
    const signature = createHmac('sha256', this.googleStateSecret())
      .update(payloadEncoded)
      .digest('base64url');
    return `${payloadEncoded}.${signature}`;
  }

  private verifyGoogleState(state: string): boolean {
    const [payloadEncoded, signature] = state.split('.');
    if (!payloadEncoded || !signature) {
      return false;
    }

    const expected = createHmac('sha256', this.googleStateSecret())
      .update(payloadEncoded)
      .digest('base64url');

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }

    if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return false;
    }

    try {
      const parsed = JSON.parse(Buffer.from(payloadEncoded, 'base64url').toString('utf8')) as {
        deviceId: string;
        ts: number;
      };
      if (!parsed.deviceId || typeof parsed.ts !== 'number') {
        return false;
      }
      return Date.now() - parsed.ts <= 10 * 60 * 1000;
    } catch {
      return false;
    }
  }

  private googleStateSecret(): string {
    return process.env.JWT_ACCESS_SECRET || 'dev-google-state-secret';
  }

  private shouldDefaultToDemoCity(): boolean {
    return process.env.OTP_PROVIDER === 'stub';
  }

  private assertRateLimit(
    key: string,
    windowMap: Map<string, number[]>,
    limit: number,
    durationMs: number,
  ): void {
    const now = Date.now();
    const events = (windowMap.get(key) ?? []).filter((ts) => now - ts <= durationMs);
    if (events.length >= limit) {
      throw new HttpException('RATE_LIMITED', 429);
    }
    events.push(now);
    windowMap.set(key, events);
  }
}

function encodeAccessToken(id: string, role: UserRole, vendorId: string | null): string {
  return Buffer.from(`${id}|${role}|${vendorId ?? ''}`, 'utf8').toString('base64url');
}

function hashText(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function randomOtp(): string {
  return String(randomInt(100000, 999999));
}
