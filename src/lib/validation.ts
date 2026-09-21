/**
 * Request validation.
 *
 * Every value that reaches the database is parsed through one of these schemas
 * first, so handlers can trust their inputs and the client gets a predictable
 * `{ error, details }` payload when something is wrong.
 */

import { z } from "zod";
import { PROJECT_STATUSES, SORT_FIELDS } from "./types";

const MAX_BUDGET = 9_999_999_999.99; // Fits NUMERIC(12, 2).

/**
 * The field rules, declared once and *without* defaults.
 *
 * Defaults belong to create only: a PATCH must be able to tell "field omitted"
 * from "field set to its default value", otherwise an update that only changes
 * the status would silently blank out the client and description.
 */
const fields = {
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  client: z.string().trim().max(120),
  description: z.string().trim().max(2000),
  status: z.enum(PROJECT_STATUSES),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Deadline must be a YYYY-MM-DD date")
    // Date.parse accepts 2027-02-31 and silently rolls it over to 3 March, so
    // the parts are compared back against the parsed date. Letting an
    // impossible date through would fail later in Postgres as a 500.
    .refine((value) => {
      const [year, month, day] = value.split("-").map(Number);
      const parsed = new Date(Date.UTC(year, month - 1, day));
      return (
        parsed.getUTCFullYear() === year &&
        parsed.getUTCMonth() === month - 1 &&
        parsed.getUTCDate() === day
      );
    }, "Deadline is not a real date"),
  // Not `z.coerce.number()`: that turns an empty input into 0, so a user who
  // forgot to type a budget would silently get a zero-budget project.
  budget: z
    .union([
      z.number(),
      z
        .string()
        .trim()
        .min(1, "Budget is required")
        .regex(/^-?\d+(\.\d+)?$/, "Budget must be a number"),
    ])
    .transform(Number)
    .pipe(
      z
        .number()
        .refine((value) => Number.isFinite(value), "Budget must be a number")
        .min(0, "Budget cannot be negative")
        .max(MAX_BUDGET, "Budget is too large")
        // The column is NUMERIC(12, 2); rejecting here beats letting Postgres
        // round the value without telling anyone.
        // The epsilon absorbs float noise: 0.07 * 100 is 7.000000000000001.
        .refine(
          (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
          "Budget can have at most 2 decimal places",
        ),
    ),
  assigneeId: z.coerce.number().int().positive().nullable(),
};

/** POST /api/projects - the optional fields fall back to their empty value. */
export const projectInputSchema = z.object({
  ...fields,
  client: fields.client.default(""),
  description: fields.description.default(""),
  assigneeId: fields.assigneeId.default(null),
});

/** PATCH /api/projects/[id] - any subset of the same fields, nothing implied. */
export const projectPatchSchema = z
  .object(fields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, "No fields to update");

export const listQuerySchema = z.object({
  search: z.string().trim().max(120).default(""),
  status: z.enum(PROJECT_STATUSES).nullish(),
  assigneeId: z.coerce.number().int().positive().nullish(),
  sort: z.enum(SORT_FIELDS).default("deadline"),
  order: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type ProjectInput = z.infer<typeof projectInputSchema>;
export type ProjectPatch = z.infer<typeof projectPatchSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;

/** Flattens a ZodError into `{ field: message }` for the form UI. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    result[key] ??= issue.message;
  }
  return result;
}

/** Reads and validates list filters straight off a request URL. */
export function parseListQuery(searchParams: URLSearchParams) {
  const raw = Object.fromEntries(searchParams.entries());
  // Treat blank query-string values as "not provided", so `?status=` means "all".
  for (const [key, value] of Object.entries(raw)) {
    if (value === "") delete raw[key];
  }
  return listQuerySchema.safeParse(raw);
}
