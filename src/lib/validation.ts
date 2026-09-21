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

export const projectInputSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  client: z.string().trim().max(120).default(""),
  description: z.string().trim().max(2000).default(""),
  status: z.enum(PROJECT_STATUSES),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Deadline must be a YYYY-MM-DD date")
    .refine((value) => !Number.isNaN(Date.parse(value)), "Deadline is not a real date"),
  budget: z.coerce
    .number()
    .min(0, "Budget cannot be negative")
    .max(MAX_BUDGET, "Budget is too large")
    .refine((value) => Number.isFinite(value), "Budget must be a number"),
  assigneeId: z.coerce.number().int().positive().nullable().default(null),
});

/** PATCH accepts any subset of the create payload. */
export const projectPatchSchema = projectInputSchema
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
  // Treat blank query-string values as "not provided" so `?status=` means "all".
  for (const [key, value] of Object.entries(raw)) {
    if (value === "") delete raw[key];
  }
  return listQuerySchema.safeParse(raw);
}
