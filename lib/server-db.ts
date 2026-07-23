import { Client } from "pg";

// Direct Postgres access for server-only code paths (API route handlers)
// that need data RLS won't hand back to an anon/guest session — e.g.
// looking up admin email addresses to notify. Only ever import this from
// route.ts handlers (App Router route handlers are never bundled to the
// browser) — never from a "use client" component. Opens a short-lived
// connection per call; fine at this traffic volume, but a pooled client
// would be the next step if this ever gets busy.
export async function queryDb<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    const res = await client.query(sql, params);
    return res.rows as T[];
  } finally {
    await client.end();
  }
}
