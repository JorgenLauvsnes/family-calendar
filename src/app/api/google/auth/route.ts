import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import { buildAuthUrl } from '@/lib/google/oauth';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  const res = new NextResponse();
  const session = await getIronSession<SessionData>(request, res, sessionOptions);
  if (!session.isAdmin) {
    return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get('memberId');
  if (!memberId) {
    return NextResponse.json({ error: 'memberId mangler' }, { status: 400 });
  }

  const state = crypto.randomBytes(16).toString('hex');
  const authUrl = buildAuthUrl(Number(memberId), state);

  return NextResponse.redirect(authUrl);
}
