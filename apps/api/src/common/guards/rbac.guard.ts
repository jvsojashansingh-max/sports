import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { REQUIRED_ACTION_KEY } from '../decorators/require-action.decorator';
import { can, type Action } from '../policy/can';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const action = this.reflector.getAllAndOverride<Action>(REQUIRED_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!action) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const role = req.user?.role;
    if (!role) {
      throw new ForbiddenException('FORBIDDEN');
    }

    const resourceVendorIdHeader = req.headers['x-resource-vendor-id'];
    const resourceVendorId =
      typeof resourceVendorIdHeader === 'string' ? resourceVendorIdHeader : undefined;

    if (
      !can(role, action, {
        vendorId: resourceVendorId,
        actorVendorId: req.user?.vendorId ?? undefined,
      })
    ) {
      throw new ForbiddenException('FORBIDDEN');
    }

    return true;
  }
}
