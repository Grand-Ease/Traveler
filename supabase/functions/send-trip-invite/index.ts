// Sends trip invitations through Resend. Configure before deploying:
//   supabase secrets set RESEND_API_KEY=... INVITE_FROM_EMAIL="Traveler <trips@example.com>"
//   supabase secrets set APP_URL=https://your-app.example.com

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

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized.' }, 401)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return json({ error: 'Unauthorized.' }, 401)

  let tripId = ''
  let email = ''
  let role = ''
  try {
    const body = await req.json()
    tripId = String(body?.tripId ?? '')
    email = String(body?.email ?? '').trim().toLowerCase()
    role = String(body?.role ?? '')
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }
  if (!tripId || !email || !email.includes('@') || !['editor', 'viewer'].includes(role)) {
    return json({ error: 'A valid trip, email, and role are required.' }, 400)
  }

  // This owner-only RPC creates/updates a pending invite, or updates the role
  // when the recipient is already a member.
  const { data: invite, error: inviteError } = await supabase.rpc('invite_member', {
    p_trip: tripId,
    p_email: email,
    p_role: role,
  })
  if (inviteError) return json({ error: inviteError.message }, 403)

  if (invite?.status === 'added') {
    return json({
      ...invite,
      emailSent: false,
      emailSkipped: true,
    })
  }

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('name')
    .eq('id', tripId)
    .single()
  if (tripError) return json({ error: tripError.message }, 500)

  const resendKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('INVITE_FROM_EMAIL')
  if (!resendKey || !from) {
    return json({
      ...invite,
      emailSent: false,
      emailError: 'Invite email is not configured on the server.',
    })
  }

  const appUrl = Deno.env.get('APP_URL') ?? req.headers.get('Origin') ?? ''
  const tripName = String(trip?.name ?? 'a trip')
  const sender = user.email ?? 'A traveler'
  const access = role === 'editor' ? 'edit' : 'view'
  const safeTrip = escapeHtml(tripName)
  const safeSender = escapeHtml(sender)
  const safeUrl = escapeHtml(appUrl)

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `${sender} shared “${tripName}” with you`,
        text:
          `${sender} invited you to ${access} “${tripName}” in GrandEase Traveler.` +
          (appUrl ? `\n\nOpen the trip: ${appUrl}` : ''),
        html: `<p><strong>${safeSender}</strong> invited you to ${access} <strong>“${safeTrip}”</strong> in GrandEase Traveler.</p>${
          appUrl ? `<p><a href="${safeUrl}">Open the trip</a></p>` : ''
        }<p>Sign in with <strong>${escapeHtml(email)}</strong> to get access.</p>`,
      }),
    })

    if (!response.ok) {
      const detail = await response.text()
      console.error('Resend rejected trip invite:', response.status, detail.slice(0, 500))
      return json({
        ...invite,
        emailSent: false,
        emailError: `Email provider rejected the message (${response.status}).`,
      })
    }

    if (invite?.inviteId) {
      const { error: markError } = await supabase.rpc('mark_invite_sent', {
        p_trip: tripId,
        p_invite: invite.inviteId,
      })
      if (markError) console.error('Could not record invite delivery:', markError.message)
    }

    return json({ ...invite, emailSent: true })
  } catch (error) {
    console.error('Trip invite email failed:', (error as Error).message)
    return json({
      ...invite,
      emailSent: false,
      emailError: 'Could not reach the email provider.',
    })
  }
})
