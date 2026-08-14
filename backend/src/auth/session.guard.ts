import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { IS_PUBLIC } from './public.decorator';

// Global guard: every API route requires a valid session cookie unless marked
// @Public(). Static files (the SPA shell) are served by ServeStaticModule
// OUTSIDE Nest routing, so they stay public — the app calls /api/auth/me on load
// and shows the login page when it 401s. No data endpoint is ever unguarded.
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private reflector: Reflector, private auth: AuthService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const token = parseCookie(req.headers?.cookie)[this.auth.cookieName];
    const email = this.auth.verify(token);
    if (!email) throw new UnauthorizedException();
    req.user = { email };
    return true;
  }
}

function parseCookie(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
