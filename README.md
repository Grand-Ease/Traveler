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
3. **Restrict** the key (recommended): under *Application restrictions* choose **Websites** and
   add your origins (`http://localhost:5173/*`, `https://<username>.github.io/*`); under
   *API restrictions* limit it to **Maps JavaScript API**.
4. Paste the key in the app's first-run setup (or later via the Settings gear on the Home
   screen). Without it, the app uses a keyless geocoder fallback.

---

## 2. Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173, paste your Client ID once when prompted (stored in your browser),
and sign in. Optionally create `.env.local` from `.env.example` to bake the ID in.

## 3. Deploy to GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. (Optional) **Settings → Secrets and variables → Actions** → add `VITE_GOOGLE_CLIENT_ID`
   to bake the Client ID into the build. If you skip this, users enter it once in-app.
4. Every push to `main` builds and deploys via `.github/workflows/deploy.yml`.
5. Add your Pages URL (`https://<username>.github.io/<repo>`) to the OAuth **Authorized
   JavaScript origins** (just the origin, no path).

---

## 4. Sharing a trip

Open a trip on the Home screen → **Share** → enter a Google email and pick "Can edit" or
"View only". They sign in to the app (or just open Google Calendar) and the trip is there.
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
