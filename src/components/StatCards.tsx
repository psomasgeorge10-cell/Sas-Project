import type { ProjectStats } from "@/lib/types";
import { formatCompactCurrency } from "@/lib/format";
import { AlertIcon, LayersIcon, PlayIcon, WalletIcon } from "./icons";
import { Card, cx } from "./ui";

interface StatCardsProps {
  stats: ProjectStats | null;
}

const CARD_TONES = {
  indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
  sky: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300",
  rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
} as const;

export function StatCards({ stats }: StatCardsProps) {
  const cards = [
    {
      label: "Total projects",
      value: stats ? String(stats.total) : null,
      caption: stats ? `${stats.byStatus.completed} completed` : "",
      icon: <LayersIcon className="size-5" />,
      tone: "indigo" as const,
    },
    {
      label: "Active",
      value: stats ? String(stats.byStatus.active) : null,
      caption: stats ? `${stats.byStatus.on_hold} on hold` : "",
      icon: <PlayIcon className="size-5" />,
      tone: "emerald" as const,
    },
    {
      label: "Total budget",
      value: stats ? formatCompactCurrency(stats.totalBudget) : null,
      caption: "all projects",
      icon: <WalletIcon className="size-5" />,
      tone: "sky" as const,
    },
    {
      label: "Overdue",
      value: stats ? String(stats.overdue) : null,
      caption: "past deadline",
      icon: <AlertIcon className="size-5" />,
      tone: "rose" as const,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                {card.label}
              </p>
              {card.value === null ? (
                <div className="mt-2 h-7 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
              ) : (
                <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums dark:text-slate-50">
                  {card.value}
                </p>
              )}
              <p className="mt-1 truncate text-xs text-slate-400 dark:text-slate-500">
                {card.caption}
              </p>
            </div>
            <span className={cx("rounded-lg p-2", CARD_TONES[card.tone])}>{card.icon}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}
