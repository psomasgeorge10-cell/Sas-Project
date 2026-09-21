/** /api/team-members - the people a project can be assigned to. */

import { NextResponse } from "next/server";
import { listTeamMembers } from "@/server/projects";
import { requireSession, route } from "@/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireSession();
  return NextResponse.json(await listTeamMembers());
});
