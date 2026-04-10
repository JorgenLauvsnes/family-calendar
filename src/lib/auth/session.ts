import { SessionOptions } from 'iron-session';

export interface SessionData {
  isAdmin: boolean;
}

export const sessionOptions: SessionOptions = {
  password:
    process.env.SESSION_SECRET ||
    'fallback-secret-please-set-SESSION_SECRET-in-env-32chars',
  cookieName: 'familie_admin_session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};
