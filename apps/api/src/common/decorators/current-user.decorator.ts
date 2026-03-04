import { UnauthorizedException, createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestUser } from '../auth/request-user';

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): RequestUser => {
  const request = ctx.switchToHttp().getRequest<{ user?: RequestUser }>();
  if (!request.user) {
    throw new UnauthorizedException('UNAUTHENTICATED');
  }
  return request.user;
});
