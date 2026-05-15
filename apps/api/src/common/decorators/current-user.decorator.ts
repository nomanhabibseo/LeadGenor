import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type JwtUser = { userId: string; email: string };

export const CurrentUser = createParamDecorator((data: unknown, ctx: ExecutionContext): JwtUser => {
  const req = ctx.switchToHttp().getRequest();
  return req.user;
});
