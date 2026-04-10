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
  const event = db
    .prepare('SELECT * FROM events WHERE id = ?')
    .get(Number(params.id));
  if (!event) return NextResponse.json({ error: 'Ikke funnet' }, { status: 404 });

  const memberIds = (
    db
      .prepare('SELECT member_id FROM event_members WHERE event_id = ?')
      .all(Number(params.id)) as { member_id: number }[]
  ).map((r) => r.member_id);

  return NextResponse.json({ ...event, member_ids: memberIds });
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
      title, description, category, start_datetime, end_datetime,
      all_day, location, color_override, member_ids,
    } = body;

    const db = getDb();
    const eventId = Number(params.id);

    db.prepare(`
      UPDATE events SET
        title = ?, description = ?, category = ?,
        start_datetime = ?, end_datetime = ?,
        all_day = ?, location = ?, color_override = ?,
        source = 'manual', schedule_id = NULL,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      title,
      description || null,
      category || 'other',
      start_datetime,
      end_datetime,
      all_day ? 1 : 0,
      location || null,
      color_override || null,
      eventId
    );

    // Replace member associations
    db.prepare('DELETE FROM event_members WHERE event_id = ?').run(eventId);
    if (Array.isArray(member_ids)) {
      const ins = db.prepare(
        'INSERT OR IGNORE INTO event_members (event_id, member_id) VALUES (?, ?)'
      );
      for (const mid of member_ids) {
        ins.run(eventId, mid);
      }
    }

    const updated = db
      .prepare('SELECT * FROM events WHERE id = ?')
      .get(eventId);
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
  db.prepare('DELETE FROM events WHERE id = ?').run(Number(params.id));
  return NextResponse.json({ ok: true });
}
