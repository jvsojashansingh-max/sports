import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { RequestUser } from '../auth/request-user';
import { isUuid, parseAccessToken } from '../auth/token';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import type { UserRole } from '../policy/can';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const authHeader = req.headers.authorization ?? '';
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('UNAUTHENTICATED');
    }

    const token = authHeader.slice('Bearer '.length).trim();
    const parsed = parseAccessToken(token);
    if (!parsed) {
      throw new UnauthorizedException('UNAUTHENTICATED');
    }

    let role: UserRole = parsed.role;
    let vendorId: string | null = parsed.vendorId;
    if (isUuid(parsed.id)) {
      const user = await this.prisma.user.findUnique({
        where: { id: parsed.id },
        select: { role: true },
      });
      if (user) {
        role = user.role;
      }
      const vendor = await this.prisma.vendor.findFirst({
        where: {
          ownerUserId: parsed.id,
          status: 'APPROVED',
        },
        select: { id: true },
      });
      vendorId = vendor?.id ?? null;
    }

    req.user = {
      id: parsed.id,
      role,
      vendorId,
      deviceId: typeof req.headers['x-device-id'] === 'string' ? req.headers['x-device-id'] : null,
    };
    return true;
  }
}
