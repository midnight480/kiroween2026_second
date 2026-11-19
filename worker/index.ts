// 灯 Tomoshibi の Worker。/api/* だけここを通り、それ以外は静的アセットが返る (cloudflare.config.ts)。
//
//   GET  /api/health  DB に SELECT 1 (サインイン不要)
//   GET  /api/data    サインインした人の課題とプロジェクト
//   POST /api/sync    変わった課題とプロジェクトだけを書き込む / 消す
//   /api/v1/*         API キーで使う公開 API (worker/v1.ts)
//
// 課題とプロジェクトは、ブラウザが持つ JSON (src/store.ts の Task, Project) をそのまま data に入れる。
// 中身の検査と補正はブラウザ側の normalize が行う。ここでは大きさと形だけを確かめ、
// 必ず本人 (Clerk のセッショントークンの sub) の行だけを読み書きする。
import { verifyToken } from "@clerk/backend";
import { Client } from "pg";
import { v1 } from "./v1";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Limits per person and per request, so one account cannot fill the database. */
const LIMITS = {
  body: 1_000_000,       // bytes per request
  item: 32_000,          // bytes per task or project
  idLength: 64,
  perRequest: 500,       // upserts + deletes, per kind
  tasks: 2_000,          // stored per person
  projects: 100,
};

type Kind = "tasks" | "projects";
const KINDS: Kind[] = ["tasks", "projects"];

/** The Clerk user id, or null when the request has no valid session token. */
async function userId(request: Request, env: Env): Promise<string | null> {
  const header = request.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  try {
    const claims = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
      // The page and the API share one origin, so the token must have been made for this origin.
      authorizedParties: [new URL(request.url).origin],
    });
    return typeof claims.sub === "string" && claims.sub ? claims.sub : null;
  } catch {
    return null;
  }
}

async function withDb<T>(env: Env, ctx: ExecutionContext, fn: (db: Client) => Promise<T>): Promise<T> {
  // プールは Hyperdrive が持つので、リクエストごとに Client を作ってよい
  const db = new Client({ connectionString: env.HYPERDRIVE.connectionString });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    ctx.waitUntil(db.end().catch(() => {}));
  }
}

/** DB に SELECT 1 を投げて、Hyperdrive 経由で Neon につながるかを返す。 */
async function health(env: Env, ctx: ExecutionContext): Promise<Response> {
  const started = Date.now();
  try {
    const ok = await withDb(env, ctx, async (db) => (await db.query<{ ok: number }>("SELECT 1 AS ok")).rows[0]?.ok === 1);
    return json({ ok, db: "up", ms: Date.now() - started });
  } catch (err) {
    // 詳細はログにだけ出し、応答には載せない (接続先の情報を外に出さない)
    console.error("health: database check failed", err);
    return json({ ok: false, db: "down", ms: Date.now() - started }, 503);
  }
}

async function getData(env: Env, ctx: ExecutionContext, uid: string): Promise<Response> {
  const out = await withDb(env, ctx, async (db) => {
    const tasks = await db.query<{ data: unknown }>("SELECT data FROM tasks WHERE user_id = $1", [uid]);
    const projects = await db.query<{ data: unknown }>("SELECT data FROM projects WHERE user_id = $1", [uid]);
    return { tasks: tasks.rows.map((r) => r.data), projects: projects.rows.map((r) => r.data) };
  });
  return json(out);
}

interface Change { upsert: Record<Kind, { id: string; data: string }[]>; remove: Record<Kind, string[]> }

const okId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= LIMITS.idLength;

/** Check the shape of a sync body. Returns an error message, or the change to apply. */
function parseChange(body: unknown): Change | string {
  if (!body || typeof body !== "object") return "body must be an object";
  const b = body as { upsert?: Record<string, unknown>; remove?: Record<string, unknown> };
  const change: Change = { upsert: { tasks: [], projects: [] }, remove: { tasks: [], projects: [] } };
  for (const kind of KINDS) {
    const up = b.upsert?.[kind] ?? [];
    const rm = b.remove?.[kind] ?? [];
    if (!Array.isArray(up) || !Array.isArray(rm)) return `${kind}: upsert and remove must be arrays`;
    if (up.length + rm.length > LIMITS.perRequest) return `${kind}: too many changes in one request`;
    for (const item of up) {
      if (!item || typeof item !== "object" || Array.isArray(item)) return `${kind}: each item must be an object`;
      const id = (item as { id?: unknown }).id;
      if (!okId(id)) return `${kind}: bad id`;
      const data = JSON.stringify(item);
      if (data.length > LIMITS.item) return `${kind}: item too large`;
      change.upsert[kind].push({ id, data });
    }
    for (const id of rm) {
      if (!okId(id)) return `${kind}: bad id`;
      change.remove[kind].push(id);
    }
  }
  return change;
}

async function sync(request: Request, env: Env, ctx: ExecutionContext, uid: string): Promise<Response> {
  const length = Number(request.headers.get("Content-Length") ?? 0);
  if (length > LIMITS.body) return json({ error: "request too large" }, 413);
  const text = await request.text();
  if (text.length > LIMITS.body) return json({ error: "request too large" }, 413);
  let body: unknown;
  try { body = JSON.parse(text); } catch { return json({ error: "body must be JSON" }, 400); }
  const change = parseChange(body);
  if (typeof change === "string") return json({ error: change }, 400);

  return withDb(env, ctx, async (db) => {
    await db.query("BEGIN");
    try {
      for (const kind of KINDS) {
        // table names come from the fixed KINDS list, never from the request
        if (change.remove[kind].length) {
          await db.query(`DELETE FROM ${kind} WHERE user_id = $1 AND id = ANY($2::text[])`, [uid, change.remove[kind]]);
        }
        const up = change.upsert[kind];
        if (up.length) {
          await db.query(
            `INSERT INTO ${kind} (user_id, id, data, updated_at)
             SELECT $1, u.id, u.data::jsonb, now() FROM unnest($2::text[], $3::text[]) AS u(id, data)
             ON CONFLICT (user_id, id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
            [uid, up.map((x) => x.id), up.map((x) => x.data)],
          );
        }
        const { rows } = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${kind} WHERE user_id = $1`, [uid]);
        if ((rows[0]?.n ?? 0) > LIMITS[kind]) {
          await db.query("ROLLBACK");
          return json({ error: `${kind}: too many stored` }, 409);
        }
      }
      await db.query("COMMIT");
      return json({ ok: true });
    } catch (err) {
      await db.query("ROLLBACK").catch(() => {});
      throw err;
    }
  });
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    const method = request.method;
    try {
      if (pathname === "/api/health") {
        if (method !== "GET" && method !== "HEAD") return json({ error: "method not allowed" }, 405);
        return await health(env, ctx);
      }
      if (pathname === "/api/v1" || pathname.startsWith("/api/v1/")) {
        return await v1(request, env, (fn) => withDb(env, ctx, fn));
      }
      if (pathname === "/api/data" || pathname === "/api/sync") {
        const uid = await userId(request, env);
        if (!uid) return json({ error: "sign in required" }, 401);
        if (pathname === "/api/data") {
          if (method !== "GET") return json({ error: "method not allowed" }, 405);
          return await getData(env, ctx, uid);
        }
        if (method !== "POST") return json({ error: "method not allowed" }, 405);
        return await sync(request, env, ctx, uid);
      }
      return json({ error: "not found" }, 404);
    } catch (err) {
      console.error(`${method} ${pathname} failed`, err);
      return json({ error: "server error" }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
