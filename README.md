# Auto

A small self-hosted web app for tracking maintenance on the household's vehicles. You add
a vehicle, get a maintenance schedule based on mileage and age, log services when they're
done, and get ntfy push reminders when something is coming due.

Design and reasoning: [docs/DESIGN.md](docs/DESIGN.md).

## What it does

- **Vehicles** come with a schedule copied from a template. Generic gas/diesel/hybrid/EV
  templates are included, plus ones for the **2021 Honda Pilot** (Maintenance Minder) and the
  **2011 Toyota Tacoma V6**. Items that don't match the drivetrain are skipped: AWD-only
  items for a 2WD vehicle, 4x4-only items for a 4x2. Every interval can be edited and marked
  verified once checked against the owner's manual.
- **Catch-up checklist** for entering when each item was last done (or "never", or "don't know").
- **Due status** for each item: whichever comes first of miles or months. Today's mileage
  is estimated from recent odometer readings.
- **Maintenance Minder (Pilot)**: enter the oil life % or the code shown on the dash
  (e.g. `B13`) when updating mileage. The matching items become due, and typing the code on
  the log form checks them for you.
- **Log service**: one visit can cover several items, plus unscheduled repairs, cost,
  where it was done, and notes. Records can be edited and deleted.
- **Reminders**: checked daily at 07:00. You get a push when an item becomes due soon,
  due, or overdue (overdue repeats weekly), and a nudge when the mileage hasn't been
  updated in 30 days. Sundays add a summary. Tapping a notification opens the log form
  with those items already checked.
- **Calendar feed** (`.ics`) of due dates for Google or Apple Calendar.
- **Nightly database backups**, keeping the last 30.

## Install on ZimaOS

1. **Image.** Merging to `main` makes GitHub Actions build and publish
   `ghcr.io/troylairson/auto:latest`. In GitHub, go to the repo → Packages → `auto` →
   Package settings and either make the package **public** (it contains only code, no
   data), or run `docker login ghcr.io` once on the Zima box over SSH.
2. **Remote access.** Install **Tailscale** from the ZimaOS App Store and on both phones.
   On the Zima box, run `tailscale serve --bg 3000` to get an HTTPS URL like
   `https://zima.your-tailnet.ts.net`.
3. **Install the app.** In ZimaOS, go to App Store → Custom Install → Import and paste
   [`docker-compose.yml`](docker-compose.yml). Set `ORIGIN` to the Tailscale URL from step 2.
   Data is stored in `/DATA/AppData/auto`.
4. **First run.** Open the URL and create Troy's login, then add Lexi under
   **Settings → Household**.
5. **Notifications.** Each person installs the **ntfy** app, subscribes to the topic
   shown in their Settings, and taps **Send test notification**.
6. **Vehicles.** Add the Pilot (AWD, 9-speed) and the Tacoma (4x4) with their current
   odometer readings, then fill in the catch-up checklist.

**Use one URL.** Always open the app through the address in `ORIGIN`. SvelteKit rejects
form submissions from any other origin, as protection against cross-site request forgery,
so the LAN IP address will load pages but saving will fail. If you'd rather use a LAN
address, set `ORIGIN` to that address instead.

**Updating:** pull the new image and recreate the container from the ZimaOS app
settings, or run `docker compose pull && docker compose up -d`.

### Configuration

| Variable | Default | Purpose |
|---|---|---|
| `ORIGIN` | (none) | Public URL of the app. Required for form posts and notification links |
| `TZ` | `America/New_York` | Time zone for "today", 07:00 reminders and 03:30 backups |
| `NTFY_URL` | `https://ntfy.sh` | ntfy server |
| `NTFY_TOKEN` | (none) | Access token if your ntfy server requires one |
| `DATA_DIR` | `/app/data` | Database, backups |
| `PORT` | `3000` | HTTP port |

### Backups and restore

Backups are written to `/DATA/AppData/auto/backups/auto-YYYY-MM-DD.db`. To keep a copy off
the box, point ZimaOS backup or sync at `/DATA/AppData/auto`. To restore, stop the
container, copy a backup over `auto.db`, delete `auto.db-wal` and `auto.db-shm`, and start
the container again.

## Development

```sh
npm install
npm run dev          # http://localhost:5173, data in ./data
npm test             # due-date logic tests
npm run check        # type check
npm run build && npm start
npm run db:generate  # after changing src/lib/server/db/schema.ts
```

Stack: SvelteKit (Svelte 5), SQLite via better-sqlite3 and Drizzle, Tailwind CSS, node-cron.
The due-date logic lives in `src/lib/due.ts` as pure functions, with tests in `src/lib/due.test.ts`.
