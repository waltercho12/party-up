import type { NextRequest } from "next/server";

// Same-origin check for state-changing API routes. Supabase's auth cookies
// are already SameSite=Lax (the main CSRF defense for the cookie-based
// session itself), but these routes accept a plain JSON body too, so this
// catches cross-site form/fetch submissions that don't carry cookies at all.
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    // Same-origin navigations/fetches from a browser always send Origin
    // for POST requests; a missing header means it didn't come from a page.
    return false;
  }
  return origin === request.nextUrl.origin;
}

// Lightweight in-memory sliding-window limiter. This resets on every cold
// start and isn't shared across serverless instances, so treat it as a
// supplementary guard only — the authoritative limit lives in Postgres
// (enforce_support_ticket_rate_limit), which holds regardless of instance
// count or restarts.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) {
    return false;
  }
  bucket.count += 1;
  return true;
}

export function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
