"use client";

import { PROJECT_STATUSES, STATUS_LABELS, type TeamMember } from "@/lib/types";
import type { ProjectFilters } from "@/lib/api-client";
import { PlusIcon, SearchIcon } from "./icons";
import { Button, controlClass, cx } from "./ui";

interface ToolbarProps {
  filters: ProjectFilters;
  /** Uncontrolled mirror of the search box, so typing stays instant while requests are debounced. */
  searchDraft: string;
  team: TeamMember[];
  total: number;
  onSearchChange: (value: string) => void;
  onChange: (patch: Partial<ProjectFilters>) => void;
  onCreate: () => void;
}

const STATUS_TABS = [
  { value: null, label: "All" },
  ...PROJECT_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
];

const SORT_OPTIONS = [
  { value: "deadline:asc", label: "Deadline (soonest)" },
  { value: "deadline:desc", label: "Deadline (latest)" },
  { value: "name:asc", label: "Name (A-Z)" },
  { value: "name:desc", label: "Name (Z-A)" },
  { value: "budget:desc", label: "Budget (highest)" },
  { value: "budget:asc", label: "Budget (lowest)" },
  { value: "created_at:desc", label: "Recently added" },
] as const;

export function Toolbar({
  filters,
  searchDraft,
  team,
  total,
  onSearchChange,
  onChange,
  onCreate,
}: ToolbarProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Projects
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {total === 1 ? "1 project" : `${total} projects`} matching your filters
          </p>
        </div>
        <Button variant="primary" onClick={onCreate} className="sm:w-auto">
          <PlusIcon className="size-4" />
          New project
        </Button>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {/* Search */}
        <div className="relative lg:max-w-xs lg:flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchDraft}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search name, client or description"
            aria-label="Search projects"
            className={controlClass(false, "pl-9")}
          />
        </div>

        {/* Status filter: segmented control on wider screens, a select on phones. */}
        <div
          role="tablist"
          aria-label="Filter by status"
          className="hidden rounded-lg border border-slate-300 bg-white p-0.5 sm:flex dark:border-slate-700 dark:bg-slate-900"
        >
          {STATUS_TABS.map((tab) => {
            const selected = filters.status === tab.value;
            return (
              <button
                key={tab.label}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onChange({ status: tab.value, page: 1 })}
                className={cx(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  selected
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <select
          aria-label="Filter by status"
          value={filters.status ?? ""}
          onChange={(event) =>
            onChange({
              status: (event.target.value || null) as ProjectFilters["status"],
              page: 1,
            })
          }
          className={controlClass(false, "sm:hidden")}
        >
          <option value="">All statuses</option>
          {PROJECT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>

        <div className="flex gap-3 lg:ml-auto">
          <select
            aria-label="Filter by team member"
            value={filters.assigneeId ?? ""}
            onChange={(event) =>
              onChange({ assigneeId: Number(event.target.value) || null, page: 1 })
            }
            className={controlClass(false, "lg:w-48")}
          >
            <option value="">Everyone</option>
            {team.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Sort projects"
            value={`${filters.sort}:${filters.order}`}
            onChange={(event) => {
              const [sort, order] = event.target.value.split(":");
              onChange({
                sort: sort as ProjectFilters["sort"],
                order: order as ProjectFilters["order"],
                page: 1,
              });
            }}
            className={controlClass(false, "lg:w-52")}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
