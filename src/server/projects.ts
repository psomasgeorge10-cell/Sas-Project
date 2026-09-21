/**
 * Project repository.
 *
 * All SQL for the projects resource lives here: route handlers deal in domain
 * objects and never build queries themselves. Every user-supplied value is
 * passed as a bound parameter; the only interpolated strings are sort keys
 * chosen from a fixed whitelist.
 */

import { getDb } from "./db";
import type {
  Paginated,
  Project,
  ProjectStats,
  ProjectStatus,
  SortField,
  TeamMember,
} from "@/lib/types";
import { PROJECT_STATUSES } from "@/lib/types";
import type { ListQuery, ProjectInput, ProjectPatch } from "@/lib/validation";

/** Raw row shape returned by the SELECT below. */
interface ProjectRow {
  id: number;
  name: string;
  client: string;
  description: string;
  status: ProjectStatus;
  deadline: string;
  budget: number;
  created_at: string;
  updated_at: string;
  assignee_id: number | null;
  assignee_name: string | null;
  assignee_email: string | null;
  assignee_role: string | null;
}

// Dates and numerics are formatted in SQL rather than in JavaScript so that the
// node-postgres and PGlite drivers - which disagree about how to hydrate DATE,
// TIMESTAMPTZ and NUMERIC - return byte-identical payloads.
const PROJECT_COLUMNS = `
  p.id,
  p.name,
  p.client,
  p.description,
  p.status,
  to_char(p.deadline, 'YYYY-MM-DD')                                      AS deadline,
  p.budget::float8                                                       AS budget,
  to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
  to_char(p.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at,
  m.id                                                                   AS assignee_id,
  m.name                                                                 AS assignee_name,
  m.email                                                                AS assignee_email,
  m.role                                                                 AS assignee_role
`;

const FROM_PROJECTS = `
  FROM projects p
  LEFT JOIN team_members m ON m.id = p.assignee_id
`;

/** Whitelist: the only expressions a client is allowed to sort by. */
const SORT_EXPRESSIONS: Record<SortField, string> = {
  name: "p.name",
  // Enum columns sort by declaration order, which is the natural project
  // lifecycle: active -> on hold -> completed.
  status: "p.status",
  deadline: "p.deadline",
  budget: "p.budget",
  created_at: "p.created_at",
};

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    client: row.client,
    description: row.description,
    status: row.status,
    deadline: row.deadline,
    budget: Number(row.budget),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    assignee:
      row.assignee_id === null
        ? null
        : {
            id: row.assignee_id,
            name: row.assignee_name ?? "",
            email: row.assignee_email ?? "",
            role: row.assignee_role ?? "",
          },
  };
}

/** Builds the WHERE clause shared by the list and count queries. */
function buildFilters(query: Pick<ListQuery, "search" | "status" | "assigneeId">) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (query.search) {
    params.push(`%${query.search}%`);
    const placeholder = `$${params.length}`;
    conditions.push(
      `(p.name ILIKE ${placeholder} OR p.client ILIKE ${placeholder} OR p.description ILIKE ${placeholder})`,
    );
  }

  if (query.status) {
    params.push(query.status);
    conditions.push(`p.status = $${params.length}::project_status`);
  }

  if (query.assigneeId) {
    params.push(query.assigneeId);
    conditions.push(`p.assignee_id = $${params.length}`);
  }

  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

