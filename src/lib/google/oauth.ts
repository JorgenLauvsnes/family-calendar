import { google } from 'googleapis';
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length < 64) {
    // Derive a key from the session secret as fallback (not ideal for production)
    const secret = process.env.SESSION_SECRET || 'fallback-secret-for-dev-only';
    return crypto.createHash('sha256').update(secret).digest();
  }
  return Buffer.from(key.slice(0, 64), 'hex');
}

export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  // Store as: iv:tag:ciphertext (all hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptToken(ciphertext: string): string {
  const key = getEncryptionKey();
  const [ivHex, tagHex, dataHex] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final('utf8');
}

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI ||
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/google/callback`
  );
}

export function buildAuthUrl(memberId: number, state: string): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'openid'
    ],
    state: `${memberId}:${state}`,
    prompt: 'consent',
  });
}
