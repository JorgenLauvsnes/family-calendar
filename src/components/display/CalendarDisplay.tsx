'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { DisplayPayload } from '@/types';
import DayColumn from './DayColumn';
import WeatherWidget from './WeatherWidget';

const NO_DAYS = [
  'Søndag', 'Mandag', 'Tirsdag', 'Onsdag',
  'Torsdag', 'Fredag', 'Lørdag',
];
const NO_MONTHS = [
  'januar', 'februar', 'mars', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'desember',
];

function formatNorwegianDate(d: Date): { day: string; date: string } {
  return {
    day: NO_DAYS[d.getDay()].toUpperCase(),
    date: `${d.getDate()}. ${NO_MONTHS[d.getMonth()]} ${d.getFullYear()}`,
  };
}

interface Props {
  initial: DisplayPayload | null;
}

export default function CalendarDisplay({ initial }: Props) {
  const [data, setData] = useState<DisplayPayload | null>(initial);
  const [now, setNow] = useState(new Date());
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Live clock — ticks every second
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(timer);
  }, []);

  // Fetch fresh data from the aggregated display endpoint
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/display', { cache: 'no-store' });
      if (!res.ok) return;
      const fresh: DisplayPayload = await res.json();
      setData(fresh);
    } catch (e) {
      console.error('Display data fetch failed:', e);
    }
  }, []);

  // Poll every 5 minutes
  useEffect(() => {
    // Immediate fetch if initial data is stale (>90 s)
    if (
      initial?.generatedAt &&
      Date.now() - new Date(initial.generatedAt).getTime() > 90_000
    ) {
      fetchData();
    }

    const interval = setInterval(fetchData, 5 * 60 * 1_000);
    return () => clearInterval(interval);
  }, [fetchData, initial]);

  // Wake Lock API — prevent screen sleep
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;

    const acquire = async () => {
      try {
        wakeLockRef.current = await (
          navigator as Navigator & {
            wakeLock: { request: (type: string) => Promise<WakeLockSentinel>;
          };
        }).wakeLock.request('screen');
      } catch {
        // Not available or denied — silently ignore
      }
    };

    acquire();

    const onVisible = () => {
      if (document.visibilityState === 'visible') acquire();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      wakeLockRef.current?.release().catch(() => {});
    };
  }, []);

  const todayStr = now.toISOString().split('T')[0];
  const { day: todayDay, date: todayDate } = formatNorwegianDate(now);

  const timeStr = now.toLocaleTimeString('nb-NO', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-slate-400">
        <div className="text-center">
          <div className="text-4xl mb-4">📅</div>
          <div>Laster kalender…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#080e1a] text-white select-none">
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header className="flex-none flex items-center justify-between px-6 py-3 bg-slate-900/80 border-b border-slate-800">
        {/* Left: family name + today */}
        <div>
          <div className="text-slate-500 text-xs font-medium tracking-widest uppercase">
            {data.familyName}
          </div>
          <div className="text-slate-300 text-sm font-semibold mt-0.5">
            <span className="text-blue-400">{todayDay}</span>&nbsp;
            {todayDate}
          </div>
        </div>

        {/* Center: clock */}
        <div className="text-center">
          <div className="text-5xl font-bold tracking-tight tabular-nums text-white leading-none">
            {timeStr}
          </div>
        </div>

        {/* Right: weather */}
        <WeatherWidget
          weather={data.weather}
          vacationMode={data.vacationMode}
        />
      </header>

      {/* ── CALENDAR GRID ───────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {data.days.map((day, i) => {
          const forecast = data.weather?.daily.find(
            (f) => f.date === day.date
          );
          return (
            <DayColumn
              key={day.date}
              day={day}
              forecast={forecast}
              isToday={i === 0}
            />
          );
        })}
      </div>

      {/* ── FOOTER — person legend ───────────────────────────────── */}
      <footer className="flex-none flex items-center justify-center gap-6 px-6 py-2 bg-slate-900/60 border-t border-slate-800/60">
        {data.members.map((m) => (
          <div key={m.id} className="flex items-center gap-1.5">
            <span
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: m.color }}
            />
            <span className="text-slate-300 text-sm font-medium">
              {m.name}
            </span>
          </div>
        ))}
      </footer>
    </div>
  );
}
