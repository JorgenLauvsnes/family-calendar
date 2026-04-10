import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { getOAuth2Client, decryptToken } from '@/lib/google/oauth';

export async function POST(request: NextRequest) {
  const res = new NextResponse();
  const session = await getIronSession<SessionData>(request, res, sessionOptions);
  if (!session.isAdmin) {
    return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 });
  }

  const { memberId } = await request.json();
  if (!memberId) {
    return NextResponse.json({ error: 'memberId mangler' }, { status: 400 });
  }

  const db = getDb();
  const tokenRow = db
    .prepare('SELECT * FROM google_tokens WHERE member_id = ?')
    .get(Number(memberId)) as { access_token: string } | undefined;

  if (tokenRow) {
    // Attempt to revoke the token with Google
    try {
      const client = getOAuth2Client();
      await client.revokeToken(decryptToken(tokenRow.access_token));
    } catch {
      // Revocation failure is non-fatal — still delete locally
    }

    // Delete Google events for this member
    db.prepare(`
      DELETE FROM events WHERE source = 'google'
        AND id IN (
          SELECT event_id FROM event_members WHERE member_id = ?
        )
    `).run(Number(memberId));

    db.prepare('DELETE FROM google_tokens WHERE member_id = ?').run(
      Number(memberId)
    );
  }

  return NextResponse.json({ ok: true });
}
