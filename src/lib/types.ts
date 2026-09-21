/** Shared domain types. These shapes are what the REST API returns and what the UI renders. */

export const PROJECT_STATUSES = ["active", "on_hold", "completed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
};

export interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface Project {
  id: number;
  name: string;
  client: string;
  description: string;
  status: ProjectStatus;
  /** ISO calendar date, `YYYY-MM-DD`. */
  deadline: string;
  budget: number;
  assignee: TeamMember | null;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ProjectStats {
  total: number;
  byStatus: Record<ProjectStatus, number>;
  totalBudget: number;
  /** Projects past their deadline that are not completed yet. */
  overdue: number;
}

export interface SessionUser {
  id: number;
  name: string;
  email: string;
}

export const SORT_FIELDS = ["name", "status", "deadline", "budget", "created_at"] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export type SortOrder = "asc" | "desc";
