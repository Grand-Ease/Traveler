// Supabase Edge Function: text-to-events
//
// Converts raw reservation email / dictated text into structured itinerary
// items using a Gemini Flash model. The Gemini API key lives ONLY here as a
// Supabase secret (never shipped to the client).
//
//   POST /functions/v1/text-to-events
//   Authorization: Bearer <supabase access token>   (required)
//   Body: { text: string, context?: { tripStart?, tripEnd?, currentDate?, defaultTimezone? } }
//   -> { items: ItineraryItem[], errors?: string[] }
//
// Deploy:
//   supabase secrets set GEMINI_API_KEY=...
//   supabase functions deploy text-to-events

import { createClient } from 'jsr:@supabase/supabase-js@2'

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '*'

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ---- naive per-user rate limiting -------------------------------------------
// NOTE: this is an in-memory stub. It resets on cold start and is not shared
// across function instances. For production, back this with a durable store
// (e.g. a Postgres table or Upstash Redis).
const RATE_LIMIT = 20 // requests
const RATE_WINDOW_MS = 60_000 // per minute
const hits = new Map<string, number[]>()

function rateLimited(userId: string): boolean {
  const now = Date.now()
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  recent.push(now)
  hits.set(userId, recent)
  return recent.length > RATE_LIMIT
}

// ---- Gemini structured-output schema (mirrors ItineraryItem) ----------------
const responseSchema = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      type: { type: 'STRING', enum: ['travel', 'lodging', 'dining', 'activity', 'note'] },
      title: { type: 'STRING' },
      subtype: { type: 'STRING' },
      date: { type: 'STRING' },
      endDate: { type: 'STRING' },
      startTime: { type: 'STRING' },
      endTime: { type: 'STRING' },
      timezone: { type: 'STRING' },
      location: { type: 'STRING' },
      from: { type: 'STRING' },
      to: { type: 'STRING' },
      number: { type: 'STRING' },
      gate: { type: 'STRING' },
      nights: { type: 'INTEGER' },
      confirmation: { type: 'STRING' },
      phone: { type: 'STRING' },
      seatsOrRoom: { type: 'STRING' },
      notes: { type: 'STRING' },
    },
    required: ['type', 'title', 'date'],
  },
}

interface Ctx {
  tripStart?: string
  tripEnd?: string
  currentDate?: string
  defaultTimezone?: string
}

function buildInstruction(ctx: Ctx): string {
  const lines = [
    'You convert travel reservations / notes into structured itinerary items for the GrandEase Traveler app.',
    'Return ONLY items you can support with the source text. Do not invent data you do not see.',
    '',
    'Field rules:',
    '- type: one of travel | lodging | dining | activity | note (required).',
    '- title: airline/hotel/restaurant/activity name, or note title (required).',
    '- subtype: for travel use airplane|train|car|subway|ship; for activity use a short kind (activity, meeting, sightseeing, etc.).',
    '- date: YYYY-MM-DD, the start/departure/check-in date (required).',
    '- Use 24-hour times (HH:mm). Convert AM/PM.',
    '- Times are LOCAL TO THE DESTINATION. A 7pm dinner in Paris is startTime "19:00" — never convert to the reader\u2019s home zone.',
    '- Include a "location" (city/country or full address) so the app can derive the time zone automatically; usually omit "timezone".',
    '- Lodging: if given check-in and check-out dates, set date=check-in and nights=(nights between).',
    '- Travel that arrives on a later day than it departs (overnight flight, multi-day train/cruise): set "endDate" to the arrival date. Omit endDate when arrival is the same day.',
    '- Omit fields you do not have rather than sending null or empty strings.',
    '- Resolve relative dates ("tomorrow", "next Friday") using the context below.',
    '',
    'Context:',
    `- Current date: ${ctx.currentDate || 'unknown'}`,
    `- Trip start: ${ctx.tripStart || 'unknown'}`,
    `- Trip end: ${ctx.tripEnd || 'unknown'}`,
    `- Default timezone (device): ${ctx.defaultTimezone || 'unknown'}`,
  ]
  return lines.join('\n')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ items: [], errors: ['Method not allowed.'] }, 405)

  // ---- auth: require a valid Supabase user (reject anonymous) ----
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return json({ items: [], errors: ['Unauthorized.'] }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return json({ items: [], errors: ['Unauthorized.'] }, 401)
  }

  if (rateLimited(user.id)) {
    return json({ items: [], errors: ['Rate limit exceeded. Try again in a minute.'] }, 429)
  }

  // ---- parse body ----
  let text = ''
  let ctx: Ctx = {}
  try {
    const body = await req.json()
    text = String(body?.text ?? '').trim()
    ctx = (body?.context ?? {}) as Ctx
  } catch {
    return json({ items: [], errors: ['Invalid JSON body.'] }, 400)
  }
  if (!text) return json({ items: [], errors: ['No text provided.'] }, 400)

  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  if (!geminiKey) {
    return json({ items: [], errors: ['Server missing GEMINI_API_KEY.'] }, 500)
  }
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash'

  // ---- call Gemini with structured output ----
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: buildInstruction(ctx) }] },
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema,
          temperature: 0,
        },
      }),
    })

    if (!res.ok) {
      const detail = await res.text()
      return json({ items: [], errors: [`Gemini error ${res.status}: ${detail.slice(0, 500)}`] }, 502)
    }

    const data = await res.json()
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    let items: unknown = []
    try {
      items = JSON.parse(raw)
    } catch {
      return json({ items: [], errors: ['Model returned unparseable output.'] }, 502)
    }
    const arr = Array.isArray(items) ? items : []
    return json({ items: arr })
  } catch (e) {
    return json({ items: [], errors: [`Request failed: ${(e as Error).message}`] }, 502)
  }
})
