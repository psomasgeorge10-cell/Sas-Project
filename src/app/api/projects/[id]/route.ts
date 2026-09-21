/**
 * /api/projects/[id]
 *
 *   GET    - a single project
 *   PATCH  - partial update
 *   DELETE - remove the project
 */

import { NextResponse, type NextRequest } from "next/server";
import {
  deleteProject,
  getProject,
  teamMemberExists,
  updateProject,
} from "@/server/projects";
import { jsonError, parseId, requireSession, route, validationError } from "@/server/api";
import { projectPatchSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export const GET = route(async (_request: NextRequest, context: Context) => {
  await requireSession();

  const id = parseId((await context.params).id);
  if (id === null) return jsonError(400, "Invalid project id");

  const project = await getProject(id);
  return project ? NextResponse.json(project) : jsonError(404, "Project not found");
});

export const PATCH = route(async (request: NextRequest, context: Context) => {
  await requireSession();

  const id = parseId((await context.params).id);
  if (id === null) return jsonError(400, "Invalid project id");

  const body = await request.json().catch(() => null);
  const parsed = projectPatchSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const assigneeId = parsed.data.assigneeId;
  if (assigneeId != null && !(await teamMemberExists(assigneeId))) {
    return jsonError(422, "Validation failed", { assigneeId: "Unknown team member" });
  }

  const updated = await updateProject(id, parsed.data);
  return updated ? NextResponse.json(updated) : jsonError(404, "Project not found");
});

export const DELETE = route(async (_request: NextRequest, context: Context) => {
  await requireSession();

  const id = parseId((await context.params).id);
  if (id === null) return jsonError(400, "Invalid project id");

  const deleted = await deleteProject(id);
  return deleted
    ? new NextResponse(null, { status: 204 })
    : jsonError(404, "Project not found");
});
