/**
 * Route protection.
 *
 * The middleware only checks the session cookie's signature - it is a cheap
 * gate that keeps unauthenticated users off the dashboard and signed-in users
 * off the login page. It is not the security boundary: every API route and the
 * dashboard page verify the session again on the server, so a bypass here
 * still yields a 401 rather than data.
 */

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = await verifySessionToken(token);
  const isLoginPage = request.nextUrl.pathname === "/login";

  if (!user && !isLoginPage) {
    const login = new URL("/login", request.url);
    // Remember where they were headed so login can send them back.
    login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }

  if (user && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Page routes only. API routes enforce authentication themselves and must
  // answer with 401 JSON rather than a redirect to HTML.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\.svg).*)"],
};
