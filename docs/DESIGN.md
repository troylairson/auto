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

Confirmed: hosted on the always-on **ZimaOS** box, **ntfy** for push, **TypeScript**,
**miles only**. Household vehicles: **2021 Honda Pilot** and **2011 Toyota Tacoma TRD Sport**
(see section 5.5).

| Decision | Choice | Why |
|---|---|---|
| Hosting | Docker container on the home ZimaOS machine (see section 10) | Personal data, already always on, zero cost |
| Remote access | Tailscale (or Cloudflare Tunnel + Access) | Keeps the app off the public internet, so the app's own auth can stay minimal |
| Stack | **SvelteKit** (TypeScript, full-stack) + **SQLite** via **Drizzle ORM** | One codebase, one process, server-rendered forms work without much JS, small footprint |
| Styling | Tailwind CSS, mobile-first | Fast to build, looks fine without design effort |
| Auth | Simple per-person login (username + password, argon2 hash, long-lived session cookie) | Know *who* logged a service, per-person notification prefs; no OAuth complexity |
| Scheduler | In-process daily job (`node-cron`) | No separate worker or queue needed at this scale |
| Notifications | **ntfy** push via ntfy.sh, one long random topic per person | Free phone push (iOS and Android) with no app store work; ntfy.sh delivers on iOS without extra relay setup |
| Units | Miles only | No unit conversion anywhere |
| Vehicle data | NHTSA vPIC API (free) for VIN decode; NHTSA Recalls API (free) later | No API keys, no cost |
| Files | Receipt images stored on disk in a mounted volume | Simple; included in backups |
| Backups | Nightly SQLite `.backup` + uploads directory copied to a backup location | Lose at most one day |


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
  drivetrain ENUM(2wd, 4wd, awd) NULL, transmission TEXT NULL,
  maintenance_minder BOOL,         -- Honda-style oil-life / code system (section 5.6)
  primary_driver_id -> users NULL,
  archived_at NULL,                -- sold/retired: hidden but history kept
  notes, photo_path NULL, created_at

odometer_readings
  id, vehicle_id, reading_date, mileage INT,
  oil_life_pct INT NULL,           -- minder vehicles only: % shown on the dash
  minder_code TEXT NULL,           -- minder vehicles only: e.g. "B13" if displayed
  source ENUM(manual, service, initial),
  created_by -> users

schedule_templates
  id, name, fuel_type NULL, description

template_items
  id, template_id, name, category,
  interval_miles INT NULL, interval_months INT NULL,
  severe_interval_miles INT NULL, severe_interval_months INT NULL,
  first_due_miles INT NULL,        -- e.g. first coolant change at 100k, then every 50k
  first_due_months INT NULL,
  minder_code TEXT NULL,           -- "A", "B", "1".."7" for minder vehicles
  applies_to_drivetrain NULL,      -- e.g. rear diff only on awd/4wd
  notes                            -- "check owner's manual for spec"

maintenance_items                  -- per-vehicle schedule
  id, vehicle_id, template_item_id NULL (NULL = custom item),
  name, category,
  interval_miles INT NULL, interval_months INT NULL,
  first_due_miles INT NULL, first_due_months INT NULL,
  minder_code TEXT NULL,
  enabled BOOL,
  baseline_date DATE NULL,         -- "last done" when there's no service record yet
  baseline_mileage INT NULL,
  snoozed_until DATE NULL,
  notes

service_records
  id, vehicle_id, service_date, mileage INT,
  vendor NULL ("Jiffy Lube", "DIY"), total_cost_cents INT NULL,
  minder_code NULL,                -- code that prompted the visit, e.g. "B13"
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
The same checklist is how the two existing vehicles get set up on day one: fill it
in from whatever receipts and memory are available.

### 5.5 Household vehicle templates

These two ship as named templates next to the generic ones. The intervals come from
recollection of the manufacturer schedules plus common practice for vehicles of this age.
**Each item is flagged "verify against manual" until it has been checked against the Honda
owner's manual / Toyota Warranty & Maintenance Guide**. Then the flag is cleared in the
schedule editor.

#### 2021 Honda Pilot (3.5L V6, Maintenance Minder)

The Pilot doesn't use a fixed schedule. Its **Maintenance Minder** shows oil life %
and a code (main item A or B, plus sub-items 1–7) when service is due. The app follows
the Minder (section 5.6). Fixed intervals below are only **fallback estimates**, used when no
Minder information has been entered.

