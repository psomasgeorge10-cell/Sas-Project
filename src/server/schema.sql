-- Schema for the Mini SaaS Dashboard.
--
-- This file is the single source of truth for the database structure and is
-- applied idempotently on start-up (see src/server/db.ts) as well as by the
-- `npm run db:setup` script. It targets PostgreSQL 14+ and is used verbatim by
-- both the embedded PGlite dev database and a managed Postgres instance.

-- Dashboard users (the people who log in).
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The people a project can be assigned to.
CREATE TABLE IF NOT EXISTS team_members (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  role       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Project status is modelled as an enum so invalid values are rejected by the
-- database itself, not just by application-level validation.
DO $$
BEGIN
  CREATE TYPE project_status AS ENUM ('active', 'on_hold', 'completed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS projects (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  client      TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  status      project_status NOT NULL DEFAULT 'active',
  deadline    DATE NOT NULL,
  budget      NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (budget >= 0),
  -- Keep the project row when a team member is removed; it simply becomes
  -- unassigned rather than disappearing from the dashboard.
  assignee_id INTEGER REFERENCES team_members(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes backing the dashboard's filter, sort and assignee lookups.
CREATE INDEX IF NOT EXISTS projects_status_idx   ON projects (status);
CREATE INDEX IF NOT EXISTS projects_deadline_idx ON projects (deadline);
CREATE INDEX IF NOT EXISTS projects_assignee_idx ON projects (assignee_id);
