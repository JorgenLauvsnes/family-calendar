import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { getDb } from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import { generateEventsForSchedule } from '@/lib/schedule/generator';

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
  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get('memberId');

  const db = getDb();
  let rows;
  if (memberId) {
    rows = db
      .prepare(
        'SELECT * FROM schedules WHERE member_id = ? ORDER BY day_of_week, start_time'
      )
      .all(Number(memberId));
  } else {
    rows = db
      .prepare('SELECT * FROM schedules ORDER BY member_id, day_of_week, start_time')
      .all();
  }
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const {
      member_id, label, day_of_week, start_time, end_time,
      location, category, active, valid_from, valid_until,
    } = body;

    if (
      !member_id ||
      !label ||
      day_of_week === undefined ||
      !start_time ||
      !end_time
    ) {
      return NextResponse.json({ error: 'Manglende felter' }, { status: 400 });
    }

    const db = getDb();
    const result = db.prepare(`
      INSERT INTO schedules
        (member_id, label, day_of_week, start_time, end_time,
         location, category, active, valid_from, valid_until, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      member_id, label, day_of_week, start_time, end_time,
      location || null,
      category || 'work',
      active !== false ? 1 : 0,
      valid_from || null,
      valid_until || null
    );

    const scheduleId = Number(result.lastInsertRowid);

    // Generate events for this new schedule
    generateEventsForSchedule(scheduleId);

    const created = db
      .prepare('SELECT * FROM schedules WHERE id = ?')
      .get(scheduleId);

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Serverfeil' }, { status: 500 });
  }
}
