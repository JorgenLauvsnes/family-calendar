import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { getDb } from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/auth/session';

async function checkAuth(req: NextRequest) {
  const res = new NextResponse();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  return session.isAdmin === true;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 });
  }
  const db = getDb();
  const member = db
    .prepare('SELECT * FROM members WHERE id = ?')
    .get(Number(params.id));

  if (!member) {
    return NextResponse.json({ error: 'Ikke funnet' }, { status: 404 });
  }

  // Include schedules
  const schedules = db
    .prepare('SELECT * FROM schedules WHERE member_id = ? ORDER BY day_of_week, start_time')
    .all(Number(params.id));

  // Include Google token status
  const hasGcal = !!db
    .prepare('SELECT 1 FROM google_tokens WHERE member_id = ?')
    .get(Number(params.id));

  return NextResponse.json({ ...member, schedules, hasGcal });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const {
      name, role, birthdate, color, avatar_initials,
      institution_name, institution_address, gcal_calendar_id,
    } = body;

    const db = getDb();
    db.prepare(
      `UPDATE members SET
         name = ?, role = ?, birthdate = ?, color = ?,
         avatar_initials = ?, institution_name = ?, institution_address = ?,
         gcal_calendar_id = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      name, role,
      birthdate || null,
      color,
      avatar_initials || null,
      institution_name || null,
      institution_address || null,
      gcal_calendar_id || null,
      Number(params.id)
    );

    const updated = db
      .prepare('SELECT * FROM members WHERE id = ?')
      .get(Number(params.id));

    return NextResponse.json(updated);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Serverfeil' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 });
  }
  const db = getDb();
  db.prepare('DELETE FROM members WHERE id = ?').run(Number(params.id));
  return NextResponse.json({ ok: true });
}
