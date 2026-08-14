import { Body, Controller, Get, Post, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  login(
    @Body() body: { email?: string; password?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const email = (body?.email || '').trim().toLowerCase();
    if (!this.auth.validate(email, body?.password || '')) {
      throw new UnauthorizedException('Email atau password salah');
    }
    res.cookie(this.auth.cookieName, this.auth.sign(email), this.auth.cookieOptions());
    return { email };
  }

  // Guarded: returns the current user, or 401 → the SPA shows the login page.
  @Get('me')
  me(@Req() req: Request) {
    return { email: (req as any).user?.email };
  }

  @Public()
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(this.auth.cookieName, { path: '/' });
    return { ok: true };
  }

  // ---- Google SSO ----
  @Public()
  @Get('google')
  googleStart(@Res() res: Response) {
    if (!this.auth.googleEnabled) { res.redirect('/?login=google_unconfigured'); return; }
    const state = randomBytes(16).toString('hex');
    res.cookie('g_state', state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600_000, path: '/' });
    res.redirect(this.auth.googleAuthUrl(state));
  }

  @Public()
  @Get('google/callback')
  async googleCallback(@Query('code') code: string, @Query('state') state: string, @Req() req: Request, @Res() res: Response) {
    const saved = cookie(req.headers.cookie)['g_state'];
    res.clearCookie('g_state', { path: '/' });
    if (!code || !state || state !== saved) { res.redirect('/?login=error'); return; }
    const email = await this.auth.googleEmail(code);
    if (!email) { res.redirect('/?login=error'); return; }
    if (!this.auth.ssoAllowed(email)) { res.redirect('/?login=denied'); return; }
    res.cookie(this.auth.cookieName, this.auth.sign(email), this.auth.cookieOptions());
    res.redirect('/');
  }
}

function cookie(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
