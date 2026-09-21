"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { avatarTint, initials } from "@/lib/format";
import type { SessionUser } from "@/lib/types";
import { LogoIcon, LogoutIcon } from "./icons";
import { Button, cx } from "./ui";

export function AppHeader({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await api.logout();
    } finally {
      // Even if the request failed, send the user to the login screen; the
      // middleware will bounce them back if the cookie somehow survived.
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <LogoIcon className="size-8 text-indigo-600" />
          <div className="leading-tight">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Atlas</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Project dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{user.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
          </div>
          <span
            className={cx(
              "flex size-9 items-center justify-center rounded-full text-xs font-semibold",
              avatarTint(user.email),
            )}
            aria-hidden="true"
          >
            {initials(user.name)}
          </span>
          <Button variant="ghost" onClick={signOut} loading={signingOut} className="px-2">
            <LogoutIcon className="size-4" />
            <span className="sr-only sm:not-sr-only">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
