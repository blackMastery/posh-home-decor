import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ---------------------------------------------------------------------------
// Redirects (renamed categories / product slugs). The table is small, so it is
// cached in memory with a short TTL. A from_path is never a live path (the DB
// deletes redirects whose source becomes live again), so checking it before
// rendering is equivalent to checking on 404.
// ---------------------------------------------------------------------------

const REDIRECT_TTL_MS = 30_000;
let redirectCache: { at: number; map: Map<string, string> } | null = null;

async function getRedirects() {
  if (redirectCache && Date.now() - redirectCache.at < REDIRECT_TTL_MS) return redirectCache.map;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/redirects?select=from_path,to_path`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(String(res.status));
    const rows = (await res.json()) as { from_path: string; to_path: string }[];
    redirectCache = { at: Date.now(), map: new Map(rows.map((r) => [r.from_path, r.to_path])) };
  } catch {
    // Keep serving the last known table (or none) if Supabase is unreachable.
    redirectCache = { at: Date.now(), map: redirectCache?.map ?? new Map() };
  }
  return redirectCache.map;
}

async function handleRedirect(request: NextRequest) {
  const path = decodeURIComponent(request.nextUrl.pathname).replace(/\/+$/, "").toLowerCase();
  const map = await getRedirects();
  // Exact match, or a descendant of a moved category (/shop/old/... → /shop/new/...).
  let target = map.get(path);
  if (!target && path.startsWith("/shop/")) {
    const parts = path.split("/");
    for (let i = parts.length - 1; i > 2 && !target; i--) {
      const prefix = parts.slice(0, i).join("/");
      const to = map.get(prefix);
      if (to) target = to + path.slice(prefix.length);
    }
  }
  if (!target) return null;
  const url = request.nextUrl.clone();
  url.pathname = target;
  return NextResponse.redirect(url, 308);
}

// ---------------------------------------------------------------------------
// Admin session refresh + guard (server actions re-check is_admin()).
// ---------------------------------------------------------------------------

async function handleAdmin(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLogin = request.nextUrl.pathname === "/admin/login";
  if (!user && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    const res = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  }
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/admin")) return handleAdmin(request);
  if (pathname.startsWith("/shop/") || pathname.startsWith("/products/")) {
    return (await handleRedirect(request)) ?? NextResponse.next();
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/shop/:path+", "/products/:path+"],
};
