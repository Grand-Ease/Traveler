import { useEffect, useState } from 'react'
import { geocodeToCoords } from '../lib/geo'
import { getDailyWeather, weatherLabel, type DailyWeather } from '../lib/weather'
import {
  WeatherCloudy,
  WeatherFog,
  WeatherLightning,
  WeatherPartlyCloudy,
  WeatherPouring,
  WeatherRainy,
  WeatherSnowy,
  WeatherSunny,
  type AppIcon,
} from './icons'

function iconForCode(code: number): AppIcon {
  if (code === 0) return WeatherSunny
  if (code <= 2) return WeatherPartlyCloudy
  if (code === 3) return WeatherCloudy
  if (code <= 48) return WeatherFog
  if (code <= 57) return WeatherRainy
  if (code <= 67) return WeatherPouring
  if (code <= 77) return WeatherSnowy
  if (code <= 82) return WeatherPouring
  if (code <= 86) return WeatherSnowy
  return WeatherLightning
}

interface Props {
  /** Destination name for the day (its active place). */
  place?: string
  /** The displayed day, YYYY-MM-DD. */
  date: string
}

// Compact daily forecast for the header: geocodes the day's destination and
// shows a condition icon with the high/low. Renders nothing when there's no
// place, no forecast for that date, or the lookup fails.
export default function DayWeather({ place, date }: Props) {
  const [wx, setWx] = useState<DailyWeather | null>(null)

  useEffect(() => {
    let cancelled = false
    setWx(null)
    const q = (place || '').trim()
    if (!q) return
    ;(async () => {
      const coords = await geocodeToCoords(q)
      if (cancelled || !coords) return
      const data = await getDailyWeather(coords.lat, coords.lon, date)
      if (!cancelled) setWx(data)
    })()
    return () => {
      cancelled = true
    }
  }, [place, date])

  if (!wx) return null
  const Ico = iconForCode(wx.code)
  return (
    <div
      className="mt-1 inline-flex items-center gap-1.5 text-white/70 text-xs"
      title={weatherLabel(wx.code)}
    >
      <Ico size={15} className="text-white/80" />
      <span>
        {Math.round(wx.tMax)}°
        <span className="text-white/40">
          {' / '}
          {Math.round(wx.tMin)}
          {wx.unit}
        </span>
      </span>
    </div>
  )
}
