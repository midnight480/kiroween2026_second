// 灯 Tomoshibi の Worker。/api/* だけここを通り、それ以外は静的アセットが返る (cloudflare.config.ts)。
import { Client } from "pg";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** DB に SELECT 1 を投げて、Hyperdrive 経由で Neon につながるかを返す。 */
async function health(env: Env, ctx: ExecutionContext): Promise<Response> {
  const started = Date.now();
  // プールは Hyperdrive が持つので、リクエストごとに Client を作ってよい
  const client = new Client({ connectionString: env.HYPERDRIVE.connectionString });
  try {
    await client.connect();
    const { rows } = await client.query<{ ok: number }>("SELECT 1 AS ok");
    return json({ ok: rows[0]?.ok === 1, db: "up", ms: Date.now() - started });
  } catch (err) {
    // 詳細はログにだけ出し、応答には載せない (接続先の情報を外に出さない)
    console.error("health: database check failed", err);
    return json({ ok: false, db: "down", ms: Date.now() - started }, 503);
  } finally {
    ctx.waitUntil(client.end().catch(() => {}));
  }
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/health") {
      if (request.method !== "GET" && request.method !== "HEAD") return json({ error: "method not allowed" }, 405);
      return health(env, ctx);
    }
    return json({ error: "not found" }, 404);
  },
} satisfies ExportedHandler<Env>;
