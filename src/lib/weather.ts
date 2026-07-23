// Free, keyless daily weather via Open-Meteo. Shows the forecast for the trip's
// displayed day + destination in the header. Results are cached in localStorage
// with a short TTL so navigating day-to-day is instant and offline-tolerant.

export interface DailyWeather {
  code: number
  tMax: number
  tMin: number
  /** Unit suffix for display, e.g. '°F' or '°C'. */
  unit: string
}

const CACHE_KEY = 'grandease.weatherCache'
const TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

type Entry = { ts: number; data: DailyWeather | null }
type Cache = Record<string, Entry>

function loadCache(): Cache {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
  } catch {
    return {}
  }
}
function saveCache(c: Cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c))
  } catch {
    /* ignore quota */
  }
}

// Fahrenheit for US locales, Celsius elsewhere.
function useFahrenheit(): boolean {
  try {
    return new Intl.Locale(navigator.language).region === 'US'
  } catch {
    return false
  }
}

// Open-Meteo's daily forecast covers roughly 90 days back to 16 days ahead.
// Outside that window there's no meaningful forecast, so skip the request.
function inForecastRange(date: string): boolean {
  const day = new Date(date + 'T00:00:00')
  if (isNaN(day.getTime())) return false
  const dayMid = new Date(day.toDateString()).getTime()
  const now = Date.now()
  return dayMid >= now - 90 * 864e5 && dayMid <= now + 16 * 864e5
}

/** WMO weather code -> short human label. */
export function weatherLabel(code: number): string {
  if (code === 0) return 'Clear'
  if (code <= 2) return 'Partly cloudy'
  if (code === 3) return 'Overcast'
  if (code <= 48) return 'Fog'
  if (code <= 57) return 'Drizzle'
  if (code <= 67) return 'Rain'
  if (code <= 77) return 'Snow'
  if (code <= 82) return 'Showers'
  if (code <= 86) return 'Snow showers'
  return 'Thunderstorm'
}

export async function getDailyWeather(
  lat: number,
  lon: number,
  date: string,
): Promise<DailyWeather | null> {
  if (!inForecastRange(date)) return null
  const fah = useFahrenheit()
  const unit = fah ? '°F' : '°C'
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}|${date}|${fah ? 'f' : 'c'}`

  const cache = loadCache()
  const hit = cache[key]
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.data

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto` +
      `&start_date=${date}&end_date=${date}` +
      `&temperature_unit=${fah ? 'fahrenheit' : 'celsius'}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(String(res.status))
    const j = (await res.json()) as {
      daily?: {
        weather_code?: (number | null)[]
        temperature_2m_max?: (number | null)[]
        temperature_2m_min?: (number | null)[]
      }
    }
    const d = j.daily
    const code = d?.weather_code?.[0]
    const tMax = d?.temperature_2m_max?.[0]
    const tMin = d?.temperature_2m_min?.[0]
    const data: DailyWeather | null =
      code == null || tMax == null || tMin == null ? null : { code, tMax, tMin, unit }
    cache[key] = { ts: Date.now(), data }
    saveCache(cache)
    return data
  } catch {
    return null
  }
}
