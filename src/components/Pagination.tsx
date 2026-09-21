"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "./icons";
import { Button, controlClass } from "./ui";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onChange: (patch: { page?: number; pageSize?: number }) => void;
}

const PAGE_SIZES = [10, 25, 50];

export function Pagination({ page, pageSize, total, totalPages, onChange }: PaginationProps) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
      <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
        <span className="tabular-nums">
          {first}-{last} of {total}
        </span>
        <label className="flex items-center gap-2">
          <span className="sr-only sm:not-sr-only">Rows</span>
          <select
            aria-label="Rows per page"
            value={pageSize}
            onChange={(event) => onChange({ pageSize: Number(event.target.value), page: 1 })}
            className={controlClass(false, "w-auto py-1 text-xs")}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-2">
        <Button
          onClick={() => onChange({ page: page - 1 })}
          disabled={page <= 1}
          aria-label="Previous page"
          className="px-2"
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
        <span className="text-sm text-slate-600 tabular-nums dark:text-slate-300">
          Page {page} of {totalPages}
        </span>
        <Button
          onClick={() => onChange({ page: page + 1 })}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="px-2"
        >
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}
