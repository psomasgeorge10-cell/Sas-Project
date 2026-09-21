"use client";

import type { Project } from "@/lib/types";
import {
  avatarTint,
  daysUntil,
  describeDeadline,
  formatCurrency,
  formatDate,
  initials,
} from "@/lib/format";
import { PencilIcon, TrashIcon } from "./icons";
import { StatusBadge } from "./StatusBadge";
import { cx } from "./ui";

interface ProjectsTableProps {
  projects: Project[];
  busy: boolean;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
}

/** Overdue deadlines are red, anything inside a fortnight is amber. */
function deadlineClass(project: Project): string {
  if (project.status === "completed") return "text-slate-500 dark:text-slate-400";
  const days = daysUntil(project.deadline);
  if (days < 0) return "text-rose-600 dark:text-rose-400";
  if (days <= 14) return "text-amber-600 dark:text-amber-400";
  return "text-slate-600 dark:text-slate-300";
}

function Assignee({ project }: { project: Project }) {
  if (!project.assignee) {
    return <span className="text-sm text-slate-400 italic dark:text-slate-500">Unassigned</span>;
  }

  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cx(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          avatarTint(project.assignee.email),
        )}
        aria-hidden="true"
      >
        {initials(project.assignee.name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">
          {project.assignee.name}
        </span>
        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
          {project.assignee.role}
        </span>
      </span>
    </div>
  );
}

function RowActions({
  project,
  onEdit,
  onDelete,
}: Pick<ProjectsTableProps, "onEdit" | "onDelete"> & { project: Project }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={() => onEdit(project)}
        aria-label={`Edit ${project.name}`}
        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
      >
        <PencilIcon className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => onDelete(project)}
        aria-label={`Delete ${project.name}`}
        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
      >
        <TrashIcon className="size-4" />
      </button>
    </div>
  );
}

export function ProjectsTable({ projects, busy, onEdit, onDelete }: ProjectsTableProps) {
  return (
    <div className={cx("transition-opacity", busy && "pointer-events-none opacity-60")}>
      {/* Desktop: a real table, so the data stays sortable, scannable and screen-reader friendly. */}
      <table className="hidden w-full border-collapse md:table">
        <caption className="sr-only">
          Projects with their status, deadline, assigned team member and budget
        </caption>
        <thead>
          <tr className="border-b border-slate-200 text-left dark:border-slate-800">
            {["Project", "Status", "Deadline", "Assigned to", "Budget", ""].map((heading, index) => (
              <th
                key={heading || "actions"}
                scope="col"
                className={cx(
                  "px-4 py-3 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400",
                  index === 4 && "text-right",
                )}
              >
                {heading || <span className="sr-only">Actions</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {projects.map((project) => (
            <tr
              key={project.id}
              className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <td className="max-w-xs px-4 py-3">
                <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                  {project.name}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {project.client || project.description || "—"}
                </p>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={project.status} />
              </td>
              <td className="px-4 py-3">
                <p className={cx("text-sm font-medium tabular-nums", deadlineClass(project))}>
                  {formatDate(project.deadline)}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {project.status === "completed" ? "Completed" : describeDeadline(project.deadline)}
                </p>
              </td>
              <td className="px-4 py-3">
                <Assignee project={project} />
              </td>
              <td className="px-4 py-3 text-right text-sm font-medium text-slate-900 tabular-nums dark:text-slate-100">
                {formatCurrency(project.budget)}
              </td>
              <td className="px-4 py-3">
                <RowActions project={project} onEdit={onEdit} onDelete={onDelete} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile: the same rows as cards, because a five-column table cannot fit. */}
      <ul className="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
        {projects.map((project) => (
          <li key={project.id} className="px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                  {project.name}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {project.client || "—"}
                </p>
              </div>
              <StatusBadge status={project.status} />
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-slate-400 dark:text-slate-500">Deadline</dt>
                <dd className={cx("font-medium tabular-nums", deadlineClass(project))}>
                  {formatDate(project.deadline)}
                </dd>
              </div>
              <div className="text-right">
                <dt className="text-xs text-slate-400 dark:text-slate-500">Budget</dt>
                <dd className="font-medium text-slate-900 tabular-nums dark:text-slate-100">
                  {formatCurrency(project.budget)}
                </dd>
              </div>
            </dl>

            <div className="mt-3 flex items-center justify-between gap-3">
              <Assignee project={project} />
              <RowActions project={project} onEdit={onEdit} onDelete={onDelete} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Placeholder rows shown while the first page is loading. */
export function ProjectsTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-4 px-4 py-4">
          <div className="h-4 flex-1 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="hidden h-6 w-20 animate-pulse rounded-full bg-slate-200 sm:block dark:bg-slate-800" />
          <div className="hidden h-4 w-24 animate-pulse rounded bg-slate-200 md:block dark:bg-slate-800" />
          <div className="size-8 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
        </div>
      ))}
    </div>
  );
}
