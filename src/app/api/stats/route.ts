/** /api/stats - headline counters for the dashboard cards. */

import { NextResponse } from "next/server";
import { getStats } from "@/server/projects";
import { requireSession, route } from "@/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireSession();
  return NextResponse.json(await getStats());
});
