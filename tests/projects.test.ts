/**
 * Repository integration tests.
 *
 * These run against a real PostgreSQL engine - an in-memory PGlite instance -
 * so the SQL itself is exercised: the enum cast, the LEFT JOIN, the filters,
 * the ordering and the aggregate query all have to actually work.
 */

// Must come first: it configures the database before db.ts is evaluated.
import "./setup";

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { getDb, migrate } from "../src/server/db";
import {
  createProject,
  deleteProject,
  getProject,
  getStats,
  listProjects,
  listTeamMembers,
  teamMemberExists,
  updateProject,
} from "../src/server/projects";
import { listQuerySchema } from "../src/lib/validation";

/** Builds a full ListQuery from a partial one, the way the route handler does. */
const query = (overrides: Record<string, unknown> = {}) => listQuerySchema.parse(overrides);

const TEAM = [
  { name: "Amara Okafor", email: "amara@example.com", role: "Engineering Lead" },
  { name: "Ben Carter", email: "ben@example.com", role: "Backend Engineer" },
];

let amaraId = 0;
let benId = 0;

before(async () => {
  const db = await getDb();
  await migrate(db);
  await db.exec("TRUNCATE projects, team_members, users RESTART IDENTITY CASCADE;");

  for (const member of TEAM) {
    const { rows } = await db.query<{ id: number }>(
      "INSERT INTO team_members (name, email, role) VALUES ($1, $2, $3) RETURNING id",
      [member.name, member.email, member.role],
    );
    if (member.name.startsWith("Amara")) amaraId = rows[0].id;
    else benId = rows[0].id;
  }

  const fixtures = [
    { name: "Alpha portal", client: "Northwind", status: "active", deadline: "2020-01-01", budget: 1000, assigneeId: amaraId },
    { name: "Beta billing", client: "Contoso", status: "on_hold", deadline: "2030-06-01", budget: 5000, assigneeId: benId },
    { name: "Gamma search", client: "Northwind", status: "completed", deadline: "2019-05-05", budget: 250.5, assigneeId: amaraId },
    { name: "Delta mobile", client: "Globex", status: "active", deadline: "2031-01-01", budget: 9000, assigneeId: null },
  ] as const;

  for (const fixture of fixtures) {
    await createProject({ ...fixture, description: `${fixture.name} description` });
  }
});

after(async () => {
  await (await getDb()).close();
});

