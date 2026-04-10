import { WeatherData } from '@/types';
import { weatherEmoji } from '@/lib/weather/symbols';

interface Props {
  weather: WeatherData | null;
  vacationMode: boolean;
}

export default function WeatherWidget({ weather, vacationMode }: Props) {
  if (!weather) {
    return (
      <div className="text-slate-600 text-sm">Vær utilgjengelig</div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {vacationMode && (
        <span className="text-xs bg-cyan-600 text-white px-2 py-0.5 rounded-full font-medium">
          ✈ FERIE
        </span>
      )}
      <div className="text-right">
        <div className="flex items-center gap-2 justify-end">
          <span className="text-3xl leading-none">
            {weatherEmoji(weather.current.symbol)}
          </span>
          <span className="text-3xl font-bold text-white">
            {weather.current.temperature}°
          </span>
        </div>
        <div className="text-xs text-slate-500 mt-0.5">
          {weather.location}
        </div>
        {weather.current.wind_speed > 5 && (
          <div className="text-xs text-slate-500">
            💨 {weather.current.wind_speed} m/s
          </div>
        )}
      </div>
    </div>
  );
}
