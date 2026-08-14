import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

const COOKIE = 'ledger_session';
const TTL_S = 60 * 60 * 24 * 30; // 30 days

// Session auth for the login page. Credentials come from LEDGER_WEB_USERS
// ("email:password,email:password"); the session is a compact HMAC-signed token
// stored in an httpOnly cookie. Designed so a Google-SSO login path can be added
// later that simply issues the same session cookie via sign().
@Injectable()
export class AuthService {
  readonly cookieName = COOKIE;
  private users = parseUsers(process.env.LEDGER_WEB_USERS);
  private secret = process.env.LEDGER_SESSION_SECRET || '';

  // Google SSO config (all optional — the button stays a placeholder until set)
  private googleId = process.env.GOOGLE_CLIENT_ID || '';
  private googleSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  private publicUrl = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
  // Emails allowed to sign in via Google = password users + LEDGER_SSO_EMAILS
  private ssoEmails = new Set<string>([
    ...this.users.keys(),
    ...(process.env.LEDGER_SSO_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
  ]);

  get googleEnabled(): boolean {
    return !!(this.googleId && this.googleSecret && this.publicUrl);
  }

  private redirectUri(): string {
    return `${this.publicUrl}/api/auth/google/callback`;
  }

  googleAuthUrl(state: string): string {
    const p = new URLSearchParams({
      client_id: this.googleId,
      redirect_uri: this.redirectUri(),
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      prompt: 'select_account',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
  }

  // Exchange the OAuth code for the user's verified Google email, or null.
  async googleEmail(code: string): Promise<string | null> {
    try {
      const tokRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: this.googleId,
          client_secret: this.googleSecret,
          redirect_uri: this.redirectUri(),
          grant_type: 'authorization_code',
        }).toString(),
      });
      const tok: any = await tokRes.json();
      if (!tok.access_token) return null;
      const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${tok.access_token}` },
      });
      const info: any = await infoRes.json();
      if (!info.email || info.email_verified === false) return null;
      return String(info.email).toLowerCase();
    } catch {
      return null;
    }
  }

  ssoAllowed(email: string): boolean {
    return this.ssoEmails.has((email || '').trim().toLowerCase());
  }

  validate(email: string, password: string): boolean {
    const expected = this.users.get((email || '').trim().toLowerCase());
    if (!expected) return false;
    return safeEqual(password, expected);
  }

  // true once a sign-up email is allow-listed (used by a future SSO callback)
  isAllowed(email: string): boolean {
    return this.users.has((email || '').trim().toLowerCase());
  }

  sign(email: string): string {
    const exp = Math.floor(Date.now() / 1000) + TTL_S;
    const payload = b64url(JSON.stringify({ email, exp }));
    const sig = b64url(createHmac('sha256', this.secret).update(payload).digest());
    return `${payload}.${sig}`;
  }

  verify(token?: string): string | null {
    if (!token || !this.secret) return null;
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;
    const expect = b64url(createHmac('sha256', this.secret).update(payload).digest());
    if (!safeEqual(sig, expect)) return null;
    try {
      const { email, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
      if (!email || !exp || exp < Math.floor(Date.now() / 1000)) return null;
      return email;
    } catch {
      return null;
    }
  }

  cookieOptions() {
    return { httpOnly: true, secure: true, sameSite: 'lax' as const, maxAge: TTL_S * 1000, path: '/' };
  }
}

function parseUsers(raw?: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const pair of (raw || '').split(',').map(s => s.trim()).filter(Boolean)) {
    const i = pair.indexOf(':');
    if (i > 0) m.set(pair.slice(0, i).trim().toLowerCase(), pair.slice(i + 1));
  }
  return m;
}

function b64url(s: string | Buffer): string {
  return Buffer.from(s).toString('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