| Code | Item | Fallback estimate |
|---|---|---|
| A | Engine oil | Oil-life %, else 7,500 mi / 12 mo (Honda: at least yearly) |
| B | Oil + filter + inspection (brakes, parking brake, steering/suspension, boots, hoses, fluids, exhaust) | Every other oil change, ~15,000 mi / 12 mo |
| 1 | Tire rotation | 7,500 mi |
| 2 | Engine air filter, cabin air filter, drive belt inspection | Cabin 15,000 mi / 12 mo; engine 30,000 mi |
| 3 | Transmission fluid (6-speed or 9-speed depending on trim, different fluid) | 30,000 mi |
| 4 | Spark plugs, timing belt + water pump inspection, valve clearance | ~100,000 mi / 120 mo. Belt, tensioner and water pump are usually done together |
| 5 | Engine coolant | First 120,000 mi / 120 mo, then 60,000 mi / 60 mo |
| 6 | Rear differential fluid (**AWD only**) | 30,000 mi. Honda has a 2024 service bulletin for 2016–22 Pilot rear differentials |
| 7 | Brake fluid | 36 mo |
| — | Wiper blades | 12 mo |
| — | Battery test | 12 mo once the vehicle is over 3 years old (now) |

#### 2011 Toyota Tacoma TRD Sport (4.0L V6, timing chain)

Toyota uses a fixed schedule. The 4.0L V6 has a **timing chain**, so there's no timing belt item.
At 15 years old, age-related inspections are added and the "inspect" items Toyota lists
are turned into concrete replace intervals.

| Item | Interval | Note |
|---|---|---|
| Engine oil & filter | 5,000 mi / 6 mo | Toyota spec for this era; new drain plug gasket |
| Tire rotation | 5,000 mi | Do it with every oil change |
| Multi-point inspection (brakes, ball joints, steering linkage, boots, exhaust) | 15,000 mi / 12 mo | |
| Cabin air filter | 15,000 mi / 12 mo | |
| Engine air filter | 30,000 mi / 36 mo | |
| Rear differential oil | 30,000 mi | Toyota lists "inspect", or 15k if towing |
| Front differential + transfer case oil | 30,000 mi | **4x4 only** |
| Propeller shaft grease | 5,000 mi | 4x4 / towing / off-road, disabled by default |
| Automatic transmission fluid (or manual gear oil) | 60,000 mi | Toyota lists "inspect"; drain-and-fill recommended |
| Brake fluid | 36 mo | |
| Engine coolant (Toyota SLLC) | First 100,000 mi / 120 mo, then 50,000 mi / 60 mo | Almost certainly past the first one, so use the catch-up checklist |
| Spark plugs (iridium) | 120,000 mi | |
| Drive belt inspection | 60,000 mi / 60 mo | |
| Frame & underbody corrosion inspection | 12 mo | This truck generation is known for frame rust |
| Battery test, hoses, shocks | 12 mo | Age-related |
| Wiper blades | 12 mo | |

Set `usage_profile = severe` for the Tacoma if it tows, goes off-road, or mostly does
short trips. That switches oil to 5,000 mi / 6 mo with shorter diff and ATF intervals.

### 5.5a Usual items vs. more items

Showing every item made the app feel too granular. Each item has a `core` ("usual") flag:
- **Usuals** (oil, tire rotation, air filters, wipers, battery test, brake/multi-point
  inspection) always show.
- **Everything else** is folded under "More items" on the vehicle page, log form and
  catch-up page. It appears on Home, in Up next, in reminders and in the calendar only once
  real information (a logged service, a last-done date or a Minder code) says it's due soon or
  later. It never shows as Unknown.

The rule is `isSurfaced()` in `src/lib/due.ts`. Defaults come from `extraItemNames` in the
seed templates, and each item can be changed in Edit schedule.

### 5.6 Maintenance Minder support (Pilot)

Mirror what the car says. Don't try to out-guess its algorithm.

