// Curated IATA airport and rail-station codes so short queries like "LAX"
// resolve to the intended hub instead of an unrelated place name (e.g. Lax, CH).

export type TransportKind = 'airport' | 'station'

export interface TransportPlace {
  code: string
  name: string
  city: string
  lat: number
  lon: number
  kind: TransportKind
}

function airport(
  code: string,
  name: string,
  city: string,
  lat: number,
  lon: number,
): TransportPlace {
  return { code, name, city, lat, lon, kind: 'airport' }
}

function station(
  code: string,
  name: string,
  city: string,
  lat: number,
  lon: number,
): TransportPlace {
  return { code, name, city, lat, lon, kind: 'station' }
}

/** Major IATA airports keyed by 3-letter code (uppercase). */
const AIRPORTS: Record<string, TransportPlace> = Object.fromEntries(
  [
    airport('ATL', 'Hartsfield-Jackson Atlanta International Airport', 'Atlanta, GA, USA', 33.6407, -84.4277),
    airport('LAX', 'Los Angeles International Airport', 'Los Angeles, CA, USA', 33.9425, -118.4081),
    airport('ORD', "O'Hare International Airport", 'Chicago, IL, USA', 41.9742, -87.9073),
    airport('DFW', 'Dallas/Fort Worth International Airport', 'Dallas, TX, USA', 32.8998, -97.0403),
    airport('DEN', 'Denver International Airport', 'Denver, CO, USA', 39.8561, -104.6737),
    airport('JFK', 'John F. Kennedy International Airport', 'New York, NY, USA', 40.6413, -73.7781),
    airport('SFO', 'San Francisco International Airport', 'San Francisco, CA, USA', 37.6213, -122.379),
    airport('SEA', 'Seattle-Tacoma International Airport', 'Seattle, WA, USA', 47.4502, -122.3088),
    airport('LAS', 'Harry Reid International Airport', 'Las Vegas, NV, USA', 36.084, -115.1537),
    airport('MCO', 'Orlando International Airport', 'Orlando, FL, USA', 28.4312, -81.3081),
    airport('EWR', 'Newark Liberty International Airport', 'Newark, NJ, USA', 40.6895, -74.1745),
    airport('CLT', 'Charlotte Douglas International Airport', 'Charlotte, NC, USA', 35.214, -80.9431),
    airport('MIA', 'Miami International Airport', 'Miami, FL, USA', 25.7959, -80.287),
    airport('PHX', 'Phoenix Sky Harbor International Airport', 'Phoenix, AZ, USA', 33.4373, -112.0078),
    airport('IAH', 'George Bush Intercontinental Airport', 'Houston, TX, USA', 29.9902, -95.3368),
    airport('BOS', 'Boston Logan International Airport', 'Boston, MA, USA', 42.3656, -71.0096),
    airport('MSP', 'Minneapolis–Saint Paul International Airport', 'Minneapolis, MN, USA', 44.8848, -93.2223),
    airport('DTW', 'Detroit Metropolitan Wayne County Airport', 'Detroit, MI, USA', 42.2162, -83.3554),
    airport('FLL', 'Fort Lauderdale–Hollywood International Airport', 'Fort Lauderdale, FL, USA', 26.0742, -80.1506),
    airport('LGA', 'LaGuardia Airport', 'New York, NY, USA', 40.7769, -73.874),
    airport('BWI', 'Baltimore/Washington International Airport', 'Baltimore, MD, USA', 39.1754, -76.6683),
    airport('SLC', 'Salt Lake City International Airport', 'Salt Lake City, UT, USA', 40.7899, -111.9791),
    airport('DCA', 'Ronald Reagan Washington National Airport', 'Washington, DC, USA', 38.8512, -77.0402),
    airport('IAD', 'Washington Dulles International Airport', 'Dulles, VA, USA', 38.9531, -77.4565),
    airport('SAN', 'San Diego International Airport', 'San Diego, CA, USA', 32.7338, -117.1933),
    airport('TPA', 'Tampa International Airport', 'Tampa, FL, USA', 27.9755, -82.5332),
    airport('PDX', 'Portland International Airport', 'Portland, OR, USA', 45.5898, -122.5951),
    airport('STL', 'St. Louis Lambert International Airport', 'St. Louis, MO, USA', 38.7487, -90.37),
    airport('HNL', 'Daniel K. Inouye International Airport', 'Honolulu, HI, USA', 21.3187, -157.9225),
    airport('AUS', 'Austin-Bergstrom International Airport', 'Austin, TX, USA', 30.1945, -97.6699),
    airport('BNA', 'Nashville International Airport', 'Nashville, TN, USA', 36.1263, -86.6774),
    airport('MSY', 'Louis Armstrong New Orleans International Airport', 'New Orleans, LA, USA', 29.9934, -90.258),
    airport('RDU', 'Raleigh-Durham International Airport', 'Raleigh, NC, USA', 35.8801, -78.788),
    airport('SJC', 'San Jose International Airport', 'San Jose, CA, USA', 37.3639, -121.9289),
    airport('OAK', 'Oakland International Airport', 'Oakland, CA, USA', 37.7126, -122.2197),
    airport('SMF', 'Sacramento International Airport', 'Sacramento, CA, USA', 38.6954, -121.5908),
    airport('SNA', 'John Wayne Airport', 'Santa Ana, CA, USA', 33.6757, -117.8682),
    airport('BUR', 'Hollywood Burbank Airport', 'Burbank, CA, USA', 34.2006, -118.3585),
    airport('ONT', 'Ontario International Airport', 'Ontario, CA, USA', 34.0559, -117.6011),
    airport('PHL', 'Philadelphia International Airport', 'Philadelphia, PA, USA', 39.8744, -75.2424),
    airport('CLE', 'Cleveland Hopkins International Airport', 'Cleveland, OH, USA', 41.4117, -81.8498),
    airport('PIT', 'Pittsburgh International Airport', 'Pittsburgh, PA, USA', 40.4915, -80.2329),
    airport('IND', 'Indianapolis International Airport', 'Indianapolis, IN, USA', 39.7173, -86.2944),
    airport('CMH', 'John Glenn Columbus International Airport', 'Columbus, OH, USA', 39.998, -82.8919),
    airport('MCI', 'Kansas City International Airport', 'Kansas City, MO, USA', 39.2976, -94.7139),
    airport('MKE', 'Milwaukee Mitchell International Airport', 'Milwaukee, WI, USA', 42.9472, -87.8966),
    airport('CVG', 'Cincinnati/Northern Kentucky International Airport', 'Hebron, KY, USA', 39.0488, -84.6678),
    airport('RSW', 'Southwest Florida International Airport', 'Fort Myers, FL, USA', 26.5362, -81.7552),
    airport('PBI', 'Palm Beach International Airport', 'West Palm Beach, FL, USA', 26.6832, -80.0956),
    airport('JAX', 'Jacksonville International Airport', 'Jacksonville, FL, USA', 30.4941, -81.6879),
    airport('SAT', 'San Antonio International Airport', 'San Antonio, TX, USA', 29.5337, -98.4698),
    airport('HOU', 'William P. Hobby Airport', 'Houston, TX, USA', 29.6454, -95.2789),
    airport('DAL', 'Dallas Love Field', 'Dallas, TX, USA', 32.8471, -96.8518),
    airport('ABQ', 'Albuquerque International Sunport', 'Albuquerque, NM, USA', 35.0402, -106.6091),
    airport('ANC', 'Ted Stevens Anchorage International Airport', 'Anchorage, AK, USA', 61.1743, -149.9962),
    airport('BOI', 'Boise Airport', 'Boise, ID, USA', 43.5644, -116.2228),
    airport('RNO', 'Reno-Tahoe International Airport', 'Reno, NV, USA', 39.4991, -119.7681),
    airport('GEG', 'Spokane International Airport', 'Spokane, WA, USA', 47.6199, -117.5338),
    airport('OKC', 'Will Rogers World Airport', 'Oklahoma City, OK, USA', 35.3931, -97.6007),
    airport('TUL', 'Tulsa International Airport', 'Tulsa, OK, USA', 36.1984, -95.8881),
    airport('OMA', 'Eppley Airfield', 'Omaha, NE, USA', 41.3032, -95.8941),
    airport('MEM', 'Memphis International Airport', 'Memphis, TN, USA', 35.0424, -89.9767),
    airport('SDF', 'Louisville Muhammad Ali International Airport', 'Louisville, KY, USA', 38.1744, -85.736),
    airport('RIC', 'Richmond International Airport', 'Richmond, VA, USA', 37.5052, -77.3197),
    airport('BUF', 'Buffalo Niagara International Airport', 'Buffalo, NY, USA', 42.9405, -78.7322),
    airport('ROC', 'Greater Rochester International Airport', 'Rochester, NY, USA', 43.1189, -77.6724),
    airport('SYR', 'Syracuse Hancock International Airport', 'Syracuse, NY, USA', 43.1112, -76.1063),
    airport('ALB', 'Albany International Airport', 'Albany, NY, USA', 42.7483, -73.8017),
    airport('PVD', 'Rhode Island T. F. Green International Airport', 'Providence, RI, USA', 41.724, -71.4282),
    airport('BDL', 'Bradley International Airport', 'Windsor Locks, CT, USA', 41.9389, -72.6832),
    airport('PWM', 'Portland International Jetport', 'Portland, ME, USA', 43.6462, -70.3093),
    airport('CHS', 'Charleston International Airport', 'Charleston, SC, USA', 32.8986, -80.0405),
    airport('GSP', 'Greenville-Spartanburg International Airport', 'Greer, SC, USA', 34.8957, -82.2189),
    airport('SAV', 'Savannah/Hilton Head International Airport', 'Savannah, GA, USA', 32.1276, -81.2021),
    airport('BHM', 'Birmingham-Shuttlesworth International Airport', 'Birmingham, AL, USA', 33.5629, -86.7535),
    airport('LIT', 'Bill and Hillary Clinton National Airport', 'Little Rock, AR, USA', 34.7294, -92.2243),
    airport('ELP', 'El Paso International Airport', 'El Paso, TX, USA', 31.8072, -106.3778),
    airport('TUS', 'Tucson International Airport', 'Tucson, AZ, USA', 32.1161, -110.941),
    airport('FAT', 'Fresno Yosemite International Airport', 'Fresno, CA, USA', 36.7762, -119.7181),
    airport('PSP', 'Palm Springs International Airport', 'Palm Springs, CA, USA', 33.8297, -116.5067),
    airport('SBA', 'Santa Barbara Airport', 'Santa Barbara, CA, USA', 34.4262, -119.8404),
    airport('LIH', 'Lihue Airport', 'Lihue, HI, USA', 21.976, -159.3389),
    airport('OGG', 'Kahului Airport', 'Kahului, HI, USA', 20.8986, -156.4305),
    airport('KOA', 'Ellison Onizuka Kona International Airport', 'Kailua-Kona, HI, USA', 19.7388, -156.0456),
    airport('YVR', 'Vancouver International Airport', 'Vancouver, BC, Canada', 49.1967, -123.1815),
    airport('YYZ', 'Toronto Pearson International Airport', 'Toronto, ON, Canada', 43.6777, -79.6248),
    airport('YUL', 'Montréal–Trudeau International Airport', 'Montreal, QC, Canada', 45.4706, -73.7408),
    airport('YYC', 'Calgary International Airport', 'Calgary, AB, Canada', 51.1215, -114.0076),
    airport('YOW', 'Ottawa Macdonald–Cartier International Airport', 'Ottawa, ON, Canada', 45.3225, -75.6692),
    airport('YEG', 'Edmonton International Airport', 'Edmonton, AB, Canada', 53.3097, -113.5797),
    airport('LHR', 'London Heathrow Airport', 'London, UK', 51.47, -0.4543),
    airport('LGW', 'London Gatwick Airport', 'London, UK', 51.1537, -0.1821),
    airport('STN', 'London Stansted Airport', 'London, UK', 51.886, 0.2389),
    airport('LTN', 'London Luton Airport', 'Luton, UK', 51.8747, -0.3683),
    airport('MAN', 'Manchester Airport', 'Manchester, UK', 53.3537, -2.275),
    airport('EDI', 'Edinburgh Airport', 'Edinburgh, UK', 55.95, -3.3725),
    airport('DUB', 'Dublin Airport', 'Dublin, Ireland', 53.4264, -6.2499),
    airport('CDG', 'Paris Charles de Gaulle Airport', 'Paris, France', 49.0097, 2.5479),
    airport('ORY', 'Paris Orly Airport', 'Paris, France', 48.7233, 2.3794),
    airport('AMS', 'Amsterdam Airport Schiphol', 'Amsterdam, Netherlands', 52.3105, 4.7683),
    airport('FRA', 'Frankfurt Airport', 'Frankfurt, Germany', 50.0379, 8.5622),
    airport('MUC', 'Munich Airport', 'Munich, Germany', 48.3538, 11.7861),
    airport('BER', 'Berlin Brandenburg Airport', 'Berlin, Germany', 52.3667, 13.5033),
    airport('ZRH', 'Zurich Airport', 'Zurich, Switzerland', 47.4582, 8.5555),
    airport('GVA', 'Geneva Airport', 'Geneva, Switzerland', 46.2381, 6.1089),
    airport('VIE', 'Vienna International Airport', 'Vienna, Austria', 48.1103, 16.5697),
    airport('BRU', 'Brussels Airport', 'Brussels, Belgium', 50.9014, 4.4844),
    airport('MAD', 'Adolfo Suárez Madrid–Barajas Airport', 'Madrid, Spain', 40.4983, -3.5676),
    airport('BCN', 'Barcelona–El Prat Airport', 'Barcelona, Spain', 41.2971, 2.0785),
    airport('LIS', 'Humberto Delgado Airport', 'Lisbon, Portugal', 38.7756, -9.1354),
    airport('FCO', 'Rome Fiumicino Airport', 'Rome, Italy', 41.8003, 12.2389),
    airport('MXP', 'Milan Malpensa Airport', 'Milan, Italy', 45.6306, 8.7281),
    airport('ATH', 'Athens International Airport', 'Athens, Greece', 37.9364, 23.9445),
    airport('IST', 'Istanbul Airport', 'Istanbul, Turkey', 41.2753, 28.7519),
    airport('CPH', 'Copenhagen Airport', 'Copenhagen, Denmark', 55.618, 12.656),
    airport('ARN', 'Stockholm Arlanda Airport', 'Stockholm, Sweden', 59.6519, 17.9186),
    airport('OSL', 'Oslo Airport', 'Oslo, Norway', 60.1939, 11.1004),
    airport('HEL', 'Helsinki Airport', 'Helsinki, Finland', 60.3172, 24.9633),
    airport('WAW', 'Warsaw Chopin Airport', 'Warsaw, Poland', 52.1657, 20.9671),
    airport('PRG', 'Václav Havel Airport Prague', 'Prague, Czechia', 50.1008, 14.26),
    airport('BUD', 'Budapest Ferenc Liszt International Airport', 'Budapest, Hungary', 47.4298, 19.2611),
    airport('DXB', 'Dubai International Airport', 'Dubai, UAE', 25.2532, 55.3657),
    airport('AUH', 'Abu Dhabi International Airport', 'Abu Dhabi, UAE', 24.433, 54.6511),
    airport('DOH', 'Hamad International Airport', 'Doha, Qatar', 25.2731, 51.6081),
    airport('TLV', 'Ben Gurion Airport', 'Tel Aviv, Israel', 32.0114, 34.8867),
    airport('CAI', 'Cairo International Airport', 'Cairo, Egypt', 30.1219, 31.4056),
    airport('JNB', 'O. R. Tambo International Airport', 'Johannesburg, South Africa', -26.1392, 28.246),
    airport('CPT', 'Cape Town International Airport', 'Cape Town, South Africa', -33.9715, 18.6021),
    airport('NRT', 'Narita International Airport', 'Tokyo, Japan', 35.772, 140.3929),
    airport('HND', 'Haneda Airport', 'Tokyo, Japan', 35.5494, 139.7798),
    airport('KIX', 'Kansai International Airport', 'Osaka, Japan', 34.4347, 135.244),
    airport('ICN', 'Incheon International Airport', 'Seoul, South Korea', 37.4602, 126.4407),
    airport('GMP', 'Gimpo International Airport', 'Seoul, South Korea', 37.5583, 126.7906),
    airport('PEK', 'Beijing Capital International Airport', 'Beijing, China', 40.0799, 116.6031),
    airport('PKX', 'Beijing Daxing International Airport', 'Beijing, China', 39.5098, 116.4105),
    airport('PVG', 'Shanghai Pudong International Airport', 'Shanghai, China', 31.1443, 121.8083),
    airport('SHA', 'Shanghai Hongqiao International Airport', 'Shanghai, China', 31.1979, 121.3363),
    airport('HKG', 'Hong Kong International Airport', 'Hong Kong', 22.308, 113.9185),
    airport('TPE', 'Taiwan Taoyuan International Airport', 'Taipei, Taiwan', 25.0797, 121.2342),
    airport('SIN', 'Singapore Changi Airport', 'Singapore', 1.3644, 103.9915),
    airport('BKK', 'Suvarnabhumi Airport', 'Bangkok, Thailand', 13.69, 100.7501),
    airport('KUL', 'Kuala Lumpur International Airport', 'Kuala Lumpur, Malaysia', 2.7456, 101.7099),
    airport('CGK', 'Soekarno–Hatta International Airport', 'Jakarta, Indonesia', -6.1256, 106.6558),
    airport('MNL', 'Ninoy Aquino International Airport', 'Manila, Philippines', 14.5086, 121.0198),
    airport('SYD', 'Sydney Kingsford Smith Airport', 'Sydney, Australia', -33.9399, 151.1753),
    airport('MEL', 'Melbourne Airport', 'Melbourne, Australia', -37.669, 144.841),
    airport('BNE', 'Brisbane Airport', 'Brisbane, Australia', -27.3842, 153.1175),
    airport('PER', 'Perth Airport', 'Perth, Australia', -31.9385, 115.9672),
    airport('AKL', 'Auckland Airport', 'Auckland, New Zealand', -37.0082, 174.785),
    airport('WLG', 'Wellington Airport', 'Wellington, New Zealand', -41.3272, 174.8053),
    airport('CHC', 'Christchurch Airport', 'Christchurch, New Zealand', -43.4894, 172.532),
    airport('GRU', 'São Paulo–Guarulhos International Airport', 'São Paulo, Brazil', -23.4356, -46.4731),
    airport('GIG', 'Rio de Janeiro–Galeão International Airport', 'Rio de Janeiro, Brazil', -22.809, -43.2506),
    airport('EZE', 'Ministro Pistarini International Airport', 'Buenos Aires, Argentina', -34.8222, -58.5358),
    airport('SCL', 'Arturo Merino Benítez International Airport', 'Santiago, Chile', -33.393, -70.7858),
    airport('BOG', 'El Dorado International Airport', 'Bogotá, Colombia', 4.7016, -74.1469),
    airport('LIM', 'Jorge Chávez International Airport', 'Lima, Peru', -12.0219, -77.1143),
    airport('MEX', 'Mexico City International Airport', 'Mexico City, Mexico', 19.4361, -99.0719),
    airport('CUN', 'Cancún International Airport', 'Cancún, Mexico', 21.0365, -86.8771),
    airport('SJU', 'Luis Muñoz Marín International Airport', 'San Juan, PR', 18.4394, -66.0018),
  ].map((p) => [p.code, p]),
)

