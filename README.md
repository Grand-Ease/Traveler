# GrandEase Traveler (Web)

A travel-itinerary web app that uses **Google Calendar as its database**. Each trip is a
dedicated Google Calendar; each itinerary item (travel, lodging, dining, activity, note) is a
calendar event. Sharing a trip = sharing the calendar, so collaborators just sign in and the
trip appears — with full view/edit rights and native calendar sync on all their devices.

It is a **static site** (no backend, no database), so it hosts for free on GitHub Pages.

## Why Google Calendar as the backend

- **Sharing & permissions** are built in ("Can edit" / "View only").
- **Sync** across web, iOS, and Android calendar apps automatically.
- **Maps** — event locations are tappable and open Google Maps.
- **Reminders/notifications** for free.
- **No server to run or pay for.**

## Features

- Sign in with Google (browser OAuth, no secret, no backend).
- Create / edit / delete trips (each backed by its own calendar).
- Day-by-day itinerary with 5 item types: Travel, Lodging, Dining, Activity, Note.
- Add / edit / delete items with type-aware forms.
- **Share** a trip by email straight from the app (uses the Calendar ACL API).
- **Add from email / dictation**: paste a schema prompt into any LLM with a reservation
  email, paste the returned JSON back, review, and import.
- **Works offline** — reads and edits keep working with no connection and sync
  automatically when you're back online (see below).

---

## Offline-first

Google Calendar is the source of truth, but the app never blocks on the network:

- **Instant + offline reads.** Trips and their items are cached in `localStorage`,
  so the app opens instantly and shows your itinerary even with no signal. A service
  worker (`public/sw.js`) caches the app shell so the site itself loads offline too.
- **Offline writes.** Adding, editing, and deleting trips or items works offline.
  Each change is applied to the local cache immediately and appended to a **pending
  queue**.
- **Automatic sync.** When connectivity returns (or right after each change while
  online), the queue is flushed to Google Calendar in order, temporary IDs are
  swapped for the real Google IDs, and fresh server state is pulled back down.
- **Status indicator.** A small cloud badge in the header shows `Up to date`,
  `Syncing…`, `N to sync`, or `Offline · N to sync`. Tap it to force a sync.
- **Online-only actions.** Sharing (Calendar ACLs) needs a connection and is
  disabled with a hint when offline or before a new trip has finished its first sync.

Note: your first-ever sign-in requires a connection (Google OAuth). After that you
can use the app offline; queued changes sync once you're back online.

---

## 1. One-time Google Cloud setup (about 5 minutes)

