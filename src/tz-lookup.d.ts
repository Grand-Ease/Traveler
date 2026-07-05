declare module 'tz-lookup' {
  /** Returns the IANA timezone name for a latitude/longitude. */
  const tzlookup: (lat: number, lon: number) => string
  export default tzlookup
}
