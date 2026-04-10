import { DisplayDay } from '@/types';
import { format, parseISO, isToday } from 'date-fns';
import { nb } from 'date-fns/locale';
import { DailyForecast } from '@/types';
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
      className={`flex flex-col h-full border-r border-slate-800/60 ${
        today
          ? 'bg-slate-800/80 flex-none w-[30%] min-w-[280px]'
          : 'flex-1 bg-transparent'
      }`}
    >
      {/* Day header */}
      <div
        className={`flex-none px-3 py-2 border-b border-slate-800 ${
          today ? 'pt-3' : ''
        }`}
      >
        <div
          className={`font-bold tracking-widest ${
            today
              ? 'text-blue-400 text-base'
              : 'text-slate-500 text-xs'
          }`}
        >
          {today ? '▶ ' : ''}{dayName}
        </div>
        <div
          className={`font-bold text-white ${
            today ? 'text-3xl mt-0.5' : 'text-sm mt-0'
          }`}
        >
          {dateNum}
        </div>

        {/* Weather forecast for this day */}
        {forecast && (
          <div
            className={`flex items-center gap-1 mt-1 ${
              today ? 'text-sm' : 'text-xs'
            } text-slate-400`}
          >
            <span>{weatherEmoji(forecast.symbol)}</span>
            <span>
              {forecast.max_temp}° / {forecast.min_temp}°
            </span>
            {forecast.precipitation > 0 && (
              <span className="text-blue-400">
                💧{forecast.precipitation}mm
              </span>
            )}
          </div>
        )}
      </div>

      {/* Events */}
      <div
        className={`flex-1 overflow-y-auto ${
          today ? 'p-3 space-y-2' : 'p-1.5 space-y-1.5'
        }`}
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}
      >
        {hasEvents ? (
          day.events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              compact={!today}
            />
          ))
        ) : (
          <div
            className={`text-center py-4 text-slate-700 ${
              today ? 'text-sm' : 'text-xs'
            }`}
          >
            {today ? 'Ingen hendelser i dag' : '—'}
          </div>
        )}
      </div>
    </div>
  );
}
