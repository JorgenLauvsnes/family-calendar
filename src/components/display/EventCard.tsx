import { DisplayEvent } from '@/types';
import CategoryIcon from '@/components/ui/CategoryIcon';
import { format, parseISO } from 'date-fns';

interface Props {
  event: DisplayEvent;
  compact?: boolean;
}

export default function EventCard({ event, compact = false }: Props) {
  const primaryColor = event.member_colors[0] ?? '#64748B';

  const formatTime = (iso: string) => {
    try {
      return format(parseISO(iso), 'HH:mm');
    } catch {
      return iso.slice(11, 16);
    }
  };

  const timeLabel = event.all_day
    ? 'Hele dagen'
    : `${formatTime(event.start_datetime)} – ${formatTime(event.end_datetime)}`;

  return (
    <div
      className={`rounded-lg border-l-4 overflow-hidden ${
        compact ? 'p-1.5' : 'p-2.5'
      }`}
      style={{
        borderLeftColor: primaryColor,
        backgroundColor: `${primaryColor}22`,
      }}
    >
      {/* Time row */}
      <div
        className={`flex items-center gap-1.5 ${
          compact ? 'text-xs' : 'text-sm'
        } text-slate-400 mb-0.5`}
      >
        <CategoryIcon
          category={event.category}
          size={compact ? 11 : 13}
          className="flex-shrink-0 text-slate-400"
        />
        <span className="font-mono">{timeLabel}</span>
      </div>

      {/* Title */}
      <div
        className={`font-semibold leading-tight text-slate-100 truncate ${
          compact ? 'text-xs' : 'text-sm'
        }`}
        title={event.title}
      >
        {event.title}
      </div>

      {/* Description — only in full view */}
      {!compact && event.description && (
        <div className="text-xs text-slate-400 truncate mt-0.5">
          {event.description}
        </div>
      )}

      {/* Location — only in full view */}
      {!compact && event.location && (
        <div className="text-xs text-slate-500 truncate mt-0.5">
          📍 {event.location}
        </div>
      )}

      {/* Person badges */}
      {event.member_names.length > 0 && (
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {event.member_colors.map((color, i) => {
            const name = event.member_names[i] ?? '';
            const initials = name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);
            return (
              <span
                key={event.member_ids[i]}
                className={`rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${
                  compact ? 'w-4 h-4 text-[9px]' : 'w-6 h-6 text-[11px]'
                }`}
                style={{ backgroundColor: color }}
                title={name}
              >
                {initials}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