**Credentials model:** you (the owner) create *one* OAuth Client ID and *one* Maps key,
bake them into the build once (GitHub Actions secrets, step 3), and add each traveler as a
**test user**. After that, everyone just taps **Sign in with Google** — they never enter a
Client ID or API key. The app auto-hides all setup fields when these are baked in. The only
friction for test users is a one-time *"Google hasn't verified this app"* screen they click
through (this disappears only if you complete Google's app verification for public use).

You need a public **OAuth Client ID** (no client secret is used).

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create/select a project.
2. **APIs & Services → Library →** enable **Google Calendar API**.
3. **APIs & Services → OAuth consent screen**:
   - User type: **External**.
   - Add your app name and your email.
   - Add the scope `https://www.googleapis.com/auth/calendar`.
   - While in **Testing** mode, add each traveler's Google email under **Test users**
     (up to 100). This avoids the app-verification process — ideal for family/friends.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins** — add every origin you'll open the app from:
     - `http://localhost:5173` (local dev)
     - `https://<your-username>.github.io` (GitHub Pages)
   - Create it and copy the **Client ID** (`…apps.googleusercontent.com`).

> The Client ID is public and safe to ship in a static site. There is **no** client secret.

### Maps API key (recommended, for automatic time zones)

1. In the same project, **APIs & Services → Library →** enable **Maps JavaScript API**.
2. **Credentials → Create credentials → API key.** Copy the key (`AIza…`).
3. **Restrict** the key (strongly recommended, since a client-side key is visible): under
   *Application restrictions* choose **Websites** and add your origins
   (`http://localhost:5173/*`, `https://<username>.github.io/*`); under *API restrictions*
   limit it to **Geocoding API** and **Maps JavaScript API**. So restricted, the exposed key
   only works from your site. Without any key, the app uses a keyless geocoder fallback.

---

## 2. Run locally

```bash
npm install
cp .env.example .env.local   # then fill in your Client ID (+ optional Maps key)
npm run dev
```

Open http://localhost:5173 and sign in. With the values in `.env.local` baked in, there's no
setup prompt. (If you leave `.env.local` empty, the app will ask for the Client ID once and
store it in your browser — handy for quick trials.)

## 3. Deploy to GitHub Pages (owner-managed credentials)

1. Push this repo to GitHub.
2. **Settings → Secrets and variables → Actions → New repository secret** and add:
   - `VITE_GOOGLE_CLIENT_ID` — your OAuth Client ID
   - `VITE_GOOGLE_MAPS_API_KEY` — your Maps key (optional; omit to use the keyless fallback)

   These are compiled into the static build so **users never enter anything**.
3. The workflow (`.github/workflows/deploy.yml`) builds on every push to `main` and publishes
   `dist/` to the **`gh-pages`** branch. In **Settings → Pages → Build and deployment**, set
   **Source: Deploy from a branch**, branch **`gh-pages`**, folder **`/ (root)`**.
4. Add your Pages URL origin (`https://<username>.github.io`) to the OAuth **Authorized
   JavaScript origins**, and `https://<username>.github.io/*` to the Maps key's website
   restriction.
5. Add each traveler's Google email under the OAuth consent screen's **Test users**. They then
   just sign in — no IDs, no keys.

---

## 4. Sharing a trip

Open a trip on the Home screen → **Share** → enter an email and pick **Editor** or
**Viewer**. The owner sees each invitee with **Accepted** or **Pending** status and can
**resend** or cancel pending invites.

- If they already use the app, they get access immediately.
- Otherwise a pending invite is stored; they get the trip after signing in with the **same
  email** (Google or magic link).
- Outbound invite emails are sent by the Supabase Edge Function `send-trip-invite` via
  **Resend**. Configure secrets and deploy the function — see `supabase/README.md`.

Only the trip owner can manage sharing.

---

## 5. Adding items from a reservation email or dictation

In a trip, tap **Import**:

1. **Copy schema prompt** and paste it into ChatGPT / Claude / Gemini.
2. After it, paste your reservation email or dictated notes.
3. Copy the JSON the model returns, paste it into the app, review the preview, and **Add**.

The schema is a single flat JSON object per item (see `src/lib/schema.ts` / `src/types.ts`).
Example the model should produce:

```json
[
  {
    "type": "travel",
    "subtype": "airplane",
    "title": "United",
    "number": "UA 837",
    "from": "SFO",
    "to": "NRT",
    "date": "2026-06-01",
    "startTime": "11:20",
    "endTime": "15:05",
    "timezone": "America/Los_Angeles",
    "confirmation": "ABC123",
    "seatsOrRoom": "22A"
  },
  {
    "type": "lodging",
    "title": "Park Hyatt Tokyo",
    "date": "2026-06-01",
    "nights": 4,
    "location": "3-7-1-2 Nishishinjuku, Tokyo",
    "confirmation": "HZ998877",
    "seatsOrRoom": "1704"
  }
]
```

---

## Time zones (important)

Event times are **anchored to the destination**, not to the viewer. A 7:00 PM dinner in Paris
**always displays as 7:00 PM in this app**, whether you open it from Los Angeles, New York, or
Tokyo. This is the standard "destination local time" model used by travel apps.

**The time zone is detected automatically from each item's location — you never pick one.**
When you type a location (or, for travel, the from/to), the app geocodes it and derives the IANA
time zone offline with `tz-lookup` (results cached in your browser). Cards show the zone
(e.g. `7:00 PM · CEST · Paris`) whenever it differs from your device, so it's never ambiguous.

Geocoding uses the **Google Maps JavaScript API** when a Maps API key is configured (most
accurate for real addresses), and falls back to keyless OpenStreetMap Nominatim otherwise.

- No location? The item falls back to your device's time zone (the form tells you when this
  happens — just add a city/country to fix it).
- For flights, the departure (`from`) determines the time zone, matching the shown departure time.

Note: the **native Google Calendar app** always renders events in the *viewer's* current time
zone (that's a Google behavior we can't change via the API), so a Paris 7pm event may appear at
a converted time there. **This web app** always shows the true destination time. If you want the
destination time everywhere, use the app (or add it to your Home Screen — see below).

## Install on iPhone (optional, recommended)

Open the site in Safari → Share → **Add to Home Screen**. It launches full-screen like a native
app (dark theme, no browser chrome), which also guarantees times display in destination-local
time.

## How data maps to Google Calendar

| App concept | Google Calendar |
|---|---|
| Trip | A secondary calendar (name = trip; dates + marker stored in its description) |
| Itinerary item | An event (`summary`, `start`/`end`, `location`, `description`) |
| Typed fields (subtype, from/to, confirmation…) | `event.extendedProperties.private.gedata` (JSON) |
| Share a trip | ACL rule (`writer`/`reader`) on the calendar |

The dual representation means events are **human-readable in any calendar app** and
**round-trip perfectly** back into typed forms in this app. Editing an event's time in Google
Calendar directly is respected on next load.

## Tech

Vite + React + TypeScript + Tailwind CSS. Google Identity Services (token flow) + Google
Calendar REST API via `fetch`. No backend.

## Roadmap / not yet ported

- Weather header (OpenWeatherMap, client-side, user key) — hook exists in `config.ts`.
- Map view of a day's items (Google Maps embed / Leaflet).
- Reservation summary / print view.
- Photo attachments (via Google Drive links).
