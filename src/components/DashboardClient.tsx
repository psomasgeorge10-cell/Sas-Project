"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  api,
  buildQuery,
  hasActiveFilters,
  type ProjectFilters,
} from "@/lib/api-client";
import type { Paginated, Project, ProjectStats, SessionUser, TeamMember } from "@/lib/types";
import type { ProjectInput } from "@/lib/validation";
import { AppHeader } from "./AppHeader";
import { ConfirmDialog } from "./ConfirmDialog";
import { Pagination } from "./Pagination";
import { ProjectFormModal } from "./ProjectFormModal";
import { ProjectsTable, ProjectsTableSkeleton } from "./ProjectsTable";
import { StatCards } from "./StatCards";
import { Toaster, useToasts } from "./Toaster";
import { Toolbar } from "./Toolbar";
import { AlertIcon, InboxIcon, SearchIcon } from "./icons";
import { Button, Card, EmptyState } from "./ui";

const SEARCH_DEBOUNCE_MS = 300;

interface DashboardClientProps {
  user: SessionUser;
  team: TeamMember[];
  initialFilters: ProjectFilters;
}

/**
 * The dashboard shell: owns filter state, talks to the REST API, and hands
 * data down to the presentational components.
 *
 * Data is fetched from `/api/*` rather than read on the server so that filter
 * changes, pagination and mutations all travel the same documented HTTP
 * contract - the one an external client would use.
 */
export function DashboardClient({ user, team, initialFilters }: DashboardClientProps) {
  const router = useRouter();
  const { toasts, notify, dismiss } = useToasts();

  const [filters, setFilters] = useState<ProjectFilters>(initialFilters);
  // The input is updated on every keystroke; `filters.search` follows it after
  // a pause, so typing never fires a request per character.
  const [searchDraft, setSearchDraft] = useState(initialFilters.search);

  const [result, setResult] = useState<Paginated<Project> | null>(null);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped after a mutation to re-run the fetch effect with unchanged filters.
  const [reloadToken, setReloadToken] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  // Changed every time the dialog opens; used as the form's `key` so React
  // remounts it with fresh state instead of resetting it from an effect.
  const [formInstance, setFormInstance] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const updateFilters = useCallback((patch: Partial<ProjectFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  }, []);

  /* --- search debounce --------------------------------------------------- */
  useEffect(() => {
    if (searchDraft === filters.search) return;
    const timer = setTimeout(
      () => setFilters((current) => ({ ...current, search: searchDraft, page: 1 })),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [searchDraft, filters.search]);

  /* --- data loading ------------------------------------------------------ */
  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setRefreshing(true);
      setError(null);
      try {
        const [list, nextStats] = await Promise.all([
          api.listProjects(filters, controller.signal),
          api.stats(controller.signal),
        ]);

        setResult(list);
        setStats(nextStats);

        // The API clamps out-of-range pages; mirror that back into the UI.
        if (list.page !== filters.page) {
          setFilters((current) => ({ ...current, page: list.page }));
        }
      } catch (caught) {
        if (controller.signal.aborted) return;
        if (caught instanceof ApiError && caught.status === 401) {
          router.replace("/login");
          return;
        }
        setError(caught instanceof Error ? caught.message : "Could not load projects.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    load();
    return () => controller.abort();
  }, [filters, reloadToken, router]);

  /* --- keep the URL in step with the filters ----------------------------- */
  useEffect(() => {
    const query = buildQuery(filters).toString();
    // replaceState rather than router.replace: the filters are already applied
    // in state, so this only makes the view linkable without a re-render.
    window.history.replaceState(null, "", query ? `/?${query}` : "/");
  }, [filters]);

  /* --- mutations --------------------------------------------------------- */
  function openCreate() {
    setEditing(null);
    setFormInstance((instance) => instance + 1);
    setFormOpen(true);
  }

  function openEdit(project: Project) {
    setEditing(project);
    setFormInstance((instance) => instance + 1);
    setFormOpen(true);
  }

  // Errors are intentionally re-thrown: the modal renders them against the
  // offending field instead of showing a toast the user has to translate.
  async function handleSubmit(values: ProjectInput) {
    if (editing) {
      await api.updateProject(editing.id, values);
      notify("success", `"${values.name}" updated`);
    } else {
      await api.createProject(values);
      notify("success", `"${values.name}" created`);
    }
    setFormOpen(false);
    setEditing(null);
    reload();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await api.deleteProject(deleteTarget.id);
      notify("success", `"${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
      reload();
    } catch (caught) {
      notify("error", caught instanceof Error ? caught.message : "Could not delete the project.");
    }
  }

  function clearFilters() {
    setSearchDraft("");
    setFilters((current) => ({
      ...current,
      search: "",
      status: null,
      assigneeId: null,
      page: 1,
    }));
  }

  /* --- render ------------------------------------------------------------ */
  const projects = result?.data ?? [];
  const filtersActive = hasActiveFilters(filters);

  return (
    <div className="min-h-screen">
      <AppHeader user={user} />

      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
        <StatCards stats={stats} />

        <Toolbar
          filters={filters}
          searchDraft={searchDraft}
          team={team}
          total={result?.total ?? 0}
          onSearchChange={setSearchDraft}
          onChange={updateFilters}
          onCreate={openCreate}
        />

        <Card className="overflow-hidden">
          {loading ? (
            <ProjectsTableSkeleton />
          ) : error ? (
            <EmptyState
              icon={<AlertIcon className="size-6" />}
              title="Could not load projects"
              description={error}
              action={
                <Button variant="primary" onClick={reload}>
                  Try again
                </Button>
              }
            />
          ) : projects.length === 0 ? (
            filtersActive ? (
              <EmptyState
                icon={<SearchIcon className="size-6" />}
                title="No projects match your filters"
                description="Try a different search term, or widen the status and team filters."
                action={<Button onClick={clearFilters}>Clear filters</Button>}
              />
            ) : (
              <EmptyState
                icon={<InboxIcon className="size-6" />}
                title="No projects yet"
                description="Create your first project, or run npm run db:setup to load the sample data."
                action={
                  <Button variant="primary" onClick={openCreate}>
                    New project
                  </Button>
                }
              />
            )
          ) : (
            <>
              <ProjectsTable
                projects={projects}
                busy={refreshing}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
              />
              {result && result.totalPages > 1 && (
                <Pagination
                  page={result.page}
                  pageSize={result.pageSize}
                  total={result.total}
                  totalPages={result.totalPages}
                  onChange={updateFilters}
                />
              )}
            </>
          )}
        </Card>
      </main>

      <ProjectFormModal
        key={formInstance}
        open={formOpen}
        project={editing}
        team={team}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete project"
        message={
          <>
            <strong className="font-medium text-slate-900 dark:text-slate-100">
              {deleteTarget?.name}
            </strong>{" "}
            will be permanently removed. This cannot be undone.
          </>
        }
        confirmLabel="Delete project"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
