import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { getDb } from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/auth/session';

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
  const members = db.prepare('SELECT * FROM members ORDER BY id').all();
  return NextResponse.json(members);
}

export async function POST(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { name, role, birthdate, color, avatar_initials, institution_name, institution_address } = body;

    if (!name || !role || !color) {
      return NextResponse.json({ error: 'Manglende felter' }, { status: 400 });
    }

    const db = getDb();
    const result = db
      .prepare(
        `INSERT INTO members (name, role, birthdate, color, avatar_initials, institution_name, institution_address, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .run(
        name, role,
        birthdate || null,
        color,
        avatar_initials || null,
        institution_name || null,
        institution_address || null
      );

    const created = db
      .prepare('SELECT * FROM members WHERE id = ?')
      .get(result.lastInsertRowid);

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Serverfeil' }, { status: 500 });
  }
}
