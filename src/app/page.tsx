import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/DashboardClient";
import { getSessionUser } from "@/server/auth";
import { listTeamMembers } from "@/server/projects";
import { filtersFromSearchParams } from "@/lib/api-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Dashboard entry point.
 *
 * The middleware already redirects anonymous visitors, but the session is
 * verified again here so the page is safe on its own. Team members are read
 * directly from the database - they are needed to render the very first frame
 * of the filter bar and the form, and they change rarely.
 */
export default async function DashboardPage({ searchParams }: PageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }

  const team = await listTeamMembers();

  return (
    <DashboardClient
      user={user}
      team={team}
      initialFilters={filtersFromSearchParams(params)}
    />
  );
}
