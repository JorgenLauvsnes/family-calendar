import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { getDb } from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import { generateEventsForSchedule } from '@/lib/schedule/generator';

async function checkAuth(req: NextRequest) {
  const res = new NextResponse();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  return session.isAdmin === true;
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
      label, day_of_week, start_time, end_time,
      location, category, active, valid_from, valid_until,
    } = body;

    const db = getDb();
    const scheduleId = Number(params.id);

    db.prepare(`
      UPDATE schedules SET
        label = ?, day_of_week = ?, start_time = ?, end_time = ?,
        location = ?, category = ?, active = ?, valid_from = ?, valid_until = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      label, day_of_week, start_time, end_time,
      location || null,
      category || 'work',
      active !== false ? 1 : 0,
      valid_from || null,
      valid_until || null,
      scheduleId
    );

    // Regenerate events for this schedule
    generateEventsForSchedule(scheduleId);

    const updated = db
      .prepare('SELECT * FROM schedules WHERE id = ?')
      .get(scheduleId);

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
  const scheduleId = Number(params.id);

  // Delete generated events first (cascade would handle it, but be explicit)
  db.prepare(
    "DELETE FROM events WHERE schedule_id = ? AND source = 'generated'"
  ).run(scheduleId);

  db.prepare('DELETE FROM schedules WHERE id = ?').run(scheduleId);
  return NextResponse.json({ ok: true });
}
