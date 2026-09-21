"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api-client";
import { loginSchema } from "@/lib/validation";
import { fieldErrors } from "@/lib/validation";
import { LogoIcon } from "./icons";
import { Button, Card, Field, controlClass } from "./ui";

/** Credentials created by `npm run db:setup`, shown so a reviewer can get straight in. */
const DEMO = { email: "admin@example.com", password: "password123" };

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(DEMO.email);
  const [password, setPassword] = useState(DEMO.password);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setSubmitting(true);
    setErrors({});
    setFormError(null);

    try {
      await api.login(parsed.data.email, parsed.data.password);
      // refresh() re-runs the server components so the dashboard renders with
      // the session that was just established.
      router.replace(redirectTo);
      router.refresh();
    } catch (caught) {
      setFormError(
        caught instanceof ApiError ? caught.message : "Could not sign in. Please try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <LogoIcon className="size-11 text-indigo-600" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              Sign in to Atlas
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Track project status, deadlines, owners and budgets.
            </p>
          </div>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            {formError && (
              <p
                role="alert"
                className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
              >
                {formError}
              </p>
            )}

            <Field label="Email" htmlFor="email" error={errors.email}>
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "email-error" : undefined}
                className={controlClass(Boolean(errors.email))}
              />
            </Field>

            <Field label="Password" htmlFor="password" error={errors.password}>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "password-error" : undefined}
                className={controlClass(Boolean(errors.password))}
              />
            </Field>

            <Button type="submit" variant="primary" loading={submitting} className="mt-1 w-full">
              Sign in
            </Button>
          </form>
        </Card>

        <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
          Demo account: <code className="font-mono">{DEMO.email}</code> /{" "}
          <code className="font-mono">{DEMO.password}</code>
        </p>
      </div>
    </div>
  );
}
