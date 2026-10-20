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

## Install on ZimaOS (over SSH)

Merging to `main` makes GitHub Actions build and publish `ghcr.io/troylairson/auto:latest`.
On the Zima box everything runs from one Compose file in `/DATA/AppData/auto`.
ZimaOS doesn't allow installing system packages, so Tailscale runs as a container next to the app.

**1. Connect.** Turn on SSH in the ZimaOS settings, then run `ssh <user>@<zima-ip>`. Prefix the
`docker` commands with `sudo` if your user isn't in the docker group.

**2. Create the Compose file.**

```sh
mkdir -p /DATA/AppData/auto && cd /DATA/AppData/auto
cat > docker-compose.yml <<'YAML'
name: auto
services:
  tailscale:
    image: tailscale/tailscale:stable
    container_name: tailscale
    hostname: zima
    network_mode: host
    cap_add: [NET_ADMIN, NET_RAW]
    devices: ["/dev/net/tun:/dev/net/tun"]
    volumes: ["/DATA/AppData/tailscale:/var/lib/tailscale"]
    environment:
      TS_STATE_DIR: /var/lib/tailscale
      TS_USERSPACE: "false"
    restart: unless-stopped

  auto:
    image: ghcr.io/troylairson/auto:latest
    container_name: auto
    restart: unless-stopped
    ports: ["3000:3000"]
    volumes: ["/DATA/AppData/auto/data:/app/data"]
    environment:
      TZ: America/New_York
      ORIGIN: https://zima.CHANGE-ME.ts.net
      NTFY_URL: https://ntfy.sh
YAML
```

**3. Start Tailscale and get the HTTPS address.** In the Tailscale admin console, on the DNS
page, turn on MagicDNS and HTTPS certificates first.

```sh
docker compose up -d tailscale
docker exec tailscale tailscale up             # open the printed link and approve the device
docker exec tailscale tailscale serve --bg 3000
docker exec tailscale tailscale serve status   # shows https://zima.<tailnet>.ts.net
```

If Tailscale is already installed from the ZimaOS App Store, delete the `tailscale` service
from the file and run `tailscale serve --bg 3000` with that install.

**4. Set `ORIGIN` and start the app.**

```sh
sed -i 's#https://zima.CHANGE-ME.ts.net#https://zima.<tailnet>.ts.net#' docker-compose.yml
# Only if the ghcr.io package is private (token needs read:packages):
# echo <token> | docker login ghcr.io -u troylairson --password-stdin
docker compose up -d auto
docker logs auto     # ends with "Listening on http://0.0.0.0:3000"
```

**5. First run.**
1. Open `https://zima.<tailnet>.ts.net` (install Tailscale on the phones too) and create Troy's login.
2. Add Lexi under **Settings → Household**.
3. Each person installs the **ntfy** app, subscribes to the topic shown in their Settings, and taps
   **Send test notification**.
4. Add the Pilot (AWD, 9-speed) and the Tacoma (4x4) with their current odometer readings, then
   fill in the catch-up checklist.

**Use one URL.** Always open the app through the `ORIGIN` address. SvelteKit rejects form
submissions from any other origin, as protection against cross-site request forgery, so the
LAN IP address will load pages but saving will fail. If you'd rather use a LAN address, set
`ORIGIN` to that address instead.

### Day to day

```sh
cd /DATA/AppData/auto
docker compose pull auto && docker compose up -d auto   # update to the latest image
docker logs -f auto                                     # logs
docker compose restart auto                             # restart
```

Containers started over SSH may appear in the ZimaOS dashboard, but ZimaOS doesn't manage
them, so run updates and changes from SSH.

*Prefer the dashboard?* Use App Store → Custom Install → Import and paste the repo's
[`docker-compose.yml`](docker-compose.yml) (app only). Set `ORIGIN`, and install Tailscale from the App Store.

### Configuration

| Variable | Default | Purpose |
|---|---|---|
| `ORIGIN` | (none) | Public URL of the app. Required for form posts and notification links |
| `TZ` | `America/New_York` | Time zone for "today", 07:00 reminders and 03:30 backups |
| `NTFY_URL` | `https://ntfy.sh` | ntfy server |
| `NTFY_TOKEN` | (none) | Access token if your ntfy server requires one |
| `DATA_DIR` | `/app/data` | Database and backups (mounted from `/DATA/AppData/auto/data`) |
| `PORT` | `3000` | HTTP port |

### Backups and restore

Backups are written to `/DATA/AppData/auto/data/backups/auto-YYYY-MM-DD.db`, and the last 30
are kept. To keep a copy off the box, point ZimaOS backup or sync at `/DATA/AppData/auto`.

To restore:

```sh
cd /DATA/AppData/auto
docker compose stop auto
cp data/backups/auto-YYYY-MM-DD.db data/auto.db && rm -f data/auto.db-wal data/auto.db-shm
docker compose start auto
```

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
