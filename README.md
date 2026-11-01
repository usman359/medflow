# MedFlow

A patient and appointment platform for a multi-clinic healthcare group.

- **Patients** book online without help, then manage or cancel from their account.
- **Reception** gets one live view of every appointment at their clinic, with one-click actions.
- **Doctors** see their day and week, patient context and history, and write visit notes.
- **Managers** run reports and configure clinics, doctors, services and working hours.
- **Administrators** manage users, roles and clinic access.

The four risky design choices, and where to find them:

| Requirement                                          | How it is met                                                                                                                                                                    |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Patients can complete a booking alone                | A URL-driven 6-step flow ([`src/server/booking/flow.ts`](src/server/booking/flow.ts)) with inline sign-up, so nobody loses their place.                                          |
| Staff can find and update an appointment quickly     | [Reception dashboard](src/app/staff/reception/page.tsx): defaults to today, filters in the URL, search by name/phone/reference, one-click Confirm / Check in / No-show / Cancel. |
| Role-based access is strict                          | Three layers (below), checked by [integration](tests/integration) and [e2e](tests/e2e/rbac.spec.ts) tests.                                                                       |
| Duplicate or overlapping bookings are handled safely | A Postgres exclusion constraint is the final authority (below), proven with 10 concurrent bookings.                                                                              |

## Stack

Next.js 16 (App Router, `proxy.ts`) · React 19 · TypeScript (strict) · Tailwind CSS v4 + shadcn/ui · Neon Postgres via Drizzle ORM (WebSocket pool driver) · Better Auth (email + password, database sessions) · Zod + React Hook Form · `@date-fns/tz` · Recharts · `nuqs` (URL state) · Vitest · Playwright + axe.

> This project uses a newer Next.js than most documentation. The relevant guides ship with the package in `node_modules/next/dist/docs/`.

## Getting started

```bash
npm install
cp .env.example .env.local        # then fill it in (see below)
npm run db:migrate                # create tables and the double-booking constraints
npm run db:seed                   # demo clinics, doctors, patients and ~190 appointments
npm run dev                       # http://localhost:3000
```

`.env.local`:

| Variable                                 | Notes                                                              |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `DATABASE_URL`                           | Neon connection string (pooled or direct).                         |
| `BETTER_AUTH_SECRET`                     | Generate with `openssl rand -base64 32`.                           |
| `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` in development.                            |
| `RESEND_API_KEY`, `EMAIL_FROM`           | Optional. Without a key, emails are printed to the server console. |

`npm run db:seed` **wipes every table** before reseeding, and refuses to run when `NODE_ENV=production`. The seed's dates are relative to the day you run it.

### Demo accounts

All use the password **`medflow-demo-2026`** (also shown on the sign-in page in development).

| Email                    | Role                 | Sees                                                                                |
| ------------------------ | -------------------- | ----------------------------------------------------------------------------------- |
| `patient@medflow.test`   | Patient              | Their own appointments                                                              |
| `reception@medflow.test` | Reception            | Riverside (also `reception.midtown@…`, `reception.lakeshore@…`)                     |
| `doctor@medflow.test`    | Doctor               | Dr. Rahim Khan's schedule (the other doctors use `firstname.lastname@medflow.test`) |
| `manager@medflow.test`   | Clinic manager       | Riverside + Midtown reports and settings                                            |
| `admin@medflow.test`     | System administrator | Everything, plus Users & roles                                                      |

## How it works

### Access control: three layers

1. **`src/proxy.ts`**: a cheap cookie-presence check that redirects signed-out visitors to `/sign-in?next=…`. It never touches the database and is _not_ a security boundary.
2. **Layouts** call `requireRole()` before anything streams, so forbidden pages return a real `403` (and unknown records a real `404`). Because of this, `loading.tsx` files live on leaf routes only; a `loading.tsx` above a role check would stream a `200` first.
3. **The data layer is the real boundary.** Every query and server action re-checks the role and clinic scope ([`src/server/auth.ts`](src/server/auth.ts)): `requireRole`, `requireClinicAccess`, `getClinicScope`. Clinic scope is applied in SQL, so out-of-scope rows can't be returned whatever the filters say. Records you may not see look identical to records that don't exist.

Roles live in a database column that clients can never set themselves; sessions aren't cached, so a role change applies on the next request.

### Preventing double bookings