/** Common Amtrak / European rail station codes. */
const STATIONS: Record<string, TransportPlace> = Object.fromEntries(
  [
    station('NYP', 'New York Penn Station', 'New York, NY, USA', 40.7506, -73.9935),
    station('NYG', 'Grand Central Terminal', 'New York, NY, USA', 40.7527, -73.9772),
    station('WAS', 'Washington Union Station', 'Washington, DC, USA', 38.8977, -77.0064),
    station('BOS', 'Boston South Station', 'Boston, MA, USA', 42.3519, -71.0552),
    station('BBY', 'Boston Back Bay Station', 'Boston, MA, USA', 42.3473, -71.0756),
    station('PHL', 'Philadelphia 30th Street Station', 'Philadelphia, PA, USA', 39.9556, -75.182),
    station('CHI', 'Chicago Union Station', 'Chicago, IL, USA', 41.8786, -87.6402),
    station('LAX', 'Los Angeles Union Station', 'Los Angeles, CA, USA', 34.0561, -118.2366),
    station('SFC', 'San Francisco Salesforce Transit Center', 'San Francisco, CA, USA', 37.7896, -122.3965),
    station('SAC', 'Sacramento Valley Station', 'Sacramento, CA, USA', 38.5845, -121.5007),
    station('PDX', 'Portland Union Station', 'Portland, OR, USA', 45.5287, -122.6766),
    station('SEA', 'Seattle King Street Station', 'Seattle, WA, USA', 47.5985, -122.3299),
    station('DEN', 'Denver Union Station', 'Denver, CO, USA', 39.7532, -104.9997),
    station('SLC', 'Salt Lake City Intermodal Hub', 'Salt Lake City, UT, USA', 40.7628, -111.902),
    station('ATL', 'Atlanta Peachtree Station', 'Atlanta, GA, USA', 33.7994, -84.3925),
    station('MIA', 'MiamiCentral Station', 'Miami, FL, USA', 25.7775, -80.196),
    station('NOL', 'New Orleans Union Passenger Terminal', 'New Orleans, LA, USA', 29.9467, -90.0783),
    station('SAS', 'San Antonio Station', 'San Antonio, TX, USA', 29.4201, -98.478),
    station('HOS', 'Houston Station', 'Houston, TX, USA', 29.767, -95.3675),
    station('FTW', 'Fort Worth Central Station', 'Fort Worth, TX, USA', 32.749, -97.3265),
    station('DAL', 'Dallas Union Station', 'Dallas, TX, USA', 32.7761, -96.8072),
    station('KGX', 'London Kings Cross', 'London, UK', 51.5308, -0.1238),
    station('EUS', 'London Euston', 'London, UK', 51.5282, -0.1337),
    station('PAD', 'London Paddington', 'London, UK', 51.5154, -0.1755),
    station('VIC', 'London Victoria', 'London, UK', 51.4952, -0.1441),
    station('LIV', 'London Liverpool Street', 'London, UK', 51.5178, -0.0818),
    station('STP', 'London St Pancras International', 'London, UK', 51.5314, -0.1261),
    station('MAN', 'Manchester Piccadilly', 'Manchester, UK', 53.4774, -2.2309),
    station('EDB', 'Edinburgh Waverley', 'Edinburgh, UK', 55.952, -3.189),
    station('GLC', 'Glasgow Central', 'Glasgow, UK', 55.859, -4.258),
    station('PAR', 'Paris Gare du Nord', 'Paris, France', 48.8809, 2.3553),
    station('PLY', 'Paris Gare de Lyon', 'Paris, France', 48.8443, 2.3744),
    station('AMS', 'Amsterdam Centraal', 'Amsterdam, Netherlands', 52.3791, 4.9003),
    station('BRU', 'Brussels Midi/Zuid', 'Brussels, Belgium', 50.8353, 4.3356),
    station('FRA', 'Frankfurt Hauptbahnhof', 'Frankfurt, Germany', 50.1072, 8.6636),
    station('MUC', 'München Hauptbahnhof', 'Munich, Germany', 48.1402, 11.5584),
    station('BER', 'Berlin Hauptbahnhof', 'Berlin, Germany', 52.5251, 13.3694),
    station('ZRH', 'Zürich Hauptbahnhof', 'Zurich, Switzerland', 47.3782, 8.5402),
    station('ROM', 'Roma Termini', 'Rome, Italy', 41.9009, 12.5018),
    station('MIL', 'Milano Centrale', 'Milan, Italy', 45.4863, 9.2041),
    station('MAD', 'Madrid Puerta de Atocha', 'Madrid, Spain', 40.4065, -3.6895),
    station('BCN', 'Barcelona Sants', 'Barcelona, Spain', 41.3795, 2.1406),
  ]
    .filter((p, i, arr) => arr.findIndex((x) => x.code === p.code) === i)
    .map((p) => [p.code, p]),
)

