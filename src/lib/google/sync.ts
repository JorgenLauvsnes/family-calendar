import { google, calendar_v3 } from 'googleapis';
import { getDb } from '@/lib/db';
import { getOAuth2Client, decryptToken, encryptToken } from './oauth';
import { EventCategory } from '@/types';

// Per-member in-flight refresh promise to prevent race conditions
const refreshPromises = new Map<number, Promise<void>>();

async function getAuthedClient(memberId: number) {
  const db = getDb();
  const tokenRow = db
    .prepare('SELECT * FROM google_tokens WHERE member_id = ?')
    .get(memberId) as
    | {
        access_token: string;
        refresh_token: string;
        expires_at: string;
      }
    | undefined;

  if (!tokenRow) return null;

  const client = getOAuth2Client();
  client.setCredentials({
    access_token: decryptToken(tokenRow.access_token),
    refresh_token: decryptToken(tokenRow.refresh_token),
    expiry_date: new Date(tokenRow.expires_at).getTime(),
  });

  // Persist refreshed tokens
  client.on('tokens', (tokens) => {
    const updates: [string, string][] = [];
    if (tokens.access_token) {
      updates.push(['access_token', encryptToken(tokens.access_token)]);
    }
    if (tokens.expiry_date) {
      updates.push([
        'expires_at',
        new Date(tokens.expiry_date).toISOString(),
      ]);
    }
    if (updates.length > 0) {
      for (const [field, value] of updates) {
        db.prepare(
          `UPDATE google_tokens SET ${field} = ?, updated_at = datetime('now') WHERE member_id = ?`
        ).run(value, memberId);
      }
    }
  });

  return client;
}

function detectCategory(title: string, desc: string): EventCategory {
  const text = `${title} ${desc}`.toLowerCase();
  if (/\b(jobb|work|kontor|office|møte|meeting|arbeid)\b/.test(text))
    return 'work';
  if (/\b(skole|school|klasse|sfo|undervisning)\b/.test(text))
    return 'school';
  if (/\b(bhg|barnehage|kindergarten)\b/.test(text)) return 'kindergarten';
  if (
    /\b(trening|workout|gym|løping|running|fotball|håndball|svøm|sykkel|idrett)\b/.test(
      text
    )
  )
    return 'workout';
  if (/\b(musikk|music|piano|gitar|sang|kor|konsert|korps)\b/.test(text))
    return 'music';
  if (/\b(fest|party|selskap|bursdag|julebord|feiring)\b/.test(text))
    return 'party';
  if (/\b(overnatting|sleepover|pyjamas|besøk.*natt)\b/.test(text))
    return 'sleepover';
  if (/\b(lege|tann|doktor|sykehus|helsesjøke|vaksin)\b/.test(text))
    return 'doctor';
  if (/\b(bursdag|birthday|fyller)\b/.test(text)) return 'birthday';
  if (/\b(ferie|vacation|reise|tur|fly|hotell)\b/.test(text))
    return 'vacation';
  if (/\b(sport|turnering|kamp|løp|stevne)\b/.test(text)) return 'sports';
  return 'other';
}

export async function syncMemberCalendar(memberId: number): Promise<void> {
  // Deduplicate concurrent syncs for the same member
  if (refreshPromises.has(memberId)) {
    return refreshPromises.get(memberId);
  }

  const promise = doSync(memberId).finally(() => {
    refreshPromises.delete(memberId);
  });
  refreshPromises.set(memberId, promise);
  return promise;
}

async function doSync(memberId: number): Promise<void> {
  const client = await getAuthedClient(memberId);
  if (!client) return;

  const db = getDb();
  const memberRow = db
    .prepare('SELECT gcal_calendar_id FROM members WHERE id = ?')
    .get(memberId) as { gcal_calendar_id: string | null } | undefined;

  const calendarId = memberRow?.gcal_calendar_id || 'primary';
  const calendar = google.calendar({ version: 'v3', auth: client });

  const timeMin = new Date();
  timeMin.setDate(timeMin.getDate() - 1);
  const timeMax = new Date();
  timeMax.setDate(timeMax.getDate() + 60);

  type GcalEvent = calendar_v3.Schema$Event;
  let allItems: GcalEvent[] = [];
  let pageToken: string | undefined;

  do {
    const res = await calendar.events.list({
      calendarId,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
      pageToken,
    });
    allItems = allItems.concat(res.data.items ?? []);
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  // Delete existing Google events for this member in the range
  const existingGcalIds = db
    .prepare(
      `SELECT DISTINCT e.id, e.gcal_event_id FROM events e
       JOIN event_members em ON em.event_id = e.id
       WHERE e.source = 'google' AND em.member_id = ?`
    )
    .all(memberId) as { id: number; gcal_event_id: string }[];

  const incomingIds = new Set(
    allItems
      .filter((item: GcalEvent) => item.status !== 'cancelled')
      .map((item: GcalEvent) => item.id)
      .filter(Boolean)
  );

  // Remove events no longer present in Google Calendar
  for (const row of existingGcalIds) {
    if (!incomingIds.has(row.gcal_event_id)) {
      db.prepare('DELETE FROM events WHERE id = ?').run(row.id);
    }
  }

  // Upsert incoming events
  const upsertEvent = db.prepare(`
    INSERT INTO events
      (title, description, category, start_datetime, end_datetime, all_day, location, source, gcal_event_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'google', ?, datetime('now'))
    ON CONFLICT(gcal_event_id) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      category = excluded.category,
      start_datetime = excluded.start_datetime,
      end_datetime = excluded.end_datetime,
      all_day = excluded.all_day,
      location = excluded.location,
      updated_at = datetime('now')
  `);

  // Need a unique constraint on gcal_event_id for ON CONFLICT — handled below
  const insertMember = db.prepare(
    'INSERT OR IGNORE INTO event_members (event_id, member_id) VALUES (?, ?)'
  );

  // Ensure unique constraint exists
  try {
    db.exec(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_events_gcal_unique ON events(gcal_event_id) WHERE gcal_event_id IS NOT NULL'
    );
  } catch {
    // Index may already exist
  }

  for (const item of allItems) {
    if (!item.summary || item.status === 'cancelled') continue;

    const startRaw = item.start?.dateTime || item.start?.date;
    const endRaw = item.end?.dateTime || item.end?.date;
    if (!startRaw || !endRaw) continue;

    const isAllDay = !!item.start?.date && !item.start?.dateTime;

    // Normalise all-day to midnight ISO
    const startDt = isAllDay ? `${startRaw}T00:00:00` : startRaw;
    const endDt = isAllDay ? `${endRaw}T00:00:00` : endRaw;

    const category = detectCategory(
      item.summary,
      item.description || ''
    );

    upsertEvent.run(
      item.summary,
      item.description || null,
      category,
      startDt,
      endDt,
      isAllDay ? 1 : 0,
      item.location || null,
      item.id
    );

    const eventRow = db
      .prepare(
        'SELECT id FROM events WHERE gcal_event_id = ?'
      )
      .get(item.id) as { id: number } | undefined;

    if (eventRow) {
      insertMember.run(eventRow.id, memberId);
    }
  }

  // Update sync timestamp on member row
  db.prepare(
    "UPDATE members SET updated_at = datetime('now') WHERE id = ?"
  ).run(memberId);
}

export async function syncAllConnectedMembers(): Promise<void> {
  const db = getDb();
  const memberIds = db
    .prepare('SELECT member_id FROM google_tokens')
    .all() as { member_id: number }[];

  await Promise.allSettled(
    memberIds.map((row) => syncMemberCalendar(row.member_id))
  );
}
