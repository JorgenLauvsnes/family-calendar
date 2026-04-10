import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Passord mangler' },
        { status: 400 }
      );
    }

    const db = getDb();
    const row = db
      .prepare("SELECT value FROM settings WHERE key = 'admin_password_hash'")
      .get() as { value: string } | undefined;

    const hash = row?.value;
    if (!hash) {
      return NextResponse.json(
        { error: 'Admin er ikke konfigurert' },
        { status: 500 }
      );
    }

    const valid = await bcrypt.compare(password, hash);
    if (!valid) {
      return NextResponse.json(
        { error: 'Feil passord' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ ok: true });
    const session = await getIronSession<SessionData>(
      request,
      response,
      sessionOptions
    );
    session.isAdmin = true;
    await session.save();

    return response;
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Serverfeil' }, { status: 500 });
  }
}