- **Oil life %**: the "Update mileage" sheet for a Minder vehicle has an optional
  "Oil life %" field. After an oil change, oil life resets to 100%. The app
  fits a %-per-day rate from readings since then and projects the date the car will hit 15%
  (the Minder's own "due soon" point) and 5% ("due"). That projection replaces
  the fixed interval for the A/B item. The 12-month cap still applies.
- **Minder codes**: when the dash shows a code like **B13**, enter it on the mileage sheet. The
  app parses it (main item `B`, sub-items `1`, `3`). Every item with a matching
  `minder_code` immediately becomes **Due**, whatever its fallback estimate says, and a
  push goes out.
- **Logging service**: the Log service form for a Minder vehicle has a "Minder code"
  field. Typing `B13` checks the matching items automatically. The code is saved on the record,
  so the history reads like the car's own log.
- **Without Minder input**: items fall back to the estimates in 5.5. Their due dates show as
  "est." so it's clear the car has the final say.

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

**Status:** Phases 0–3 are built, plus the nightly backup, PWA manifest and per-year spend
from Phase 4. Differences from the plan:
- The first login is created on a one-time `/setup` page instead of with a CLI script. Later logins are added in Settings.
- Email is left out; ntfy only.
- Due thresholds are constants in `src/lib/due.ts`, not settings.

### Phase 0: Skeleton (½ day) ✅
- SvelteKit + TypeScript + Tailwind + Drizzle + SQLite set up; Dockerfile and compose with `./data` volume.
- Migrations, seed loader for templates.
- Login page, `users` table, first-run `/setup` page.

### Phase 1: Vehicles and schedules (1–2 days) ✅
- Add/edit/archive vehicle (manual entry).
- Seed templates: generic gas/diesel/hybrid/EV **plus "2021 Honda Pilot" and "2011 Toyota Tacoma V6"** (section 5.5).
- Copy template into `maintenance_items` on create; edit schedule page (with "verified" flag).
- Odometer readings + quick "update mileage" (with oil life % / Minder code for Minder vehicles).

### Phase 2: Records and due logic, the MVP (2 days) ✅
- `due.ts` with thorough tests (mileage projection, whichever-first, first-due, unknown/baseline, snooze,
  oil-life projection, Minder-code parsing and overrides).
- Log service form (multiple items, unscheduled work, cost, notes).
- Vehicle detail: Schedule + History tabs. Dashboard "Up next."
- Catch-up checklist on vehicle create. Use it to enter the Pilot and Tacoma.
- **At this point the app works without reminders. Start using it.**

### Phase 3: Reminders (1 day) ✅
- ntfy push adapter; per-user topic settings + "send test notification" button.
- Daily job with state-change detection and `notification_log`; weekly digest; stale-odometer nudge.
- Deep links into pre-filled log form. `.ics` calendar feed.

### Phase 4: Nice-to-haves (as wanted)
- VIN decode via NHTSA vPIC.
- Receipt photo uploads + thumbnails.
- PWA manifest ✅ + service worker (offline shell).
- Open recalls check (NHTSA Recalls API by year/make/model) shown on vehicle Info tab, checked
  weekly with a push when a new recall appears. Especially worthwhile for the 2011 Tacoma.
- CSV export of history (useful when selling a car); printable service history page.
- Spend reports: per vehicle per year ✅ (Info tab); charts later.
- Nightly backup job + documented restore ✅.

## 10. Deployment (ZimaOS)

ZimaOS runs Docker apps and can install a custom app from a Docker Compose file. Building
images on the ZimaOS box itself is awkward, so images are built elsewhere:

1. **Build**: a GitHub Actions workflow builds the image on every push to `main` and
   publishes it to GitHub Container Registry as `ghcr.io/troylairson/auto:latest` (linux/amd64,
   which matches Zima hardware). The image holds only app code, never data, so the
   package can be public. Otherwise, run `docker login ghcr.io` once on the box over SSH.
2. **Install**: in the ZimaOS dashboard, use App Store → Custom Install → Import, paste the compose
   file below, and install.
3. **Data**: everything persistent lives in `/DATA/AppData/auto/data` (database, uploads,
   backups), so reinstalling or updating the container never touches it.
4. **Remote access**: install **Tailscale** from the ZimaOS app store, and on phones too.
   `tailscale serve` gives the app an HTTPS URL on the tailnet, which the PWA install and
   phone camera upload need.
5. **Update**: pull the new image and recreate the container from the ZimaOS app settings, or
   run `docker compose pull && docker compose up -d` over SSH.

```yaml
# docker-compose.yml (ZimaOS custom install)
name: auto
services:
  auto:
    image: ghcr.io/troylairson/auto:latest
    container_name: auto
    restart: unless-stopped
    ports: ["3000:3000"]
    volumes:
      - /DATA/AppData/auto/data:/app/data
    environment:
      TZ: America/Chicago                  # set to local zone: reminders fire at 7:00 local
      ORIGIN: https://auto.<tailnet>.ts.net
      SESSION_SECRET: <random 32+ chars>
      NTFY_URL: https://ntfy.sh
```

ntfy setup: install the ntfy app on each phone and subscribe to that person's topic. Topics
are generated by the app (e.g. `auto-troy-8f3k2q9x…`) and shown in Settings with a "send
test" button. Anyone who knows a topic name can read it on ntfy.sh, so topics are long and
random and messages contain only vehicle/item names.

Backups: the nightly job writes `/DATA/AppData/auto/data/backups/auto-YYYY-MM-DD.db` and keeps 30 copies.
To keep a copy off the box, point ZimaOS's built-in backup or sync at `/DATA/AppData/auto`.

## 11. Answers so far

- Pilot: 9-speed, AWD, so the rear differential (Minder 6) item applies.
- Tacoma: 4x4, no towing or off-road, so normal usage; the front diff and transfer case items apply.
  Automatic or manual not yet confirmed: the "Transmission fluid" item covers either.
- Time zone: Eastern (`America/New_York`).
- Logins: Troy and Lexi.
- Current mileage and service history: entered in the app when adding each vehicle (catch-up checklist).