describe("listProjects", () => {
  it("returns every project with its joined assignee", async () => {
    const result = await listProjects(query());
    assert.equal(result.total, 4);
    assert.equal(result.data.length, 4);

    const alpha = result.data.find((project) => project.name === "Alpha portal");
    assert.equal(alpha?.assignee?.name, "Amara Okafor");
    assert.equal(alpha?.assignee?.role, "Engineering Lead");
  });

  it("leaves an unassigned project's assignee null instead of dropping the row", async () => {
    const result = await listProjects(query({ search: "Delta" }));
    assert.equal(result.total, 1);
    assert.equal(result.data[0].assignee, null);
  });

  it("formats dates and budgets identically for every driver", async () => {
    const [project] = (await listProjects(query({ search: "Gamma" }))).data;
    assert.equal(project.deadline, "2019-05-05");
    assert.equal(typeof project.budget, "number");
    assert.equal(project.budget, 250.5);
    assert.match(project.createdAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it("filters by status", async () => {
    assert.equal((await listProjects(query({ status: "active" }))).total, 2);
    assert.equal((await listProjects(query({ status: "completed" }))).total, 1);
  });

  it("filters by assignee", async () => {
    const result = await listProjects(query({ assigneeId: benId }));
    assert.deepEqual(
      result.data.map((project) => project.name),
      ["Beta billing"],
    );
  });

  it("searches name, client and description case-insensitively", async () => {
    assert.equal((await listProjects(query({ search: "ALPHA" }))).total, 1);
    assert.equal((await listProjects(query({ search: "northwind" }))).total, 2);
    assert.equal((await listProjects(query({ search: "description" }))).total, 4);
  });

  it("combines a search with a status filter", async () => {
    const result = await listProjects(query({ search: "Northwind", status: "active" }));
    assert.deepEqual(
      result.data.map((project) => project.name),
      ["Alpha portal"],
    );
  });

  it("sorts by the requested field and direction", async () => {
    const byBudget = await listProjects(query({ sort: "budget", order: "desc" }));
    assert.deepEqual(
      byBudget.data.map((project) => project.budget),
      [9000, 5000, 1000, 250.5],
    );

    const byName = await listProjects(query({ sort: "name", order: "asc" }));
    assert.equal(byName.data[0].name, "Alpha portal");
  });

  it("paginates and reports the totals", async () => {
    const page = await listProjects(query({ sort: "name", pageSize: 2, page: 2 }));
    assert.equal(page.total, 4);
    assert.equal(page.totalPages, 2);
    assert.equal(page.data.length, 2);
    assert.equal(page.data[0].name, "Delta mobile");
  });

  it("clamps a page beyond the end instead of returning nothing", async () => {
    const page = await listProjects(query({ page: 99, pageSize: 2 }));
    assert.equal(page.page, 2);
    assert.equal(page.data.length, 2);
  });
});

describe("createProject / updateProject / deleteProject", () => {
  it("round-trips a new project", async () => {
    const created = await createProject({
      name: "Epsilon analytics",
      client: "Initech",
      description: "Dashboards",
      status: "on_hold",
      deadline: "2029-12-31",
      budget: 1234.56,
      assigneeId: benId,
    });

    assert.ok(created.id > 0);
    assert.equal(created.budget, 1234.56);
    assert.equal(created.assignee?.id, benId);

    const fetched = await getProject(created.id);
    assert.deepEqual(fetched, created);

    await deleteProject(created.id);
  });

  it("applies only the fields present in a patch", async () => {
    const created = await createProject({
      name: "Zeta pilot",
      client: "Umbrella",
      description: "Keep me",
      status: "active",
      deadline: "2029-01-01",
      budget: 400,
      assigneeId: amaraId,
    });

    const updated = await updateProject(created.id, { status: "completed" });
    assert.equal(updated?.status, "completed");
    assert.equal(updated?.client, "Umbrella", "client must survive a partial update");
    assert.equal(updated?.description, "Keep me");
    assert.equal(updated?.budget, 400);

    await deleteProject(created.id);
  });

  it("can unassign a project", async () => {
    const created = await createProject({
      name: "Eta handover",
      client: "",
      description: "",
      status: "active",
      deadline: "2029-01-01",
      budget: 0,
      assigneeId: amaraId,
    });

    const updated = await updateProject(created.id, { assigneeId: null });
    assert.equal(updated?.assignee, null);

    await deleteProject(created.id);
  });

  it("touches updated_at on a change", async () => {
    const created = await createProject({
      name: "Theta timestamps",
      client: "",
      description: "",
      status: "active",
      deadline: "2029-01-01",
      budget: 1,
      assigneeId: null,
    });

    // now() is transaction-scoped in Postgres, so a separate statement is
    // guaranteed to produce a value at least as recent as the insert.
    const updated = await updateProject(created.id, { name: "Theta timestamps v2" });
    assert.ok(
      new Date(updated!.updatedAt) >= new Date(created.createdAt),
      "updated_at should not go backwards",
    );

    await deleteProject(created.id);
  });

  it("reports a miss rather than throwing", async () => {
    assert.equal(await getProject(999_999), null);
    assert.equal(await updateProject(999_999, { status: "active" }), null);
    assert.equal(await deleteProject(999_999), false);
  });
});

describe("getStats", () => {
  it("counts by status and sums the budgets", async () => {
    const stats = await getStats();
    assert.equal(stats.total, 4);
    assert.deepEqual(stats.byStatus, { active: 2, on_hold: 1, completed: 1 });
    assert.equal(stats.totalBudget, 1000 + 5000 + 250.5 + 9000);
  });

  it("counts only unfinished work as overdue", async () => {
    // Alpha portal is active with a 2020 deadline; Gamma search is also in the
    // past but completed, so it must not be counted.
    const stats = await getStats();
    assert.equal(stats.overdue, 1);
  });
});

describe("team members", () => {
  it("lists them alphabetically", async () => {
    assert.deepEqual(
      (await listTeamMembers()).map((member) => member.name),
      ["Amara Okafor", "Ben Carter"],
    );
  });

  it("checks existence for the foreign-key guard", async () => {
    assert.equal(await teamMemberExists(amaraId), true);
    assert.equal(await teamMemberExists(999_999), false);
  });
});
