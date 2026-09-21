import { STATUS_LABELS, type ProjectStatus } from "@/lib/types";
import { cx } from "./ui";

const STATUS_STYLES: Record<ProjectStatus, string> = {
  active:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20",
  on_hold:
    "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20",
  completed:
    "bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-400/20",
};

const DOT_STYLES: Record<ProjectStatus, string> = {
  active: "bg-emerald-500",
  on_hold: "bg-amber-500",
  completed: "bg-slate-400",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        STATUS_STYLES[status],
      )}
    >
      <span className={cx("size-1.5 rounded-full", DOT_STYLES[status])} aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}
