# Supabase deployment

Trip invite emails are sent by the `send-trip-invite` Edge Function through
[Resend](https://resend.com). Configure a verified sender and the deployed app
URL as Supabase secrets:

```bash
supabase secrets set \
  RESEND_API_KEY=re_... \
  'INVITE_FROM_EMAIL=GrandEase Traveler <trips@your-domain.example>' \
  APP_URL=https://your-app.example.com
```

Then apply the database migrations and deploy the function:

```bash
supabase db push
supabase functions deploy send-trip-invite
```

For production, also set `ALLOWED_ORIGIN` to the app origin. Resend accounts in
test mode can generally send only to the account owner's address; verify a
domain before inviting other addresses.

The function returns `emailSent: true` only after Resend accepts the message.
For pending invitations, `trip_invites.last_sent_at` records that successful
provider handoff. Delivery and bounce details remain available in Resend's
email logs.
