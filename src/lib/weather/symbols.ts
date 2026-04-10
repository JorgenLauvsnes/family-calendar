/**
 * Pure client/server shared module — no server-only imports.
 * Maps Yr.no symbol codes to emoji.
 */
export function weatherEmoji(symbolCode: string): string {
  const base = symbolCode.replace(/_day|_night|_polartwilight/g, '');
  const map: Record<string, string> = {
    clearsky: '☀️',
    fair: '🌤️',
    partlycloudy: '⛅',
    cloudy: '☁️',
    fog: '🌫️',
    lightrain: '🌦️',
    rain: '🌧️',
    heavyrain: '🌧️',
    lightrainshowers: '🌦️',
    rainshowers: '🌦️',
    heavyrainshowers: '⛈️',
    lightsleet: '🌨️',
    sleet: '🌨️',
    heavysleet: '🌨️',
    lightsleetshowers: '🌨️',
    sleetshowers: '🌨️',
    heavysleetshowers: '🌨️',
    lightsnow: '🌨️',
    snow: '❄️',
    heavysnow: '❄️',
    lightsnowshowers: '🌨️',
    snowshowers: '🌨️',
    heavysnowshowers: '❄️',
    lightrainandthunder: '⛈️',
    rainandthunder: '⛈️',
    heavyrainandthunder: '⛈️',
    lightrainshowersandthunder: '⛈️',
    rainshowersandthunder: '⛈️',
    heavyrainshowersandthunder: '⛈️',
    lightsleetandthunder: '⛈️',
    sleetandthunder: '⛈️',
    lightsleetshowersandthunder: '⛈️',
    sleetshowersandthunder: '⛈️',
    heavysleetshowersandthunder: '⛈️',
    lightsnowandthunder: '⛈️',
    snowandthunder: '⛈️',
    lightsnowshowersandthunder: '⛈️',
    snowshowersandthunder: '⛈️',
    heavysnowshowersandthunder: '⛈️',
  };
  return map[base] ?? '🌡️';
}
