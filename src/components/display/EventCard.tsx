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
      className={`rounded-lg border-l-[3px] overflow-hidden ${compact ? 'p-1.5' : 'p-2.5'}`}
      style={{
        borderLeftColor: primaryColor,
        background: `linear-gradient(135deg, ${primaryColor}28 0%, ${primaryColor}10 100%)`,
        boxShadow: `0 1px 3px rgba(0,0,0,0.3), inset 0 0 0 1px ${primaryColor}18`,
      }}
    >
      {/* Time + category row */}
      <div
        className={`flex items-center gap-1.5 mb-0.5 ${compact ? 'text-[10px]' : 'text-xs'}`}
        style={{ color: 'rgba(148,163,184,0.7)' }}
      >
        <CategoryIcon
          category={event.category}
          size={compact ? 10 : 12}
          className="flex-shrink-0"
          style={{ color: `${primaryColor}bb` }}
        />
        <span className="font-mono tracking-tight">{timeLabel}</span>
      </div>

      {/* Title */}
      <div
        className={`font-semibold leading-tight truncate ${compact ? 'text-[11px]' : 'text-sm'}`}
        style={{ color: 'rgba(241,245,249,0.95)' }}
        title={event.title}
      >
        {event.title}
      </div>

      {/* Description — full view only */}
      {!compact && event.description && (
        <div
          className="text-xs truncate mt-0.5"
          style={{ color: 'rgba(148,163,184,0.6)' }}
        >
          {event.description}
        </div>
      )}

      {/* Location — full view only */}
      {!compact && event.location && (
        <div
          className="text-xs truncate mt-0.5"
          style={{ color: 'rgba(100,116,139,0.7)' }}
        >
          📍 {event.location}
        </div>
      )}

      {/* Member avatar dots */}
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
                  compact ? 'w-4 h-4 text-[8px]' : 'w-5 h-5 text-[10px]'
                }`}
                style={{
                  backgroundColor: color,
                  boxShadow: `0 0 0 1px rgba(0,0,0,0.3), 0 0 4px ${color}55`,
                }}
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
