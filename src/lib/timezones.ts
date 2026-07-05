// Timezone helpers. Event times are FLOATING relative to their destination:
// a 7pm-in-Paris event is stored with timeZone "Europe/Paris" and always
// rendered in that zone, so it reads 7pm no matter where the viewer is.

export const COMMON_TZ = [
  'Pacific/Honolulu',
  'America/Anchorage',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Athens',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Pacific/Auckland',
]

export const deviceTimezone =
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

/** Full IANA list where supported, else the common subset. */
export function allTimezones(): string[] {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
      .supportedValuesOf
    if (typeof fn === 'function') return fn('timeZone')
  } catch {
    /* fall through */
  }
  return COMMON_TZ
}

/** City part of a tz id, e.g. "Europe/Paris" -> "Paris". */
export function tzCity(tz?: string): string {
  if (!tz) return ''
  return tz.split('/').pop()?.replace(/_/g, ' ') || tz
}

/** Short offset like "GMT+2" for a tz at a given instant. */
export function tzOffset(tz: string, at: Date = new Date()): string {
  try {
    return (
      new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
        .formatToParts(at)
        .find((p) => p.type === 'timeZoneName')?.value || ''
    )
  } catch {
    return ''
  }
}

/** Abbreviation like "CEST"/"PST" for a tz at a given instant. */
export function tzAbbrev(tz: string, at: Date = new Date()): string {
  try {
    const v = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName')?.value
    // Some locales return "GMT+2" here; prefer a real abbrev when present.
    return v && !/^GMT/.test(v) ? v : tzOffset(tz, at)
  } catch {
    return ''
  }
}

/** Friendly label for a dropdown option, e.g. "Paris (GMT+2)". */
export function tzLabel(tz: string): string {
  const off = tzOffset(tz)
  return `${tzCity(tz)}${off ? ` (${off})` : ''}`
}
