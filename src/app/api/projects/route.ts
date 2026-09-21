/**
 * /api/projects
 *
 *   GET  - paginated, searchable, filterable list of projects
 *   POST - create a project
 */

import { NextResponse, type NextRequest } from "next/server";
import { createProject, listProjects, teamMemberExists } from "@/server/projects";
import { jsonError, requireSession, route, validationError } from "@/server/api";
import { parseListQuery, projectInputSchema } from "@/lib/validation";

// PGlite and node-postgres are Node libraries, and the list depends on the
// request, so this route is never statically rendered or cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (request: NextRequest) => {
  await requireSession();

  const query = parseListQuery(request.nextUrl.searchParams);
  if (!query.success) return validationError(query.error);

  return NextResponse.json(await listProjects(query.data));
});

export const POST = route(async (request: NextRequest) => {
  await requireSession();

  const body = await request.json().catch(() => null);
  const parsed = projectInputSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  // The foreign key would reject this anyway, but checking here turns a 500
  // into a field-level message the form can display.
  if (parsed.data.assigneeId !== null && !(await teamMemberExists(parsed.data.assigneeId))) {
    return jsonError(422, "Validation failed", { assigneeId: "Unknown team member" });
  }

  return NextResponse.json(await createProject(parsed.data), { status: 201 });
});
