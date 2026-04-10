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

  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const memberId = searchParams.get('memberId');
  const source = searchParams.get('source');

  const db = getDb();
  let query = `
    SELECT e.*,
      GROUP_CONCAT(em.member_id ORDER BY em.member_id) as member_ids_str
    FROM events e
    LEFT JOIN event_members em ON em.event_id = e.id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (start) { query += ' AND e.start_datetime >= ?'; params.push(start); }
  if (end) { query += ' AND e.start_datetime < ?'; params.push(end); }
  if (source) { query += ' AND e.source = ?'; params.push(source); }
  if (memberId) {
    query += ` AND e.id IN (
      SELECT event_id FROM event_members WHERE member_id = ?
    )`;
    params.push(Number(memberId));
  }

  query += ' GROUP BY e.id ORDER BY e.start_datetime';

  const rows = db.prepare(query).all(...params);
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: 'Ikke autorisert' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const {
      title, description, category, start_datetime, end_datetime,
      all_day, location, color_override, member_ids,
    } = body;

    if (!title || !start_datetime || !end_datetime) {
      return NextResponse.json({ error: 'Manglende felter' }, { status: 400 });
    }

    const db = getDb();
    const result = db.prepare(`
      INSERT INTO events
        (title, description, category, start_datetime, end_datetime,
         all_day, location, color_override, source, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual', datetime('now'))
    `).run(
      title,
      description || null,
      category || 'other',
      start_datetime,
      end_datetime,
      all_day ? 1 : 0,
      location || null,
      color_override || null
    );

    const eventId = Number(result.lastInsertRowid);

    // Link members
    if (Array.isArray(member_ids)) {
      const ins = db.prepare(
        'INSERT OR IGNORE INTO event_members (event_id, member_id) VALUES (?, ?)'
      );
      for (const mid of member_ids) {
        ins.run(eventId, mid);
      }
    }

    const created = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Serverfeil' }, { status: 500 });
  }
}