1. **The database decides.** [`0001_booking_constraints.sql`](src/db/migrations/0001_booking_constraints.sql) adds `EXCLUDE USING gist` constraints so a doctor, and separately a patient, can't hold two active appointments that overlap in time, even from simultaneous requests.
2. **The booking service** ([`create-booking.ts`](src/server/booking/create-booking.ts)) is the only write path for new appointments. In order: replay a repeated idempotency key; check the doctor, clinic, service and visit type belong together; check the time is a real slot (not time off, not in the past, inside the window); insert; translate the constraint violation into `SLOT_TAKEN` with fresh alternatives.
3. **The UI** disables submit while pending, sends one idempotency key per attempt (kept across refreshes), and re-validates the chosen slot on every step.

### Appointment lifecycle

[`appointment-state.ts`](src/lib/appointment-state.ts) is a pure transition table (`requested → confirmed → checked_in → completed`, with `cancelled` and `no_show` branches; final states never reopen). [`transitionAppointment`](src/server/appointments/transition.ts) is the only way status changes. It checks visibility, the table, and that the row is still in the status the user was looking at, so two people can't apply conflicting changes. The audit event and patient notification are written in the same transaction.

### Time

Clinics have timezones. Weekly hours are stored as clinic-local times and expanded to absolute instants by a pure, DST-tested function ([`slots.ts`](src/server/availability/slots.ts)). "Today" and report days are computed per clinic ([`clinic-time.ts`](src/lib/clinic-time.ts)).

### Layout

```
src/
  app/                (public) · (auth) · account · staff/{reception,doctor,manager} · admin · api
  components/         ui (shadcn) and feature folders
  db/                 schema/ · migrations/ (generated + one hand-written) · seed.ts
  lib/                pure, client-safe code: domain constants, validation, formatting, state machine
  server/             "server-only" data layer: auth, booking, availability, appointments, reports, settings, admin
tests/
  integration/        real-database tests (booking race, status changes, management RBAC)
  e2e/                Playwright: RBAC, accessibility, the full patient → reception → doctor journey
```

Reads happen in server components; writes are server actions that parse with Zod, check authorisation, mutate in a transaction, record an audit event, then revalidate. Every action returns `{ ok, data } | { ok: false, error, fieldErrors }`.

## Testing

```bash
npm run typecheck && npm run lint
npm test                    # unit tests: no database needed
npm run test:integration    # needs DATABASE_URL and a seeded database
npm run test:e2e            # needs the app running and a seeded database
```

- **Unit** (`src/**/*.test.ts`): slot generation including both DST changes, the state machine per role, validation schemas, calendar files, date-range helpers.
- **Integration**: 10 concurrent bookings for one slot produce exactly one winner; idempotent replays; every authorisation rule for status changes (clinic scope, ownership, concurrent conflicting changes); settings and admin actions called directly as the wrong role (forbidden), lock-out protections, role changes keeping clinic scope and doctor links consistent.
- **End to end** (`tests/e2e`): role-by-role access checked by requesting URLs and endpoints directly; axe WCAG 2.1 A/AA scans plus a no-sideways-scroll check of every main screen on desktop and a phone viewport; and one story across three people (patient books and signs up → reception confirms and checks in → doctor writes a note and completes → patient sees the result).

Integration and e2e tests run against whatever `DATABASE_URL` points at. They create their own records and delete them afterwards, but **use a development database**, not production. Playwright reuses a dev server on port 3000 if one is running.

Automated accessibility checks catch only a portion of real problems. Keyboard and screen-reader passes are still worth doing before a release.

## Operational notes

- **Neon from slow or unreliable networks.** Opening new WebSocket connections occasionally fails or stalls, and idle connections get dropped. [`src/db/index.ts`](src/db/index.ts) retries failed connects, health-checks connections that have been idle, and handles the pool's `error` event (an unhandled one would crash the process). Please keep it.
- **Accounts.** Patients sign up themselves and can only ever be patients. Staff accounts are created by an administrator (Users & roles → Add staff), who sets a starting password and can reset it later (which also signs the person out everywhere). Staff accounts are created directly rather than through the public sign-up so the administrator isn't signed in as the new person.
- **Email.** Delivered through Resend when `RESEND_API_KEY` is set, otherwise logged. In-app notifications are always stored. Scheduled reminders are not built; the notification types already include `appointment_reminder` for when they are.
- **Patient records and privacy.** Reception can only find patients who already have an appointment at one of their clinics. Reports and CSV exports contain no patient names, emails or phone numbers. Visit notes are visible only to the treating doctor, and the audit log never stores note text.

## Not in scope

Online payments, video-call hosting (video visits are bookable and emailed a placeholder), password change and recovery for patients, scheduled reminders, and deactivating (rather than re-roling) user accounts.
# medflow
