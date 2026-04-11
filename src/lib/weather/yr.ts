import { WeatherData, CurrentWeather, DailyForecast } from '@/types';

const USER_AGENT =
  'FamilyCalendar/1.0 https://github.com/family-calendar contact@example.com';

interface WeatherCache {
  data: WeatherData;
  fetchedAt: number;
}

// Multi-location cache keyed by "lat,lon"
const cache = new Map<string, WeatherCache>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface YrTimeseries {
  time: string;
  data: {
    instant: {
      details: {
        air_temperature: number;
        wind_speed: number;
        relative_humidity?: number;
      };
    };
    next_1_hours?: {
      summary: { symbol_code: string };
      details: { precipitation_amount: number };
    };
    next_6_hours?: {
      summary: { symbol_code: string };
      details: {
        precipitation_amount: number;
        air_temperature_min: number;
        air_temperature_max: number;
      };
    };
    next_12_hours?: {
      summary: { symbol_code: string };
    };
  };
}

export async function fetchWeather(
  lat: string,
  lon: string,
  locationName: string
): Promise<WeatherData | null> {
  const cacheKey = `${lat},${lon}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);

  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      next: { revalidate: 600 },
    });

    if (!res.ok) {
      console.error(`Yr.no API error: ${res.status} ${res.statusText}`);
      return cached?.data ?? null;
    }

    const json = await res.json();
    const timeseries: YrTimeseries[] = json.properties.timeseries;

    if (!timeseries || timeseries.length === 0) return null;

    // Current: use first entry
    const first = timeseries[0];
    const current: CurrentWeather = {
      temperature: Math.round(first.data.instant.details.air_temperature),
      symbol:
        first.data.next_1_hours?.summary.symbol_code ||
        first.data.next_6_hours?.summary.symbol_code ||
        'cloudy',
      wind_speed: Math.round(first.data.instant.details.wind_speed),
      precipitation:
        first.data.next_1_hours?.details.precipitation_amount ?? 0,
    };

    // Daily forecast for 7 days — use UTC dates to match the timeseries format
    const daily: DailyForecast[] = [];
    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const day = new Date(todayUtc);
      day.setUTCDate(todayUtc.getUTCDate() + i);
      const dateStr = day.toISOString().split('T')[0]; // always YYYY-MM-DD in UTC

      const entries = timeseries.filter((e) => e.time.startsWith(dateStr));
      if (entries.length === 0) continue;

      const temps = entries.map((e) => e.data.instant.details.air_temperature);

      // Prefer noon entry for representative symbol/min/max
      const noonEntry =
        entries.find((e) => e.time.includes('T12:00')) ||
        entries.find((e) => e.data.next_6_hours) ||
        entries[0];

      const symbol =
        noonEntry.data.next_6_hours?.summary.symbol_code ||
        noonEntry.data.next_1_hours?.summary.symbol_code ||
        noonEntry.data.next_12_hours?.summary.symbol_code ||
        'cloudy';

      const totalPrecip = entries.reduce(
        (sum, e) =>
          sum + (e.data.next_1_hours?.details.precipitation_amount ?? 0),
        0
      );

      daily.push({
        date: dateStr,
        min_temp: Math.round(Math.min(...temps)),
        max_temp: Math.round(Math.max(...temps)),
        symbol,
        precipitation: Math.round(totalPrecip * 10) / 10,
      });
    }

    const data: WeatherData = { location: locationName, current, daily };
    cache.set(cacheKey, { data, fetchedAt: now });
    return data;
  } catch (err) {
    console.error('Error fetching weather from yr.no:', err);
    return cached?.data ?? null;
  }
}