export async function listProjects(query: ListQuery): Promise<Paginated<Project>> {
  const db = await getDb();
  const { where, params } = buildFilters(query);

  const countResult = await db.query<{ count: number }>(
    `SELECT count(*)::int AS count ${FROM_PROJECTS} ${where}`,
    params,
  );
  const total = Number(countResult.rows[0]?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  // Clamp the page so that deleting the last row on the last page cannot strand
  // the user on an empty view.
  const page = Math.min(query.page, totalPages);
  const direction = query.order === "desc" ? "DESC" : "ASC";

  const rows = await db.query<ProjectRow>(
    `SELECT ${PROJECT_COLUMNS} ${FROM_PROJECTS} ${where}
     ORDER BY ${SORT_EXPRESSIONS[query.sort]} ${direction} NULLS LAST, p.id ASC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, query.pageSize, (page - 1) * query.pageSize],
  );

  return {
    data: rows.rows.map(toProject),
    page,
    pageSize: query.pageSize,
    total,
    totalPages,
  };
}

export async function getProject(id: number): Promise<Project | null> {
  const db = await getDb();
  const { rows } = await db.query<ProjectRow>(
    `SELECT ${PROJECT_COLUMNS} ${FROM_PROJECTS} WHERE p.id = $1`,
    [id],
  );
  return rows[0] ? toProject(rows[0]) : null;
}

export async function createProject(input: ProjectInput): Promise<Project> {
  const db = await getDb();
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO projects (name, client, description, status, deadline, budget, assignee_id)
     VALUES ($1, $2, $3, $4::project_status, $5::date, $6, $7)
     RETURNING id`,
    [
      input.name,
      input.client,
      input.description,
      input.status,
      input.deadline,
      input.budget,
      input.assigneeId,
    ],
  );

  // Re-read through the canonical SELECT so the response always carries the
  // joined assignee and the same formatting as every other endpoint.
  const created = await getProject(rows[0].id);
  if (!created) throw new Error("Project disappeared immediately after insert");
  return created;
}

/** The columns a PATCH may touch, with the cast each one needs. */
const PATCH_COLUMNS: Record<keyof ProjectInput, { column: string; cast: string }> = {
  name: { column: "name", cast: "" },
  client: { column: "client", cast: "" },
  description: { column: "description", cast: "" },
  status: { column: "status", cast: "::project_status" },
  deadline: { column: "deadline", cast: "::date" },
  budget: { column: "budget", cast: "" },
  assigneeId: { column: "assignee_id", cast: "" },
};

export async function updateProject(id: number, patch: ProjectPatch): Promise<Project | null> {
  const db = await getDb();
  const assignments: string[] = [];
  const params: unknown[] = [];

  for (const key of Object.keys(PATCH_COLUMNS) as (keyof ProjectInput)[]) {
    if (!(key in patch)) continue;
    const { column, cast } = PATCH_COLUMNS[key];
    params.push(patch[key]);
    assignments.push(`${column} = $${params.length}${cast}`);
  }

  if (assignments.length === 0) return getProject(id);

  params.push(id);
  const { rowCount } = await db.query(
    `UPDATE projects
     SET ${assignments.join(", ")}, updated_at = now()
     WHERE id = $${params.length}`,
    params,
  );

  return rowCount === 0 ? null : getProject(id);
}

export async function deleteProject(id: number): Promise<boolean> {
  const db = await getDb();
  const { rowCount } = await db.query(`DELETE FROM projects WHERE id = $1`, [id]);
  return rowCount > 0;
}

export async function getStats(): Promise<ProjectStats> {
  const db = await getDb();
  const { rows } = await db.query<Record<string, number>>(
    `SELECT
       count(*)::int                                                                  AS total,
       coalesce(sum(budget), 0)::float8                                               AS total_budget,
       count(*) FILTER (WHERE status <> 'completed' AND deadline < current_date)::int AS overdue,
       count(*) FILTER (WHERE status = 'active')::int                                 AS active,
       count(*) FILTER (WHERE status = 'on_hold')::int                                AS on_hold,
       count(*) FILTER (WHERE status = 'completed')::int                              AS completed
     FROM projects`,
  );

  const row = rows[0] ?? {};
  const byStatus = Object.fromEntries(
    PROJECT_STATUSES.map((status) => [status, Number(row[status] ?? 0)]),
  ) as Record<ProjectStatus, number>;

  return {
    total: Number(row.total ?? 0),
    totalBudget: Number(row.total_budget ?? 0),
    overdue: Number(row.overdue ?? 0),
    byStatus,
  };
}

export async function listTeamMembers(): Promise<TeamMember[]> {
  const db = await getDb();
  const { rows } = await db.query<TeamMember>(
    `SELECT id, name, email, role FROM team_members ORDER BY name ASC`,
  );
  return rows;
}

export async function teamMemberExists(id: number): Promise<boolean> {
  const db = await getDb();
  const { rows } = await db.query<{ exists: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM team_members WHERE id = $1) AS exists`,
    [id],
  );
  return Boolean(rows[0]?.exists);
}
