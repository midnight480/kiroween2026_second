// Apply db/migrations/*.sql in name order, once each, to the Neon database in .env.local
// (DATABASE_URL_UNPOOLED, the direct connection). Never prints the connection string.
import { readdirSync, readFileSync } from "node:fs";
import pg from "pg";

process.loadEnvFile(".env.local");
const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) { console.error("DATABASE_URL_UNPOOLED is not set in .env.local"); process.exit(1); }

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const done = new Set((await client.query("SELECT name FROM schema_migrations")).rows.map((r) => r.name));
  const files = readdirSync("db/migrations").filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    if (done.has(f)) { console.log(`skip  ${f}`); continue; }
    await client.query("BEGIN");
    try {
      await client.query(readFileSync(`db/migrations/${f}`, "utf8"));
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [f]);
      await client.query("COMMIT");
      console.log(`apply ${f}`);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  }
} finally {
  await client.end();
}
