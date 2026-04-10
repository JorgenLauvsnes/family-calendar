import { EventCategory } from '@/types';

export interface CategoryMeta {
  label: string;      // Norwegian label
  icon: string;       // Lucide icon name
  color: string;      // Tailwind color class for badge
}

export const CATEGORY_META: Record<EventCategory, CategoryMeta> = {
  work:         { label: 'Jobb',         icon: 'Briefcase',     color: 'bg-slate-500' },
  school:       { label: 'Skole',        icon: 'BookOpen',      color: 'bg-blue-600' },
  kindergarten: { label: 'Barnehage',    icon: 'Baby',          color: 'bg-yellow-500' },
  workout:      { label: 'Trening',      icon: 'Dumbbell',      color: 'bg-green-600' },
  music:        { label: 'Musikk',       icon: 'Music',         color: 'bg-purple-600' },
  party:        { label: 'Fest',         icon: 'PartyPopper',   color: 'bg-pink-500' },
  sleepover:    { label: 'Overnatting',  icon: 'Moon',          color: 'bg-indigo-600' },
  sports:       { label: 'Sport',        icon: 'Trophy',        color: 'bg-orange-500' },
  doctor:       { label: 'Lege',         icon: 'Stethoscope',   color: 'bg-red-500' },
  birthday:     { label: 'Bursdag',      icon: 'Cake',          color: 'bg-rose-500' },
  vacation:     { label: 'Ferie',        icon: 'Plane',         color: 'bg-cyan-500' },
  other:        { label: 'Annet',        icon: 'CalendarDays',  color: 'bg-gray-500' },
};

export const ALL_CATEGORIES: EventCategory[] = Object.keys(
  CATEGORY_META
) as EventCategory[];
