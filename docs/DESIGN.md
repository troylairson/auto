# Auto — Household Vehicle Maintenance Tracker

Design and implementation plan for a small, self-hosted web app that tracks
maintenance for the vehicles in one household.

## 1. Goals and non-goals

### Goals
1. **Add a vehicle** quickly (VIN decode optional) and give it a starting odometer reading.
2. **Get recommended maintenance** based on mileage *and* age: each item comes due
   at "X miles or Y months, whichever comes first."
3. **Record maintenance** when it's done, either DIY or at a shop, with cost, notes, and an optional receipt photo.
4. **Get reminders** before things are due and when they're overdue.
5. Easy to use **from a phone in the garage or at the shop counter**.

### Non-goals (on purpose)
- Multi-tenant accounts, sign-up flows, billing, roles/permissions beyond "household member."
- Fuel economy tracking, trip logging, parts inventory, shop marketplace.
- Paid data feeds for exact OEM schedules. The defaults are generic and you can edit them.
- Native mobile apps. An installable PWA covers it.
- High availability. One container, one SQLite file, nightly backup.

## 2. Key design decisions

| Decision | Choice | Why |
|---|---|---|
| Hosting | Self-hosted Docker container on a home server/NAS/Raspberry Pi (or a $5 VPS) | Personal data, near-zero cost |
| Remote access | Tailscale (or Cloudflare Tunnel + Access) | Keeps the app off the public internet, so the app's own auth can stay minimal |
| Stack | **SvelteKit** (TypeScript, full-stack) + **SQLite** via **Drizzle ORM** | One codebase, one process, server-rendered forms work without much JS, small footprint |
| Styling | Tailwind CSS, mobile-first | Fast to build, looks fine without design effort |
| Auth | Simple per-person login (username + password, argon2 hash, long-lived session cookie) | Know *who* logged a service, per-person notification prefs; no OAuth complexity |
| Scheduler | In-process daily job (`node-cron`) | No separate worker or queue needed at this scale |
| Notifications | **ntfy** push (self-hosted or ntfy.sh) + optional **email** (SMTP) | ntfy gives free phone push with no app store dev work; email for a weekly digest |
| Vehicle data | NHTSA vPIC API (free) for VIN decode; NHTSA Recalls API (free) later | No API keys, no cost |
| Files | Receipt images stored on disk in a mounted volume | Simple; included in backups |
| Backups | Nightly SQLite `.backup` + uploads directory copied to a backup location | Lose at most one day |

Alternative if you prefer Python: FastAPI + HTMX + SQLModel + APScheduler would
work the same way. The data model and logic below don't depend on the stack.

## 3. Core concepts

- **Vehicle**: a car/truck/motorcycle with a fuel type (gas, diesel, hybrid, EV) and a usage profile (normal vs. severe).
- **Odometer reading**: a dated mileage value. Readings come from service records or quick "update mileage" entries. Used to estimate miles/day.
- **Schedule template**: a reusable list of maintenance items with default intervals (e.g. "Generic Gasoline Car," "Generic EV").
- **Maintenance item**: one vehicle's copy of a scheduled task (e.g. "Oil & filter, every 5,000 mi / 6 mo"). It is copied from a template when the vehicle is added and can then be edited, disabled, or added to.
- **Service record**: one event (a shop visit or a DIY session) on a date at a mileage. It covers **one or more** maintenance items, plus a cost, vendor, notes, and attachments.
- **Due status**: computed from the last time each item was done, the item's intervals, today's date, and estimated current mileage.

## 4. Data model (SQLite)

