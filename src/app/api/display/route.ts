import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { fetchWeather } from '@/lib/weather/yr';
import { syncAllConnectedMembers } from '@/lib/google/sync';
import { extendScheduleWindowIfNeeded } from '@/lib/schedule/generator';
import { formatInTimeZone } from 'date-fns-tz';
import { addDays, startOfDay } from 'date-fns';
import { DisplayPayload, DisplayDay, DisplayEvent } from '@/types';

export const dynamic = 'force-dynamic';

const TIMEZONE = 'Europe/Oslo';

// Lazy Google sync — fire and forget if last sync was > 30 min ago
let lastSyncAt = 0;

function maybeSyncGoogle() {
  const intervalMs =
    parseInt(process.env.GOOGLE_SYNC_INTERVAL_MINUTES || '30') * 60 * 1000;
  if (Date.now() - lastSyncAt > intervalMs) {
    lastSyncAt = Date.now();
    syncAllConnectedMembers().catch((e) =>
      console.error('Background Google sync error:', e)
    );
  }
}

export async function GET() {
  try {
    const db = getDb();

    // Lazy maintenance
    extendScheduleWindowIfNeeded();
    maybeSyncGoogle();

    // Load settings
    const settingsRows = db
      .prepare('SELECT key, value FROM settings')
      .all() as { key: string; value: string }[];
    const settings: Record<string, string> = {};
    for (const { key, value } of settingsRows) {
      settings[key] = value;
    }

    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' }); // YYYY-MM-DD
    const vacationMode =
      (settings['vacation_start'] && settings['vacation_end'])
        ? today >= settings['vacation_start'] && today <= settings['vacation_end']
        : settings['vacation_mode'] === '1';
    const lat = vacationMode
      ? settings['vacation_lat'] || settings['weather_lat']
      : settings['weather_lat'];
    const lon = vacationMode
      ? settings['vacation_lon'] || settings['weather_lon']
      : settings['weather_lon'];
    const locationName = vacationMode
      ? settings['vacation_location'] || settings['weather_location']
      : settings['weather_location'];

    // Load members
    const members = db
      .prepare(
        'SELECT id, name, color, avatar_initials FROM members ORDER BY id'
      )
      .all() as { id: number; name: string; color: string; avatar_initials: string | null }[];

    // Build 7-day window
    const today = startOfDay(new Date());
    const days: DisplayDay[] = [];

    for (let i = 0; i < 7; i++) {
      const day = addDays(today, i);
      const dateStr = formatInTimeZone(day, TIMEZONE, 'yyyy-MM-dd');
      const startIso = formatInTimeZone(day, TIMEZONE, "yyyy-MM-dd'T'00:00:00xxx");
      const endDay = addDays(day, 1);
      const endIso = formatInTimeZone(endDay, TIMEZONE, "yyyy-MM-dd'T'00:00:00xxx");

      const rows = db
        .prepare(
          `SELECT
             e.id, e.title, e.description, e.category,
             e.start_datetime, e.end_datetime, e.all_day,
             e.location, e.source,
             GROUP_CONCAT(em.member_id ORDER BY em.member_id) as member_ids_str
           FROM events e
           JOIN event_members em ON em.event_id = e.id
           WHERE e.start_datetime >= ? AND e.start_datetime < ?
           GROUP BY e.id
           ORDER BY e.all_day DESC, e.start_datetime ASC`
        )
        .all(startIso, endIso) as Array<{
        id: number;
        title: string;
        description: string | null;
        category: string;
        start_datetime: string;
        end_datetime: string;
        all_day: number;
        location: string | null;
        source: string;
        member_ids_str: string | null;
      }>;

      const memberMap = new Map(members.map((m) => [m.id, m]));

      const events: DisplayEvent[] = rows.map((row) => {
        const memberIds = row.member_ids_str
          ? row.member_ids_str.split(',').map(Number)
          : [];
        const rowMembers = memberIds
          .map((id) => memberMap.get(id))
          .filter(Boolean) as (typeof members)[number][];

        return {
          id: row.id,
          title: row.title,
          description: row.description,
          category: row.category as DisplayEvent['category'],
          start_datetime: row.start_datetime,
          end_datetime: row.end_datetime,
          all_day: row.all_day === 1,
          location: row.location,
          source: row.source as DisplayEvent['source'],
          member_ids: memberIds,
          member_colors: rowMembers.map((m) => m.color),
          member_names: rowMembers.map((m) => m.name),
        };
      });

      days.push({ date: dateStr, events });
    }

    // Fetch weather (non-blocking — returns null on error)
    const weather = lat && lon
      ? await fetchWeather(lat, lon, locationName)
      : null;

    const payload: DisplayPayload = {
      familyName: settings['family_name'] || 'Familien',
      generatedAt: new Date().toISOString(),
      members,
      days,
      weather,
      vacationMode,
    };

    return NextResponse.json(payload);
  } catch (err) {
    console.error('Display route error:', err);
    return NextResponse.json({ error: 'Serverfeil' }, { status: 500 });
  }
}
