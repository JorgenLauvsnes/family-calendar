import { getDb } from '@/lib/db';
import { Schedule } from '@/types';
import { formatInTimeZone } from 'date-fns-tz';
import { addDays, startOfDay } from 'date-fns';

const TIMEZONE = 'Europe/Oslo';
const WINDOW_DAYS = 90;

/**
 * Maps JS getDay() (0=Sun) to our schedule day_of_week (0=Sun).
 * Both use the same convention so no mapping needed.
 */

function toOsloDateString(date: Date): string {
  return formatInTimeZone(date, TIMEZONE, 'yyyy-MM-dd');
}

function toOsloIso(date: Date, timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const dateStr = toOsloDateString(date);
  // Build a date string and format with offset
  const combined = new Date(`${dateStr}T${timeStr}:00`);
  // Use formatInTimeZone to get proper ISO with offset
  return formatInTimeZone(
    new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, 0),
    TIMEZONE,
    "yyyy-MM-dd'T'HH:mm:ssxxx"
  );
}

export function generateEventsForSchedule(scheduleId: number): void {
  const db = getDb();

  const schedule = db
    .prepare('SELECT * FROM schedules WHERE id = ?')
    .get(scheduleId) as Schedule | undefined;

  if (!schedule || !schedule.active) return;

  const today = startOfDay(new Date());
  const windowEnd = addDays(today, WINDOW_DAYS);

  // Delete existing generated events for this schedule in the window
  db.prepare(
    `DELETE FROM events WHERE schedule_id = ? AND start_datetime >= ?`
  ).run(scheduleId, toOsloIso(today, '00:00'));

  const insertEvent = db.prepare(`
    INSERT OR IGNORE INTO events
      (title, description, category, start_datetime, end_datetime,
       all_day, location, source, schedule_id, updated_at)
    VALUES (?, NULL, ?, ?, ?, 0, ?, 'generated', ?, datetime('now'))
  `);

  const insertMember = db.prepare(
    'INSERT OR IGNORE INTO event_members (event_id, member_id) VALUES (?, ?)'
  );

  let current = new Date(today);

  while (current < windowEnd) {
    const jsDay = current.getDay(); // 0=Sun, 1=Mon, ... 6=Sat

    if (jsDay === schedule.day_of_week) {
      const dateStr = toOsloDateString(current);

      // Check valid_from / valid_until
      if (schedule.valid_from && dateStr < schedule.valid_from) {
        current = addDays(current, 1);
        continue;
      }
      if (schedule.valid_until && dateStr > schedule.valid_until) {
        current = addDays(current, 1);
        continue;
      }

      const startDt = toOsloIso(current, schedule.start_time);
      const endDt = toOsloIso(current, schedule.end_time);

      insertEvent.run(
        schedule.label,
        schedule.category,
        startDt,
        endDt,
        schedule.location,
        scheduleId
      );

      const eventRow = db
        .prepare(
          'SELECT id FROM events WHERE schedule_id = ? AND start_datetime = ?'
        )
        .get(scheduleId, startDt) as { id: number } | undefined;

      if (eventRow) {
        insertMember.run(eventRow.id, schedule.member_id);
      }
    }

    current = addDays(current, 1);
  }
}

export function regenerateAllSchedules(): void {
  const db = getDb();
  const schedules = db
    .prepare('SELECT id FROM schedules WHERE active = 1')
    .all() as { id: number }[];

  for (const { id } of schedules) {
    generateEventsForSchedule(id);
  }
}

export function extendScheduleWindowIfNeeded(): void {
  const db = getDb();

  // Check if generated events exist 85+ days ahead
  const horizon = addDays(new Date(), WINDOW_DAYS - 5);
  const horizonIso = formatInTimeZone(horizon, TIMEZONE, "yyyy-MM-dd'T'00:00:00xxx");

  const futureRow = db
    .prepare(
      `SELECT 1 FROM events WHERE source = 'generated' AND start_datetime >= ? LIMIT 1`
    )
    .get(horizonIso);

  if (!futureRow) {
    // Window has shrunk — regenerate
    regenerateAllSchedules();
  }
}