```
users
  id, name, username, password_hash,
  email NULL, ntfy_topic NULL,
  notify_push BOOL, notify_email_digest BOOL,
  created_at

vehicles
  id, nickname ("Blue CR-V"), year, make, model, trim NULL,
  vin NULL, license_plate NULL,
  fuel_type  ENUM(gas, diesel, hybrid, ev),
  usage_profile ENUM(normal, severe),
  in_service_date DATE NULL,       -- purchase/first-registration date, used for age-based items
  primary_driver_id -> users NULL,
  archived_at NULL,                -- sold/retired: hidden but history kept
  notes, photo_path NULL, created_at

odometer_readings
  id, vehicle_id, reading_date, mileage INT,
  source ENUM(manual, service, initial),
  created_by -> users

schedule_templates
  id, name, fuel_type NULL, description

template_items
  id, template_id, name, category,
  interval_miles INT NULL, interval_months INT NULL,
  severe_interval_miles INT NULL, severe_interval_months INT NULL,
  first_due_miles INT NULL,        -- e.g. first coolant change at 100k, then every 50k
  notes                            -- "check owner's manual for spec"

maintenance_items                  -- per-vehicle schedule
  id, vehicle_id, template_item_id NULL (NULL = custom item),
  name, category,
  interval_miles INT NULL, interval_months INT NULL,
  first_due_miles INT NULL,
  enabled BOOL,
  baseline_date DATE NULL,         -- "last done" when there's no service record yet
  baseline_mileage INT NULL,
  snoozed_until DATE NULL,
  notes

service_records
  id, vehicle_id, service_date, mileage INT,
  vendor NULL ("Jiffy Lube", "DIY"), total_cost_cents INT NULL,
  notes, created_by -> users, created_at

service_record_items               -- many-to-many: one visit, many items
  service_record_id, maintenance_item_id NULL,
  description NULL,                -- for unscheduled work ("replaced wiper motor")
  cost_cents NULL

attachments
  id, service_record_id, file_path, mime_type, original_name, created_at

notification_log
  id, user_id, vehicle_id, maintenance_item_id NULL,
  kind ENUM(due_soon, due, overdue, digest, stale_odometer),
  sent_at, channel ENUM(push, email)
```

Notes:
- Due state is **never stored**. It is always computed, so it can't drift out of sync.
- Money is stored as integer cents.
- Unscheduled repairs fit naturally: a `service_record_item` with a description and no `maintenance_item_id`.

## 5. Recommendation and due-date logic

### 5.1 Default schedules

There is no free, reliable API for exact OEM schedules, so the app ships with
**generic templates** based on common modern-vehicle intervals. When you add a vehicle, the template
matching its fuel type is copied in. You then spend five minutes adjusting it against the owner's
manual. The UI says so and links to the item's notes.

Seed template: **Generic Gasoline** (normal / severe)

| Item | Normal | Severe |
|---|---|---|
| Engine oil & filter (synthetic) | 7,500 mi / 12 mo | 5,000 mi / 6 mo |
| Tire rotation | 7,500 mi / — | 5,000 mi / — |
| Tire pressure & tread check | — / 1 mo | — / 1 mo |
| Engine air filter | 30,000 mi / 36 mo | 15,000 mi / 18 mo |
| Cabin air filter | 15,000 mi / 12 mo | 10,000 mi / 12 mo |
| Brake inspection | 15,000 mi / 12 mo | 10,000 mi / 12 mo |
| Brake fluid | — / 36 mo | — / 24 mo |
| Wiper blades | — / 12 mo | — / 12 mo |
| Battery test | — / 12 mo (after 3 yrs age) | same |
| Coolant | first at 100,000 mi / 120 mo, then 50,000 mi / 60 mo | same |
| Spark plugs (iridium) | 100,000 mi / — | 60,000 mi / — |
| Transmission fluid (automatic) | 60,000 mi / — | 30,000 mi / — |
| Serpentine belt inspect/replace | 60,000 mi / 60 mo | same |
| Timing belt (if equipped; disabled by default) | 90,000 mi / 84 mo | 60,000 mi / 60 mo |
| State inspection / registration (optional) | — / 12 mo | — |

Other templates:
- **Diesel**: adds fuel filter and DEF; shorter oil interval.
- **Hybrid**: same as gas plus a hybrid battery cooling filter.
- **EV**: drops oil, spark plugs, transmission, and air filter; keeps tire rotation, cabin filter, brake fluid, coolant (battery loop), and wipers.

Templates are data (a seed JSON file loaded into `schedule_templates`), so you can add a
"2019 Honda CR-V (from manual)" template and reuse it.

### 5.2 Estimating current mileage

