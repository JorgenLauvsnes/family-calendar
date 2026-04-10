import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import { syncMemberCalendar, syncAllConnectedMembers } from '@/lib/google/sync';

export async function POST(request: NextRequest) {
  const res = new NextResponse();
  const session = await getIronSession<SessionData>(request, res, sessionOptions);
  if (!session.isAdmin) {
    return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { memberId } = body;

    if (memberId) {
      await syncMemberCalendar(Number(memberId));
    } else {
      await syncAllConnectedMembers();
    }

    return NextResponse.json({ ok: true, synced_at: new Date().toISOString() });
  } catch (err) {
    console.error('Google sync error:', err);
    return NextResponse.json({ error: 'Synkronisering feilet' }, { status: 500 });
  }
}
