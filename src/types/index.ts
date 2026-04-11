export type MemberRole = 'adult' | 'child';

export interface Member {
  id: number;
  name: string;
  role: MemberRole;
  birthdate: string | null;       // ISO date 'YYYY-MM-DD'
  color: string;                  // hex '#2563EB'
  avatar_initials: string | null;
  institution_name: string | null;
  institution_address: string | null;
  gcal_calendar_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Schedule {
  id: number;
  member_id: number;
  label: string;
  day_of_week: number; // 0=Sun, 1=Mon, ... 6=Sat
  start_time: string;  // 'HH:MM'
  end_time: string;    // 'HH:MM'
  location: string | null;
  category: EventCategory;
  active: number; // 0 or 1
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
}

export type EventCategory =
  | 'work'
  | 'school'
  | 'kindergarten'
  | 'workout'
  | 'music'
  | 'party'
  | 'sleepover'
  | 'sports'
  | 'doctor'
  | 'birthday'
  | 'vacation'
  | 'other';

export type EventSource = 'manual' | 'google' | 'generated';

export interface CalendarEvent {
  id: number;
  title: string;
  description: string | null;
  category: EventCategory;
  start_datetime: string; // ISO 8601 with offset
  end_datetime: string;
  all_day: number; // 0 or 1
  location: string | null;
  color_override: string | null;
  source: EventSource;
  gcal_event_id: string | null;
  schedule_id: number | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  member_ids?: number[];
  member_colors?: string[];
  member_names?: string[];
}

export interface GoogleToken {
  member_id: number;
  access_token: string;  // encrypted
  refresh_token: string; // encrypted
  token_type: string;
  scope: string;
  expires_at: string;
  updated_at: string;
}

export interface Settings {
  family_name: string;
  weather_lat: string;
  weather_lon: string;
  weather_location: string;
  vacation_mode: string;   // '0' or '1'
  vacation_start: string;  // 'YYYY-MM-DD'
  vacation_end: string;    // 'YYYY-MM-DD'
  vacation_lat: string;
  vacation_lon: string;
  vacation_location: string;
  admin_password_hash: string;
  display_wake_lock: string;
  google_sync_interval_minutes: string;
}

// Weather types
export interface CurrentWeather {
  temperature: number;
  symbol: string;
  wind_speed: number;
  precipitation: number;
}

export interface DailyForecast {
  date: string;
  min_temp: number;
  max_temp: number;
  symbol: string;
  precipitation: number;
}

export interface WeatherData {
  location: string;
  current: CurrentWeather;
  daily: DailyForecast[];
}

// Display page payload
export interface DisplayDay {
  date: string; // 'YYYY-MM-DD'
  events: DisplayEvent[];
  forecast?: DailyForecast; // pre-resolved per-day forecast (correct location)
}

export interface DisplayEvent {
  id: number;
  title: string;
  description: string | null;
  category: EventCategory;
  start_datetime: string;
  end_datetime: string;
  all_day: boolean;
  location: string | null;
  source: EventSource;
  member_ids: number[];
  member_colors: string[];
  member_names: string[];
}

export interface DisplayPayload {
  familyName: string;
  generatedAt: string;
  members: Pick<Member, 'id' | 'name' | 'color' | 'avatar_initials'>[];
  days: DisplayDay[];
  weather: WeatherData | null;
  vacationMode: boolean;
}
