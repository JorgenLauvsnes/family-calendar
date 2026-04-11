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
            wakeLock: { request: (type: string) => Promise<WakeLockSentinel> };
          }
        ).wakeLock.request('screen');
      } catch {
        // Not available or denied
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

  const { day: todayDay, date: todayDate } = formatNorwegianDate(now);
  const timeStr = now.toLocaleTimeString('nb-NO', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#060c18] text-slate-400">
        <div className="text-center">
          <div className="text-4xl mb-4">📅</div>
          <div>Laster kalender…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#060c18] text-white select-none">

      {/* ── BACKGROUND DECORATIONS ──────────────────────────── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {/* Blob top-left — blue */}
        <div
          className="blob-1 absolute -top-48 -left-48 w-[700px] h-[700px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 65%)' }}
        />
        {/* Blob bottom-right — purple */}
        <div
          className="blob-2 absolute -bottom-48 -right-48 w-[750px] h-[750px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 65%)' }}
        />
        {/* Blob center — teal accent */}
        <div
          className="blob-3 absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[350px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(20,184,166,0.07) 0%, transparent 70%)' }}
        />
        {/* Subtle dot/star pattern */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(rgba(148,163,184,0.09) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        {/* Horizontal glow line below header */}
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(59,130,246,0.4) 40%, rgba(139,92,246,0.4) 60%, transparent 100%)' }}
        />
      </div>

      {/* ── HEADER ──────────────────────────────────────────── */}
      <header
        className="relative z-10 flex-none flex items-center justify-between px-8 py-4 border-b border-white/[0.08]"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.02) 100%)',
          backdropFilter: 'blur(16px)',
        }}
      >
        {/* Left: family name + date */}
        <div className="min-w-[200px]">
          <div
            className="text-xs font-bold tracking-[0.25em] uppercase mb-0.5"
            style={{ color: 'rgba(147,197,253,0.8)' }}
          >
            {data.familyName}
          </div>
          <div className="text-slate-300 text-sm font-medium">
            <span
              className="font-bold"
              style={{ color: '#93c5fd' }}
            >
              {todayDay}
            </span>
            &nbsp;{todayDate}
          </div>
        </div>

        {/* Center: clock */}
        <div className="text-center">
          <div
            className="text-6xl font-bold tracking-tight tabular-nums leading-none text-white"
            style={{ textShadow: '0 0 40px rgba(59,130,246,0.5), 0 0 80px rgba(59,130,246,0.2)' }}
          >
            {timeStr}
          </div>
        </div>

        {/* Right: weather */}
        <div className="min-w-[200px] flex justify-end">
          <WeatherWidget weather={data.weather} vacationMode={data.vacationMode} />
        </div>
      </header>

      {/* ── CALENDAR GRID ───────────────────────────────────── */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        {data.days.map((day, i) => (
          <DayColumn
            key={day.date}
            day={day}
            forecast={
              day.forecast ??
              data.weather?.daily.find((f) => f.date === day.date)
            }
            isToday={i === 0}
          />
        ))}
      </div>

      {/* ── FOOTER — person legend ───────────────────────────── */}
      <footer
        className="relative z-10 flex-none flex items-center justify-center gap-3 px-6 py-2.5 border-t border-white/[0.06]"
        style={{
          background: 'rgba(0,0,0,0.35)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {data.members.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 transition-all"
            style={{ backgroundColor: `${m.color}1a` }}
          >
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{
                backgroundColor: m.color,
                boxShadow: `0 0 6px ${m.color}88`,
              }}
            />
            <span className="text-slate-300 text-sm font-medium leading-none">
              {m.name}
            </span>
          </div>
        ))}
      </footer>
    </div>
  );
}
