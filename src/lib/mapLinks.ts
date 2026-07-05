// Build platform-aware map / directions links so the OS opens its default map app.

export function isAppleDevice(): boolean {
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS / macOS Safari report as Mac; treat touch-capable Macs as Apple too
    (/Macintosh/.test(ua))
}

const enc = (s: string) => encodeURIComponent(s)

/**
 * Build a directions/place URL for the ordered list of stops.
 * Branches on the OS default map app and on the number of stops.
 * Returns null when there are no stops.
 */
export function directionsUrl(stops: string[]): string | null {
  if (!stops.length) return null

  if (isAppleDevice()) {
    if (stops.length === 1) {
      return `https://maps.apple.com/?q=${enc(stops[0])}`
    }
    // daddr supports chained stops: B+to:C+to:D
    const [origin, ...rest] = stops
    const daddr = rest.map(enc).join('+to:')
    return `https://maps.apple.com/?saddr=${enc(origin)}&daddr=${daddr}&dirflg=d`
  }

  // Google Maps for everything else.
  if (stops.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${enc(stops[0])}`
  }
  const origin = stops[0]
  const destination = stops[stops.length - 1]
  const middle = stops.slice(1, -1)
  let url =
    `https://www.google.com/maps/dir/?api=1&origin=${enc(origin)}` +
    `&destination=${enc(destination)}&travelmode=driving`
  if (middle.length) {
    url += `&waypoints=${middle.map(enc).join('%7C')}`
  }
  return url
}
