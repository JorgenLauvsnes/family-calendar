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

    // ── Weather location logic ──────────────────────────────────────
    const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: TIMEZONE }); // YYYY-MM-DD

    const vacStart = settings['vacation_start'];
    const vacEnd   = settings['vacation_end'];

    // Is today itself a vacation day? (drives header weather + FERIE badge)
    const vacationToday =
      vacStart && vacEnd
        ? todayStr >= vacStart && todayStr <= vacEnd
        : settings['vacation_mode'] === '1';

    const homeLat      = settings['weather_lat'];
    const homeLon      = settings['weather_lon'];
    const homeLocation = settings['weather_location'];
    const vacLat       = settings['vacation_lat'] || homeLat;
    const vacLon       = settings['vacation_lon'] || homeLon;
    const vacLocation  = settings['vacation_location'] || homeLocation;

    // Only fetch vacation weather when there are coordinates and a period defined
    const hasVacationSetup = !!(
      settings['vacation_lat'] &&
      settings['vacation_lon'] &&
      (vacStart || settings['vacation_mode'] === '1')
    );

    // Fetch both locations in parallel to avoid sequential waiting
    const [homeWeather, vacWeather] = await Promise.all([
      homeLat && homeLon
        ? fetchWeather(homeLat, homeLon, homeLocation)
        : Promise.resolve(null),
      hasVacationSetup
        ? fetchWeather(vacLat, vacLon, vacLocation)
        : Promise.resolve(null),
    ]);

    // Header weather reflects today's location
    const headerWeather = vacationToday ? (vacWeather ?? homeWeather) : homeWeather;

    // ── Members ─────────────────────────────────────────────────────
    const members = db
      .prepare('SELECT id, name, color, avatar_initials FROM members ORDER BY id')
      .all() as { id: number; name: string; color: string; avatar_initials: string | null }[];

    // ── 7-day window ─────────────────────────────────────────────────
    const todayDate = startOfDay(new Date());
    const memberMap = new Map(members.map((m) => [m.id, m]));
    const days: DisplayDay[] = [];

    for (let i = 0; i < 7; i++) {
      const day = addDays(todayDate, i);
      const dateStr  = formatInTimeZone(day, TIMEZONE, 'yyyy-MM-dd');
      const startIso = formatInTimeZone(day, TIMEZONE, "yyyy-MM-dd'T'00:00:00xxx");
      const endDay   = addDays(day, 1);
      const endIso   = formatInTimeZone(endDay, TIMEZONE, "yyyy-MM-dd'T'00:00:00xxx");

      // Fetch events for this day
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

      // Per-day forecast: pick vacation or home weather based on whether this
      // specific date falls within the vacation period
      const isDayVacation =
        vacStart && vacEnd
          ? dateStr >= vacStart && dateStr <= vacEnd
          : vacationToday; // fallback: if no dates, mirror today's status

      const dayWeatherSource = isDayVacation ? (vacWeather ?? homeWeather) : homeWeather;
      const forecast = dayWeatherSource?.daily.find((f) => f.date === dateStr);

      days.push({ date: dateStr, events, forecast });
    }

    const payload: DisplayPayload = {
      familyName: settings['family_name'] || 'Familien',
      generatedAt: new Date().toISOString(),
      members,
      days,
      weather: headerWeather,
      vacationMode: vacationToday,
    };

    return NextResponse.json(payload);
  } catch (err) {
    console.error('Display route error:', err);
    return NextResponse.json({ error: 'Serverfeil' }, { status: 500 });
  }
}
