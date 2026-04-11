import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { getDb } from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

async function checkAuth(req: NextRequest) {
  const res = new NextResponse();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  return session.isAdmin === true;
}

export async function GET(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 });
  }
  const db = getDb();
  const rows = db
    .prepare('SELECT key, value FROM settings')
    .all() as { key: string; value: string }[];

  const settings: Record<string, string> = {};
  for (const { key, value } of rows) {
    // Never expose password hash
    if (key === 'admin_password_hash') continue;
    settings[key] = value;
  }
  return NextResponse.json(settings);
}

export async function PUT(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const db = getDb();
    const update = db.prepare(
      "UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = ?"
    );

    for (const [key, value] of Object.entries(body)) {
      if (key === 'admin_password_hash') continue; // handled separately

      if (key === 'new_password' && typeof value === 'string' && value) {
        const hash = await bcrypt.hash(value, 10);
        update.run(hash, 'admin_password_hash');
        continue;
      }

      // Only update known keys
      const knownKeys = [
        'family_name', 'weather_lat', 'weather_lon', 'weather_location',
        'vacation_mode', 'vacation_start', 'vacation_end',
        'vacation_lat', 'vacation_lon', 'vacation_location',
        'display_wake_lock', 'google_sync_interval_minutes',
      ];
      if (knownKeys.includes(key)) {
        update.run(String(value), key);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Serverfeil' }, { status: 500 });
  }
}
