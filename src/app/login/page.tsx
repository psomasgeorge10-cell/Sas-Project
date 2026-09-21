import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { getSessionUser } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sign in" };

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  if (await getSessionUser()) redirect("/");

  const { next } = await searchParams;
  // Only accept a same-site path, so `?next=` cannot be used to bounce a user
  // to another origin after signing in.
  const redirectTo = next?.startsWith("/") && !next.startsWith("//") ? next : "/";

  return <LoginForm redirectTo={redirectTo} />;
}
