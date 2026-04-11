import { DisplayDay, DailyForecast } from '@/types';
import { parseISO } from 'date-fns';
import { weatherEmoji } from '@/lib/weather/symbols';
import EventCard from './EventCard';

interface Props {
  day: DisplayDay;
  forecast?: DailyForecast;
  isToday: boolean;
}

const NO_DAYS = [
  'Søndag', 'Mandag', 'Tirsdag', 'Onsdag',
  'Torsdag', 'Fredag', 'Lørdag',
];
const NO_DAYS_SHORT = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];
const NO_MONTHS_SHORT = [
  'jan', 'feb', 'mar', 'apr', 'mai', 'jun',
  'jul', 'aug', 'sep', 'okt', 'nov', 'des',
];
const NO_MONTHS = [
  'januar', 'februar', 'mars', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'desember',
];

function formatDayHeader(dateStr: string, full: boolean) {
  const d = parseISO(dateStr);
  const day = d.getDay();
  const date = d.getDate();
  const month = d.getMonth();
  if (full) {
    return {
      dayName: NO_DAYS[day].toUpperCase(),
      dateNum: `${date}. ${NO_MONTHS[month]}`,
    };
  }
  return {
    dayName: NO_DAYS_SHORT[day].toUpperCase(),
    dateNum: `${date}. ${NO_MONTHS_SHORT[month]}`,
  };
}

export default function DayColumn({ day, forecast, isToday: today }: Props) {
  const { dayName, dateNum } = formatDayHeader(day.date, today);
  const hasEvents = day.events.length > 0;

  return (
    <div
      className={`flex flex-col h-full border-r ${
        today
          ? 'flex-none w-[29%] min-w-[260px] border-blue-400/25'
          : 'flex-1 border-white/[0.05]'
      }`}
      style={
        today
          ? {
              background:
                'linear-gradient(180deg, rgba(59,130,246,0.1) 0%, rgba(59,130,246,0.05) 40%, rgba(59,130,246,0.03) 100%)',
              boxShadow: 'inset -1px 0 0 rgba(59,130,246,0.2)',
            }
          : {
              background: 'rgba(255,255,255,0.018)',
            }
      }
    >
      {/* Day header */}
      <div
        className={`flex-none px-3 border-b ${
          today
            ? 'py-3 border-blue-400/20'
            : 'py-2 border-white/[0.06]'
        }`}
        style={
          today
            ? { background: 'rgba(59,130,246,0.1)' }
            : { background: 'rgba(255,255,255,0.02)' }
        }
      >
        {/* Day name */}
        <div
          className={`font-bold tracking-widest leading-none ${
            today ? 'text-sm mb-1' : 'text-[10px] mb-0.5'
          }`}
          style={{ color: today ? 'rgba(147,197,253,0.9)' : 'rgba(100,116,139,0.8)' }}
        >
          {today && (
            <span
              className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 mb-0.5 align-middle"
              style={{
                backgroundColor: '#3b82f6',
                boxShadow: '0 0 6px rgba(59,130,246,0.8)',
              }}
            />
          )}
          {dayName}
        </div>

        {/* Date number */}
        <div
          className={`font-bold leading-tight text-white ${
            today ? 'text-4xl' : 'text-[15px]'
          }`}
        >
          {dateNum}
        </div>

        {/* Weather forecast */}
        {forecast && (
          <div
            className={`flex items-center gap-1.5 mt-1.5 ${today ? 'text-sm' : 'text-xs'}`}
            style={{ color: 'rgba(148,163,184,0.7)' }}
          >
            <span className="text-base leading-none">{weatherEmoji(forecast.symbol)}</span>
            <span>
              <span className="text-white/70">{forecast.max_temp}°</span>
              <span className="text-white/30 mx-0.5">/</span>
              <span>{forecast.min_temp}°</span>
            </span>
            {forecast.precipitation > 0 && (
              <span style={{ color: 'rgba(96,165,250,0.7)' }}>
                💧{forecast.precipitation}mm
              </span>
            )}
          </div>
        )}
      </div>

      {/* Events list */}
      <div
        className={`flex-1 overflow-y-auto ${today ? 'p-3 space-y-2' : 'p-1.5 space-y-1.5'}`}
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(51,65,85,0.6) transparent' }}
      >
        {hasEvents ? (
          day.events.map((event) => (
            <EventCard key={event.id} event={event} compact={!today} />
          ))
        ) : (
          <div
            className={`text-center py-5 ${today ? 'text-sm' : 'text-xs'}`}
            style={{ color: 'rgba(51,65,85,0.8)' }}
          >
            {today ? 'Ingen hendelser i dag' : '—'}
          </div>
        )}
      </div>
    </div>
  );
}
