# Atlas — Mini SaaS Dashboard

A small project-management dashboard: list, search, filter, create, edit and delete
projects, each with a **status**, **deadline**, **assigned team member** and **budget**.

Built with Next.js 16 (App Router), TypeScript, Tailwind CSS v4 and PostgreSQL,
with a REST API, JWT session authentication and an integration-tested data layer.

---

## Quick start

```bash
npm install
npm run db:setup     # creates the schema and loads 24 sample projects
npm run dev          # http://localhost:3000
```

Sign in with:

| Email | Password |
| --- | --- |
| `admin@example.com` | `password123` |

**No database installation is required.** With no `DATABASE_URL` set, the app runs on
[PGlite](https://pglite.dev) — PostgreSQL compiled to WebAssembly — stored in `./.pglite`.
It is the same PostgreSQL engine, the same SQL and the same schema you would run in
production; see [Database](#database) for pointing it at a real server.

---

## What it does

**Dashboard**

- Summary cards: total projects, active, total budget, overdue.
- Table of projects with status, deadline, assignee and budget — a real `<table>`
  on desktop that becomes a card list on phones.
- Deadlines are colour-coded: red once overdue, amber within a fortnight.
- Search across name, client and description, debounced so typing does not fire
  a request per keystroke.
- Filter by status and by team member; sort by name, deadline or budget.
- Server-side pagination with a configurable page size.
- Filters are mirrored into the URL, so a filtered view can be bookmarked or shared.

**Create and edit**

- A modal form for adding and editing, validated with the *same* Zod schema the
  API uses, so client and server can never disagree about what is valid.
- Errors are shown against the offending field; the server's validation errors
  are rendered the same way.
- Delete asks for confirmation first.

**Throughout**

- Light and dark themes, following the operating system preference.
- Keyboard accessible: the dialog traps focus, closes on <kbd>Esc</kbd>, restores
  focus on close, and every control has a label.
- Optimistic-feeling UI: skeletons on first load, a dimmed table while refetching,
  toasts on success.

---

## Tech choices

| Area | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16, App Router | One project for the UI and the API; server components handle the auth gate. |
| Language | TypeScript, `strict` | The domain types are shared by the API, the client and the tests. |
| Styling | Tailwind CSS v4 | No runtime CSS, and dark mode comes free. Shared primitives live in `src/components/ui.tsx`. |
| Database | PostgreSQL | Enum status column, a real foreign key and `count(*) FILTER (...)` for the summary. |
| Data access | `node-postgres` / PGlite + plain SQL | The queries are small enough that an ORM would add indirection without removing work. |
| Validation | Zod | One schema per operation, reused verbatim in the browser. |
| Auth | `jose` (JWT) + `bcryptjs` | Stateless sessions in an httpOnly cookie; no session table to manage. |
| Tests | `node:test` + PGlite | Real SQL, no test containers, no extra dependencies. |

---

## Project structure

```
src/
  app/
    page.tsx                  dashboard (server component: auth gate + initial filters)
    login/page.tsx            sign-in page
    api/
      auth/{login,logout,me}/ session endpoints
      projects/               GET (list) and POST (create)
      projects/[id]/          GET, PATCH, DELETE
      stats/                  summary counters
      team-members/           assignable people
  components/                 UI, split into presentational parts + one orchestrator
  lib/                        code shared by server and browser
    types.ts                  domain types
    validation.ts             Zod schemas (the single source of truth for input rules)
    api-client.ts             typed fetch wrapper used by every component
    format.ts                 currency/date formatting, pinned to one locale
    session.ts                JWT helpers (Edge-safe: no Node-only imports)
  server/                     server-only code
    schema.sql                the database schema
    db.ts                     driver selection and connection caching
    projects.ts               every SQL statement for the projects resource
    auth.ts                   login, cookie handling, current user
    api.ts                    shared route wrapper: one error envelope, auth guard
  proxy.ts                    route protection (Next 16's renamed middleware)
scripts/
  migrate.ts                  apply schema.sql
  seed.ts                     apply schema.sql and load sample data
tests/
  validation.test.ts          input rules
  projects.test.ts            repository integration tests against real SQL
```

---

## API

All endpoints require a session cookie and answer `401` without one. Errors share
one shape: `{ "error": string, "details"?: { "<field>": "<message>" } }`.

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/auth/login` | `{ email, password }` → sets the session cookie |
| `POST` | `/api/auth/logout` | clears the cookie |
| `GET` | `/api/auth/me` | the current user |
| `GET` | `/api/projects` | list; see the query parameters below |
| `POST` | `/api/projects` | create → `201` with the new project |
| `GET` | `/api/projects/:id` | one project |
| `PATCH` | `/api/projects/:id` | partial update — omitted fields are left alone |
| `DELETE` | `/api/projects/:id` | `204` on success |
| `GET` | `/api/stats` | totals for the summary cards |
| `GET` | `/api/team-members` | assignable people |

**`GET /api/projects` query parameters**

| Parameter | Values | Default |
| --- | --- | --- |
| `search` | matches name, client or description, case-insensitively | — |
| `status` | `active` \| `on_hold` \| `completed` | all |
| `assigneeId` | team member id | all |
| `sort` | `name` \| `status` \| `deadline` \| `budget` \| `created_at` | `deadline` |
| `order` | `asc` \| `desc` | `asc` |
| `page`, `pageSize` | `pageSize` is capped at 100 | `1`, `10` |

Anything outside those values is rejected with `422` rather than ignored — the sort
key is the one value interpolated into SQL, so it is validated against a whitelist.

```bash
# Log in, then list the overdue active work, most expensive first.
curl -c jar -X POST localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"password123"}'

curl -b jar 'localhost:3000/api/projects?status=active&sort=budget&order=desc'
```

Responses use a stable JSON shape: dates are `YYYY-MM-DD`, timestamps are UTC ISO
strings and budgets are numbers — formatted in SQL so that the two drivers cannot
disagree about how to hydrate `DATE`, `TIMESTAMPTZ` and `NUMERIC`.

---

## Database

Three tables — `users`, `team_members` and `projects` — defined in
[`src/server/schema.sql`](src/server/schema.sql). `projects.status` is a PostgreSQL
enum, so an invalid status is rejected by the database and not only by the
application; `assignee_id` is a foreign key with `ON DELETE SET NULL`, so removing a
person unassigns their projects instead of deleting them.

### Using a real PostgreSQL server

Set `DATABASE_URL` and everything else stays the same:

```bash
cp .env.example .env.local
# DATABASE_URL=postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres?sslmode=require

npm run db:migrate   # apply the schema
npm run db:seed      # optional sample data
npm run dev
```

Works with Supabase, Neon, Railway, RDS or a local server. `sslmode=require` in the
URL switches the driver to TLS.

### Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | development server |
| `npm run build` / `npm start` | production build and server |
| `npm test` | the full test suite |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:setup` | schema + sample data (skips seeding if data exists) |
| `npm run db:migrate` | schema only |
| `npm run db:reset` | wipe and reseed |

---

## Configuration

Every variable is optional in development. See [`.env.example`](.env.example).

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | *(unset — uses PGlite)* | PostgreSQL connection string |
| `AUTH_SECRET` | dev-only fallback | Signs session JWTs. **Required in production** — the app refuses to start without it. |
| `DATABASE_AUTO_MIGRATE` | `false` | Apply `schema.sql` on boot against a real server |
| `PGLITE_DATA_DIR` | `.pglite` | Where the embedded database is stored |
| `SEED_ADMIN_PASSWORD` | `password123` | Password for the seeded demo account |

---

## Tests

```bash
npm test
```

42 tests, no mocks of the database:

- **`validation.test.ts`** — the input rules, including two regressions worth
  keeping: an empty budget must not be coerced to `0`, and a `PATCH` that only
  changes the status must not blank out the fields it did not mention.
- **`projects.test.ts`** — the repository against an in-memory PGlite instance, so
  the enum cast, the `LEFT JOIN`, the filters, the ordering, the pagination clamp
  and the aggregate query are all really executed.

---

## Deployment

**Vercel / any Node host.** Set `DATABASE_URL` and `AUTH_SECRET`, run
`npm run db:migrate` once, and deploy. `next build` emits `.next/standalone`, a
self-contained server.

**Docker.** A multi-stage [`Dockerfile`](Dockerfile) and
[`docker-compose.yml`](docker-compose.yml) bring up PostgreSQL 16 and the app:

```bash
docker compose up --build
docker compose run --rm seed     # load the sample data, once
```

The image runs the standalone server as a non-root user and applies the schema on
boot. *Note: the standalone build was verified locally, but the Docker image itself
has not been built — Docker was not available on the machine this was developed on.*

---

## Notes and trade-offs

- **Why plain SQL instead of an ORM.** There is one non-trivial query (the filtered,
  sorted, paginated list) and one aggregate. Prisma or Drizzle would have added a
  schema language, a migration engine and a generated client to express that. The
  SQL is confined to `src/server/projects.ts`; nothing else in the codebase builds a
  query.
- **Why the dashboard fetches over HTTP** rather than reading the database in the
  server component: every filter change, page change and mutation then travels the
  same documented REST contract, which is the part of this exercise being assessed.
  The auth gate and the team list, which are needed for the first frame, are read
  directly on the server.
- **What the middleware is and is not.** `src/proxy.ts` only checks the cookie's
  signature, to keep anonymous visitors off the dashboard. It is not the security
  boundary: every API route and the dashboard page verify the session again on the
  server, so bypassing it yields a `401`, not data.
- **Login timing.** An unknown email is still compared against a decoy bcrypt hash,
  so a failed login costs the same whether or not the account exists.
- **Not included.** Role-based permissions, user registration, optimistic updates
  and audit history — all reasonable next steps, none of them needed to exercise the
  brief.
