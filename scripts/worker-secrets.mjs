// Build .env.worker.production (git-ignored, mode 600) for `npm run deploy:secrets`:
// the Neon values from .env.local plus the Clerk secret key already in the file.
// Never prints a value. Keys must also be declared with bindings.secret() in cloudflare.config.ts.
import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { parseEnv } from "node:util";

const OUT = ".env.worker.production";
const FROM_LOCAL = ["DATABASE_URL", "DATABASE_URL_UNPOOLED", "NEON_BRANCH", "NEON_BRANCH_ID", "NEON_FUNCTION_HOST_SUFFIX"];
const KEEP = ["CLERK_SECRET_KEY"]; // set by hand (sk_live_), see docs/deploy.md

const local = parseEnv(readFileSync(".env.local", "utf8"));
const current = existsSync(OUT) ? parseEnv(readFileSync(OUT, "utf8")) : {};
const out = {};
for (const k of KEEP) if (current[k]) out[k] = current[k];
for (const k of FROM_LOCAL) {
  if (!local[k]) { console.error(`missing in .env.local: ${k}`); process.exit(1); }
  out[k] = local[k];
}
const missing = KEEP.filter((k) => !out[k]);
writeFileSync(OUT, Object.entries(out).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join("\n") + "\n", { mode: 0o600 });
chmodSync(OUT, 0o600);
console.log(`wrote ${OUT}: ${Object.keys(out).join(", ")}`);
if (missing.length) console.warn(`not set (add by hand): ${missing.join(", ")}`);
