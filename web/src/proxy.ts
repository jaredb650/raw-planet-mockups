/**
 * Optimistic gate for /admin: bounce visitors without a session cookie to the
 * login page. Real verification happens in requireAdmin() on every page,
 * server action and admin API route.
 */
import { NextResponse, type NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login") && !req.cookies.has("rp_admin")) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*"] };
