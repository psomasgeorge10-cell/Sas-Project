/**
 * Database setup and seeding.
 *
 *   npm run db:setup          apply the schema, then seed if the tables are empty
 *   npm run db:seed -- --force  wipe projects/team/users and reseed from scratch
 *
 * Runs against whatever `getDb()` resolves to, so the same command works for
 * the embedded PGlite database and for a managed Postgres instance.
 */

import { config as loadEnv } from "dotenv";
import { getDb, migrate, type Database } from "../src/server/db";
import { hashPassword } from "../src/server/password";
import type { ProjectStatus } from "../src/lib/types";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

const DEMO_USER = {
  name: "Demo Admin",
  email: "admin@example.com",
  password: process.env.SEED_ADMIN_PASSWORD ?? "password123",
};

const TEAM = [
  { name: "Amara Okafor", email: "amara.okafor@example.com", role: "Engineering Lead" },
  { name: "Ben Carter", email: "ben.carter@example.com", role: "Backend Engineer" },
  { name: "Chiara Rossi", email: "chiara.rossi@example.com", role: "Product Designer" },
  { name: "Dmitri Volkov", email: "dmitri.volkov@example.com", role: "DevOps Engineer" },
  { name: "Elena Marques", email: "elena.marques@example.com", role: "Project Manager" },
  { name: "Farid Haddad", email: "farid.haddad@example.com", role: "Frontend Engineer" },
  { name: "Grace Lin", email: "grace.lin@example.com", role: "Data Analyst" },
  { name: "Hugo Almeida", email: "hugo.almeida@example.com", role: "QA Engineer" },
];

const CLIENTS = [
  "Northwind Trading",
  "Contoso Health",
  "Globex Logistics",
  "Initech Financial",
  "Umbrella Retail",
  "Soylent Foods",
  "Hooli Media",
  "Vandelay Industries",
];

const WORK = [
  ["Customer portal redesign", "Rebuild the self-service portal on a shared design system."],
  ["Billing service migration", "Move invoicing off the legacy monolith into its own service."],
  ["Mobile app v2", "Second-generation mobile client with offline support."],
  ["Warehouse analytics", "Near-real-time dashboards for stock movement and pick rates."],
  ["Single sign-on rollout", "SAML and OIDC sign-in across all internal tools."],
  ["Checkout performance", "Cut checkout time-to-interactive below one second."],
  ["Data warehouse cleanup", "Consolidate three reporting databases into one model."],
  ["Onboarding automation", "Replace the manual account-setup checklist with a workflow."],
  ["Compliance audit tooling", "Evidence collection and reporting for the annual audit."],
  ["Search relevance upgrade", "Ranking and synonym improvements for the product catalogue."],
  ["Partner API gateway", "Public API with rate limiting, keys and usage reporting."],
  ["Support chat integration", "Embed live chat with conversation history in the app."],
  ["Inventory forecasting", "Demand model feeding weekly purchase recommendations."],
  ["Design system 2.0", "Component library with accessibility and theming baked in."],
  ["Payment provider failover", "Second payment processor with automatic failover."],
  ["Content localisation", "Ship the marketing site in six additional languages."],
  ["Kubernetes migration", "Move remaining services off virtual machines."],
  ["Fraud detection rules", "Rules engine plus a review queue for flagged orders."],
  ["Marketing site refresh", "New brand, new copy, measurable conversion targets."],
  ["Subscription tiers", "Introduce usage-based pricing alongside flat plans."],
  ["Email deliverability", "Fix domain reputation and rebuild transactional templates."],
  ["Reporting API", "Let enterprise customers pull their own usage data."],
  ["Accessibility remediation", "Bring the core flows up to WCAG 2.2 AA."],
  ["Disaster recovery drill", "Document and rehearse a full regional failover."],
];

const STATUS_WEIGHTS: ProjectStatus[] = [
  // Roughly 50% active, 20% on hold, 30% completed.
  "active", "active", "active", "active", "active",
  "on_hold", "on_hold",
  "completed", "completed", "completed",
];

/**
 * A tiny seeded PRNG (mulberry32). Seeding makes `npm run db:seed` reproducible,
 * so screenshots and manual test cases stay stable between runs.
 */
function createRandom(seed: number) {
  let state = seed;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(20250921);

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

/** A date `offsetDays` from today, as `YYYY-MM-DD`. */
function isoDate(offsetDays: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function buildProjects(teamIds: number[]) {
  return WORK.map(([name, description], index) => {
    const status = STATUS_WEIGHTS[index % STATUS_WEIGHTS.length];
    // Completed work sits in the past; a few active projects are deliberately
    // overdue so the "Overdue" counter and the red deadline styling have
    // something to show.
    const deadline =
      status === "completed"
        ? isoDate(-randomInt(10, 180))
        : index % 7 === 0
          ? isoDate(-randomInt(1, 20))
          : isoDate(randomInt(5, 210));

    return {
      name,
      description,
      client: pick(CLIENTS),
      status,
      deadline,
      budget: randomInt(6, 240) * 500, // 3,000 - 120,000
      // Leave one project unassigned to exercise the nullable foreign key.
      assigneeId: index === 4 ? null : pick(teamIds),
    };
  });
}

async function isEmpty(db: Database): Promise<boolean> {
  const { rows } = await db.query<{ count: number }>(`SELECT count(*)::int AS count FROM projects`);
  return Number(rows[0]?.count ?? 0) === 0;
}

async function seed(db: Database): Promise<void> {
  // TRUNCATE ... RESTART IDENTITY keeps ids predictable across reseeds.
  await db.exec(`TRUNCATE projects, team_members, users RESTART IDENTITY CASCADE;`);

  await db.query(`INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)`, [
    DEMO_USER.name,
    DEMO_USER.email,
    await hashPassword(DEMO_USER.password),
  ]);

  const teamIds: number[] = [];
  for (const member of TEAM) {
    const { rows } = await db.query<{ id: number }>(
      `INSERT INTO team_members (name, email, role) VALUES ($1, $2, $3) RETURNING id`,
      [member.name, member.email, member.role],
    );
    teamIds.push(rows[0].id);
  }

  const projects = buildProjects(teamIds);
  for (const project of projects) {
    await db.query(
      `INSERT INTO projects (name, client, description, status, deadline, budget, assignee_id)
       VALUES ($1, $2, $3, $4::project_status, $5::date, $6, $7)`,
      [
        project.name,
        project.client,
        project.description,
        project.status,
        project.deadline,
        project.budget,
        project.assigneeId,
      ],
    );
  }

  console.log(
    `Seeded ${projects.length} projects, ${TEAM.length} team members and 1 user ` +
      `(${DEMO_USER.email} / ${DEMO_USER.password}).`,
  );
}

async function main() {
  const force = process.argv.includes("--force");
  const db = await getDb();

  console.log(`Using the ${db.driver} driver.`);
  await migrate(db);
  console.log("Schema is up to date.");

  if (!force && !(await isEmpty(db))) {
    console.log("Projects table already has rows - nothing to do. Re-run with --force to reseed.");
  } else {
    await seed(db);
  }

  await db.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