Mileage-based items need today's odometer, and nobody logs that daily.
- Take odometer readings from the last ~12 months (at least 2 readings, spanning at least 30 days).
- `miles_per_day` = linear fit (or simply the first-to-last slope) over those readings.
- `estimated_mileage(today) = last_reading + miles_per_day × days_since_last_reading`.
- Fallback when data is thin: use a per-vehicle "typical miles per year" setting (default 12,000).
- If the latest reading is more than 30 days old, the dashboard shows a "Update mileage?" prompt, and a reminder can be sent (`stale_odometer`).

### 5.3 Due computation per item

```
last_done  = most recent service_record_item for this item
             else (baseline_date, baseline_mileage)
             else (in_service_date, 0)        -- assume never done since new
             else UNKNOWN

due_mileage = last_done.mileage + interval_miles
              (or first_due_miles if never done and first_due_miles is set)
due_date    = last_done.date + interval_months

projected date for due_mileage = today + (due_mileage − est_mileage) / miles_per_day

effective_due_date = min(due_date, projected date for due_mileage)
```

Status (thresholds configurable in settings):

| Status | Rule |
|---|---|
| **Overdue** | past `due_date`, or `est_mileage ≥ due_mileage` |
| **Due** | within 7 days or 250 mi |
| **Due soon** | within 30 days or 1,000 mi |
| **OK** | otherwise |
| **Unknown** | no history and no baseline. Shown with a "When was this last done?" prompt |
| **Snoozed** | `snoozed_until` in the future |

Sort everything by `effective_due_date` so the dashboard reads as a timeline.

### 5.4 Onboarding a used vehicle

On "Add vehicle," after picking the template, show a **"Catch-up" checklist**: each
item with a "Last done: [date] [mileage] / Don't know / Never" field. Answers fill
`baseline_*`. "Don't know" leaves the item Unknown. The dashboard lists it as "do now
to establish a baseline," which is good advice anyway for a newly bought used car.

## 6. Reminders

A daily job runs at 7:00 local time:
1. For every active vehicle and enabled item, compute status.
2. When an item **changes state** (OK → Due soon → Due → Overdue) since the last
   notification, send a push to the vehicle's primary driver, or to everyone if none is set.
   `notification_log` prevents duplicate pushes.
3. Overdue items get at most one push per week until they're resolved or snoozed.
4. If odometer data is stale, send one "What's the mileage on the CR-V?" push. It links
   straight to the quick-update form.
5. **Sunday digest** (email and/or push): everything Due soon or worse across all
   vehicles, one line each.

Push messages include a deep link (`/vehicles/3/log?items=12,14`) that opens the
"Log service" form with those items pre-checked. Logging a service resolves the reminder
because status is recomputed.

**Calendar feed (cheap win):** an `.ics` URL per user with a secret token. It lists all-day events on
each item's `effective_due_date`, so due dates show up in Google/Apple Calendar too.

## 7. Screens

Mobile-first. Desktop just gets wider cards.

1. **Dashboard** (`/`)
   - One card per vehicle: photo/nickname, estimated mileage, count of overdue/due items.
   - "Up next" list across all vehicles, sorted by due date and color-coded by status.
   - Quick actions: **Log service**, **Update mileage**.
2. **Vehicle detail** (`/vehicles/:id`)
   - Tabs: **Schedule** (items with status, due date/mileage, last done) · **History**
     (service records, newest first, with costs and attachments) · **Info** (VIN, plate,
     notes, spend total and per-year).
3. **Log service** (`/vehicles/:id/log`)
   - Date (default today), mileage (pre-filled with estimate and *required*), vendor (autocomplete from past entries),
     checkboxes of scheduled items (due ones on top), "+ other work" free-text lines,
     total cost, notes, photo upload (phone camera via `<input capture>`).
   - Saving also records an odometer reading.
4. **Update mileage** (modal/sheet): vehicle + number + save. Two taps.
5. **Add/Edit vehicle**: VIN field with a "Decode" button (fills year/make/model/engine/fuel), nickname,
   fuel type, usage profile, in-service date, current mileage, template choice, then the
   catch-up checklist.
6. **Edit schedule** (`/vehicles/:id/schedule`): edit intervals, enable/disable, add custom item,
   "reset to template."
