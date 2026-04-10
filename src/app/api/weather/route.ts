import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { fetchWeather } from '@/lib/weather/yr';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getDb();
  const settingsRows = db
    .prepare(
      "SELECT key, value FROM settings WHERE key IN ('weather_lat','weather_lon','weather_location','vacation_mode','vacation_lat','vacation_lon','vacation_location')"
    )
    .all() as { key: string; value: string }[];

  const s: Record<string, string> = {};
  for (const { key, value } of settingsRows) s[key] = value;

  const vacation = s['vacation_mode'] === '1';
  const lat = vacation
    ? s['vacation_lat'] || s['weather_lat']
    : s['weather_lat'];
  const lon = vacation
    ? s['vacation_lon'] || s['weather_lon']
    : s['weather_lon'];
  const location = vacation
    ? s['vacation_location'] || s['weather_location']
    : s['weather_location'];

  const data = lat && lon
    ? await fetchWeather(lat, lon, location)
    : null;

  return NextResponse.json(data);
}
