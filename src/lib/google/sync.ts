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
  if (/\b(jobb|work|kontor|office|møte|meeting|arbeid)\b/.test(text)) return 'work';
  if (/\b(skole|school|klasse|sfo|undervisning)\b/.test(text)) return 'school';
  if (/\b(bhg|barnehage|kindergarten)\b/.test(text)) return 'kindergarten';
  if (/\b(trening|workout|gym|løping|running|fotball|håndball|svøm|sykkel|idrett)\b/.test(text)) return 'workout';
  if (/\b(musikk|music|piano|gitar|sang|kor|konsert|korps)\b/.test(text)) return 'music';
  if (/\b(fest|party|selskap|julebord|feiring)\b/.test(text)) return 'party';
  if (/\b(overnatting|sleepover|pyjamas|besøk.*natt)\b/.test(text)) return 'sleepover';
  if (/\b(lege|tann|doktor|sykehus|helsesjøke|vaksin)\b/.test(text)) return 'doctor';
  if (/\b(bursdag|birthday|fyller)\b/.test(text)) return 'birthday';
  if (/\b(ferie|vacation|reise|tur|fly|hotell)\b/.test(text)) return 'vacation';
  if (/\b(sport|turnering|kamp|løp|stevne)\b/.test(text)) return 'sports';
  return 'other';
}

/** Normalize a string for tag matching: lowercase + map Norwegian chars to ASCII */
function normalizeTag(str: string): string {
  return str
    .toLowerCase()
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .replace(/å/g, 'a')
    .replace(/\s+/g, '');
}

/** Extract hashtag values from text, returning lowercase tag names (without #) */
function extractTags(text: string): string[] {
  // Match # followed by word chars and Unicode letters (handles Norwegian etc.)
  const matches = text.match(/#([\w\u00C0-\u024F]+)/gi) ?? [];
  return matches.map((t) => t.slice(1).toLowerCase());
}

/** Return member IDs this event should be linked to, based on hashtags in the text */
export function resolveTargetMembers(
  tags: string[],
  allMembers: { id: number; name: string }[]
): number[] {
  const ids = new Set<number>();

  for (const tag of tags) {
    // #familie or #alle → all family members
    if (tag === 'familie' || tag === 'alle') {
      return allMembers.map((m) => m.id);
    }

    // Match against each member's first name and full name
    for (const member of allMembers) {
      const firstName = member.name.split(' ')[0];
      if (
        firstName.toLowerCase() === tag ||
        member.name.toLowerCase() === tag ||
        normalizeTag(firstName) === normalizeTag(tag) ||
        normalizeTag(member.name) === normalizeTag(tag)
      ) {
        ids.add(member.id);
      }
    }
  }

  return [...ids];
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

  // Load all family members for tag resolution (tags can route to any member)
  const allMembers = db
    .prepare('SELECT id, name FROM members')
    .all() as { id: number; name: string }[];

  // Pre-filter: only events with recognized family hashtags get imported
  const taggedItems = allItems.filter((item) => {
    if (!item.summary || item.status === 'cancelled') return false;
    const tags = extractTags(`${item.summary} ${item.description ?? ''}`);
    return resolveTargetMembers(tags, allMembers).length > 0;
  });

  const incomingIds = new Set(
    taggedItems.map((item) => item.id).filter(Boolean)
  );

  // Get existing Google-sourced events for this member
  const existingGcalIds = db
    .prepare(
      `SELECT DISTINCT e.id, e.gcal_event_id FROM events e
       JOIN event_members em ON em.event_id = e.id
       WHERE e.source = 'google' AND em.member_id = ?`
    )
    .all(memberId) as { id: number; gcal_event_id: string }[];

  // Remove events that are no longer in Google Calendar or no longer tagged
  for (const row of existingGcalIds) {
    if (!incomingIds.has(row.gcal_event_id)) {
      db.prepare('DELETE FROM events WHERE id = ?').run(row.id);
    }
  }

  // Ensure unique constraint on gcal_event_id
  try {
    db.exec(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_events_gcal_unique ON events(gcal_event_id) WHERE gcal_event_id IS NOT NULL'
    );
  } catch {
    // Index already exists
  }

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

  const insertMember = db.prepare(
    'INSERT OR IGNORE INTO event_members (event_id, member_id) VALUES (?, ?)'
  );

  for (const item of taggedItems) {
    if (!item.summary) continue;

    const startRaw = item.start?.dateTime || item.start?.date;
    const endRaw = item.end?.dateTime || item.end?.date;
    if (!startRaw || !endRaw) continue;

    const isAllDay = !!item.start?.date && !item.start?.dateTime;
    const startDt = isAllDay ? `${startRaw}T00:00:00` : startRaw;
    const endDt = isAllDay ? `${endRaw}T00:00:00` : endRaw;

    const category = detectCategory(item.summary, item.description ?? '');

    upsertEvent.run(
      item.summary,
      item.description ?? null,
      category,
      startDt,
      endDt,
      isAllDay ? 1 : 0,
      item.location ?? null,
      item.id
    );

    const eventRow = db
      .prepare('SELECT id FROM events WHERE gcal_event_id = ?')
      .get(item.id) as { id: number } | undefined;

    if (eventRow) {
      // Replace member links with the set resolved from current tags
      const tags = extractTags(`${item.summary} ${item.description ?? ''}`);
      const targetMemberIds = resolveTargetMembers(tags, allMembers);

      db.prepare('DELETE FROM event_members WHERE event_id = ?').run(eventRow.id);
      for (const tid of targetMemberIds) {
        insertMember.run(eventRow.id, tid);
      }
    }
  }

  // Update sync timestamp
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