7. **Settings**: household members, notification channels per user (ntfy topic, email),
   thresholds, calendar feed URL, export.

## 8. Project structure (SvelteKit)

```
auto/
├─ src/
│  ├─ lib/server/
│  │  ├─ db/schema.ts          # Drizzle schema (section 4)
│  │  ├─ db/seed/templates.json
│  │  ├─ due.ts                # pure functions: mileage estimate + due status (section 5)
│  │  ├─ reminders.ts          # daily job, digest, notification_log
│  │  ├─ notify/ntfy.ts, notify/email.ts
│  │  ├─ vin.ts                # NHTSA vPIC client
│  │  └─ auth.ts               # sessions, argon2
│  ├─ routes/                  # pages from section 7 (+page.server.ts form actions)
│  └─ hooks.server.ts          # session lookup, start scheduler
├─ tests/                      # vitest: due.ts gets the most coverage
├─ data/                       # (volume) auto.db, uploads/, backups/
├─ Dockerfile, docker-compose.yml
└─ docs/DESIGN.md
```

`due.ts` is pure, with no DB or clock access: it takes readings, items, records, and `today` as inputs.
That makes the core logic easy to unit test with fixed dates.

## 9. Implementation plan

### Phase 0: Skeleton (½ day)
- SvelteKit + TypeScript + Tailwind + Drizzle + SQLite set up; Dockerfile and compose with `./data` volume.
- Migrations, seed loader for templates.
- Login page, `users` table, CLI script `npm run user:add` (no sign-up page needed).

### Phase 1: Vehicles and schedules (1–2 days)
- Add/edit/archive vehicle (manual entry).
- Copy template into `maintenance_items` on create; edit schedule page.
- Odometer readings + quick "update mileage."

### Phase 2: Records and due logic, the MVP (2 days)
- `due.ts` with thorough tests (mileage projection, whichever-first, first-due, unknown/baseline, snooze).
- Log service form (multiple items, unscheduled work, cost, notes).
- Vehicle detail: Schedule + History tabs. Dashboard "Up next."
- Catch-up checklist on vehicle create.
- **At this point the app works without reminders. Start using it.**

### Phase 3: Reminders (1 day)
- ntfy push + SMTP email adapters; per-user settings.
- Daily job with state-change detection and `notification_log`; weekly digest; stale-odometer nudge.
- Deep links into pre-filled log form. `.ics` calendar feed.

### Phase 4: Nice-to-haves (as wanted)
- VIN decode via NHTSA vPIC.
- Receipt photo uploads + thumbnails.
- PWA manifest + service worker (installable, home-screen icon).
- Open recalls check (NHTSA Recalls API by year/make/model) shown on vehicle Info tab.
- CSV export of history (useful when selling a car); printable service history page.
- Spend reports (per vehicle per year).
- Nightly backup job + documented restore.

## 10. Deployment

```yaml
# docker-compose.yml
services:
  auto:
    build: .
    restart: unless-stopped
    ports: ["3000:3000"]
    volumes: ["./data:/app/data"]
    environment:
      TZ: America/Chicago          # reminders fire on local time
      ORIGIN: https://auto.your-tailnet.ts.net
      SESSION_SECRET: ...
      NTFY_URL: https://ntfy.sh    # or self-hosted
      SMTP_URL: smtp://user:pass@smtp.example.com:587   # optional
```

- Reach it from phones via Tailscale (MagicDNS + `tailscale serve` provides HTTPS).
- Backups: nightly `sqlite3 auto.db ".backup backups/auto-YYYYMMDD.db"`, keep 30 copies, and sync
  `data/` to cloud storage or another machine.

## 11. Open questions

1. **Hosting target**: is there an always-on machine at home (NAS, Pi, mini PC), or a VPS?
2. **Notification preference**: is ntfy push OK, or would email/SMS only be better?
3. **Stack preference**: SvelteKit/TypeScript as proposed, or Python?
4. **Units**: miles only, or should km be supported per vehicle?
5. **Which vehicles?** Their exact makes/models let us replace generic templates with
   manual-accurate ones from the start.
