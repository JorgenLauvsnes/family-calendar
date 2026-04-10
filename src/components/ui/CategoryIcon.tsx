import {
  Briefcase,
  BookOpen,
  Baby,
  Dumbbell,
  Music,
  PartyPopper,
  Moon,
  Trophy,
  Stethoscope,
  Cake,
  Plane,
  CalendarDays,
  type LucideIcon,
} from 'lucide-react';
import { EventCategory } from '@/types';

const ICONS: Record<EventCategory, LucideIcon> = {
  work:         Briefcase,
  school:       BookOpen,
  kindergarten: Baby,
  workout:      Dumbbell,
  music:        Music,
  party:        PartyPopper,
  sleepover:    Moon,
  sports:       Trophy,
  doctor:       Stethoscope,
  birthday:     Cake,
  vacation:     Plane,
  other:        CalendarDays,
};

interface Props {
  category: EventCategory | string;
  size?: number;
  className?: string;
}

export default function CategoryIcon({ category, size = 14, className }: Props) {
  const Icon: LucideIcon = ICONS[category as EventCategory] ?? CalendarDays;
  return <Icon size={size} className={className} />;
}
