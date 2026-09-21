/**
 * Presentation helpers.
 *
 * Locale and time zone are pinned explicitly rather than left to the runtime,
 * so a value renders identically on the server and in the browser.
 */

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

/** `$1.6M` - for headline figures where the exact cents do not matter. */
export function formatCompactCurrency(value: number): string {
  return compactCurrencyFormatter.format(value);
}

/** Turns `2026-04-07` into `Apr 7, 2026`. */
export function formatDate(isoDate: string): string {
  return dateFormatter.format(new Date(`${isoDate}T00:00:00Z`));
}

/** Whole days from today until `isoDate`; negative once the date has passed. */
export function daysUntil(isoDate: string): number {
  const target = new Date(`${isoDate}T00:00:00Z`).getTime();
  const today = new Date();
  const startOfToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - startOfToday) / 86_400_000);
}

/** Short human phrasing for a deadline: `Overdue by 3 days`, `Due today`, `in 12 days`. */
export function describeDeadline(isoDate: string): string {
  const days = daysUntil(isoDate);
  if (days < -1) return `${Math.abs(days)} days overdue`;
  if (days === -1) return "1 day overdue";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days <= 30) return `in ${days} days`;
  const months = Math.round(days / 30);
  return months === 1 ? "in 1 month" : `in ${months} months`;
}

/** Today as `YYYY-MM-DD`, used as the default deadline for a new project. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** `AO` for `Amara Okafor` - the avatar fallback. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.at(-1)?.[0] ?? "")).toUpperCase();
}

/**
 * Deterministic colour per person, so the same team member always gets the
 * same avatar tint without storing one.
 */
const AVATAR_TINTS = [
  "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
];

export function avatarTint(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_TINTS[Math.abs(hash) % AVATAR_TINTS.length];
}
