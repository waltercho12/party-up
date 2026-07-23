import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";
import dotenv from "dotenv";

dotenv.config({ path: resolve(".env.local") });

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node scripts/run-sql.mjs <path-to-sql-file>");
  process.exit(1);
}

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("Missing SUPABASE_DB_URL in .env.local");
  process.exit(1);
}

const sql = readFileSync(resolve(filePath), "utf8");

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(sql);
  console.log(`OK: ${filePath} applied successfully.`);
} catch (err) {
  console.error(`FAILED: ${filePath}`);
  console.error(err.message);
  process.exit(1);
} finally {
  await client.end();
}