/** Human label stored on itinerary fields after resolving a code. */
export function transportLabel(place: TransportPlace): string {
  return `${place.name} (${place.code})`
}

export function lookupAirport(code: string): TransportPlace | undefined {
  return AIRPORTS[code.trim().toUpperCase()]
}

export function lookupStation(code: string): TransportPlace | undefined {
  return STATIONS[code.trim().toUpperCase()]
}

/** True when the query looks like a bare IATA / station code (3 letters). */
export function looksLikeTransportCode(query: string): boolean {
  return /^[A-Za-z]{3}$/.test(query.trim())
}

/**
 * Prefer airport vs station based on travel subtype. When mode is unknown,
 * airports win for shared codes (LAX airport over LAX Amtrak) unless the
 * subtype is clearly rail.
 */
export function lookupTransportCode(
  query: string,
  mode?: string,
): TransportPlace | undefined {
  if (!looksLikeTransportCode(query)) return undefined
  const code = query.trim().toUpperCase()
  const rail = mode === 'train' || mode === 'subway'
  if (rail) return lookupStation(code) || lookupAirport(code)
  if (mode === 'airplane' || !mode) return lookupAirport(code) || lookupStation(code)
  // car / ship / other: still try airport then station for 3-letter codes
  return lookupAirport(code) || lookupStation(code)
}

/** Alternate geocoder queries when a code isn't in the curated tables. */
export function expandedQueriesForCode(code: string, mode?: string): string[] {
  const c = code.trim().toUpperCase()
  const rail = mode === 'train' || mode === 'subway'
  if (rail) {
    return [`${c} railway station`, `${c} train station`, `${c} station`, c]
  }
  if (mode === 'airplane' || !mode) {
    return [`${c} airport`, `${c} international airport`, c]
  }
  return [`${c} airport`, `${c} railway station`, c]
}
