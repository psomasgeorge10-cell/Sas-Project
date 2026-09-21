/**
 * Typed browser client for the REST API.
 *
 * Every component talks to the backend through this module, so error handling
 * and the query-string shape are defined in exactly one place.
 */

import type { Paginated, Project, ProjectStats, SessionUser, TeamMember } from "./types";
import { parseListQuery } from "./validation";
import type { ListQuery, ProjectInput, ProjectPatch } from "./validation";

/** An HTTP error carrying the API's `{ error, details }` payload. */
export class ApiError extends Error {
  readonly status: number;
  readonly details: Record<string, string>;

  constructor(status: number, message: string, details: Record<string, string> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
    });
  } catch (error) {
    // An aborted request is a caller decision, not a failure - let it through
    // so effects can distinguish it from a real network problem.
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (payload as { error?: string } | null)?.error ?? `Request failed (${response.status})`;
    const details = (payload as { details?: Record<string, string> } | null)?.details ?? {};
    throw new ApiError(response.status, message, details);
  }

  return payload as T;
}

export type ProjectFilters = Pick<
  ListQuery,
  "search" | "sort" | "order" | "page" | "pageSize"
> & {
  status: ListQuery["status"] | null;
  assigneeId: number | null;
};

/** Serialises filters, dropping the ones that are at their default. */
export function buildQuery(filters: ProjectFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.assigneeId) params.set("assigneeId", String(filters.assigneeId));
  if (filters.sort !== "deadline") params.set("sort", filters.sort);
  if (filters.order !== "asc") params.set("order", filters.order);
  if (filters.page > 1) params.set("page", String(filters.page));
  if (filters.pageSize !== 10) params.set("pageSize", String(filters.pageSize));
  return params;
}

export const api = {
  listProjects(filters: ProjectFilters, signal?: AbortSignal) {
    return request<Paginated<Project>>(`/api/projects?${buildQuery(filters)}`, { signal });
  },
  stats(signal?: AbortSignal) {
    return request<ProjectStats>("/api/stats", { signal });
  },
  teamMembers(signal?: AbortSignal) {
    return request<TeamMember[]>("/api/team-members", { signal });
  },
  createProject(input: ProjectInput) {
    return request<Project>("/api/projects", { method: "POST", body: JSON.stringify(input) });
  },
  updateProject(id: number, patch: ProjectPatch) {
    return request<Project>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  },
  deleteProject(id: number) {
    return request<void>(`/api/projects/${id}`, { method: "DELETE" });
  },
  login(email: string, password: string) {
    return request<SessionUser>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },
  logout() {
    return request<void>("/api/auth/logout", { method: "POST" });
  },
};

/** The filter state a freshly opened dashboard starts from. */
export const DEFAULT_FILTERS: ProjectFilters = {
  search: "",
  status: null,
  assigneeId: null,
  sort: "deadline",
  order: "asc",
  page: 1,
  pageSize: 10,
};

/**
 * Rebuilds filter state from a URL, so a filtered view can be bookmarked or
 * shared. Anything invalid falls back to the default rather than erroring.
 */
export function filtersFromSearchParams(params: URLSearchParams): ProjectFilters {
  const parsed = parseListQuery(params);
  if (!parsed.success) return { ...DEFAULT_FILTERS };
  const { status, assigneeId, ...rest } = parsed.data;
  return { ...rest, status: status ?? null, assigneeId: assigneeId ?? null };
}

/** True when anything other than sorting and paging is narrowing the list. */
export function hasActiveFilters(filters: ProjectFilters): boolean {
  return Boolean(filters.search || filters.status || filters.assigneeId);
}
