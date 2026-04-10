import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getOAuth2Client, encryptToken } from '@/lib/google/oauth';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      new URL(`/admin/google?error=${encodeURIComponent(error)}`,
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/admin/google?error=missing_params',
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
    );
  }

  // state format: "memberId:randomHex"
  const [memberIdStr] = state.split(':');
  const memberId = Number(memberIdStr);

  if (!memberId || isNaN(memberId)) {
    return NextResponse.redirect(
      new URL('/admin/google?error=invalid_state',
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
    );
  }

  try {
    const client = getOAuth2Client();
    const { tokens } = await client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Missing tokens in response');
    }

    // Get user email
    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email || '';

    const db = getDb();
    db.prepare(`
      INSERT INTO google_tokens
        (member_id, access_token, refresh_token, token_type, scope, expires_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(member_id) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        token_type = excluded.token_type,
        scope = excluded.scope,
        expires_at = excluded.expires_at,
        updated_at = datetime('now')
    `).run(
      memberId,
      encryptToken(tokens.access_token),
      encryptToken(tokens.refresh_token),
      tokens.token_type || 'Bearer',
      (tokens.scope as string) || '',
      tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : new Date(Date.now() + 3600_000).toISOString()
    );

    // Store email on the member row for display
    if (email) {
      db.prepare(
        "UPDATE members SET updated_at = datetime('now') WHERE id = ?"
      ).run(memberId);
    }

    return NextResponse.redirect(
      new URL('/admin/google?success=1',
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
    );
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    return NextResponse.redirect(
      new URL('/admin/google?error=token_exchange',
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
    );
  }
}
