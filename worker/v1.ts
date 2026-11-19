// 灯 Tomoshibi の公開 API (/api/v1/*)。使い方は api.html、設計は docs/api.md。
//
//   GET   /api/v1/projects        プロジェクトと名簿
//   GET   /api/v1/tasks           課題の一覧 (?project=<id>&status=todo|doing|done)
//   POST  /api/v1/tasks           課題の登録
//   PATCH /api/v1/tasks/:id       課題の変更 (件名、期限、メモ、担当者、状態)
//
// キーは Clerk の API キー (アカウントの画面で本人が発行・取り消す)。ここでは Clerk に問い合わせて
// 持ち主 (subject = Clerk のユーザー id) を確かめ、その人の行だけを読み書きする。
// 保存する JSON は、画面 (src/store.ts の Task) と同じ形にする。
import { createClerkClient } from "@clerk/backend";
import type { Client } from "pg";

type Json = Record<string, unknown>;
type Db = Client;

const LIMIT = {
  perMinute: 60,     // requests per key
  body: 16_000,      // bytes per request
  item: 32_000,      // bytes per stored task (same as /api/sync)
  open: 60,          // open tasks per project (same as the board)
  stored: 2_000,     // tasks per person (same as /api/sync)
  title: 80,
  note: 500,
};
const MIN_AHEAD = 60_000;
const MAX_AHEAD = 365 * 86_400_000;
/** A verified key is trusted for this long, to spare a call to Clerk on every request. */
const CACHE_MS = 60_000;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
const fail = (status: number, error: string, headers?: Record<string, string>) => json({ error }, status, headers);

async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const verified = new Map<string, { uid: string; until: number }>();
/** The Clerk user who owns the key, or null when it is unknown, revoked, expired or not a user's key. */
async function keyOwner(secret: string, hash: string, env: Env): Promise<string | null> {
  const hit = verified.get(hash);
  if (hit && hit.until > Date.now()) return hit.uid;
  try {
    const key = await createClerkClient({ secretKey: env.CLERK_SECRET_KEY }).apiKeys.verify(secret);
    if (key.revoked || key.expired || !key.subject.startsWith("user_")) return null;
    if (verified.size > 1000) verified.clear();
    verified.set(hash, { uid: key.subject, until: Date.now() + CACHE_MS });
    return key.subject;
  } catch {
    return null;
  }
}

/** Count this request against the key. Returns the seconds to wait, or 0 when it may go on. */
async function overLimit(db: Db, hash: string): Promise<number> {
  const { rows } = await db.query<{ count: number; reset: number }>(
    `INSERT INTO api_rate (key_hash, window_start, count) VALUES ($1, now(), 1)
     ON CONFLICT (key_hash) DO UPDATE SET
       count = CASE WHEN api_rate.window_start > now() - interval '1 minute' THEN api_rate.count + 1 ELSE 1 END,
       window_start = CASE WHEN api_rate.window_start > now() - interval '1 minute' THEN api_rate.window_start ELSE now() END
     RETURNING count, ceil(extract(epoch FROM (window_start + interval '1 minute' - now())))::int AS reset`,
    [hash],
  );
  const r = rows[0];
  return r && r.count > LIMIT.perMinute ? Math.max(1, r.reset) : 0;
}

/* ---------- reading what the board saved ---------- */
interface Member { id: string; name: string; role: string }
interface Project { id: string; name: string; created: number; members: Member[] }

function toProject(d: Json): Project | null {
  if (typeof d.id !== "string" || typeof d.name !== "string") return null;
  const members = Array.isArray(d.members)
    ? (d.members as Json[]).filter((m) => m && typeof m.id === "string" && typeof m.name === "string")
      .map((m) => ({ id: m.id as string, name: m.name as string, role: typeof m.role === "string" ? m.role : "member" }))
    : [];
  return { id: d.id, name: d.name, created: typeof d.created === "number" ? d.created : 0, members };
}

async function projectsOf(db: Db, uid: string): Promise<Project[]> {
  const { rows } = await db.query<{ data: Json }>("SELECT data FROM projects WHERE user_id = $1", [uid]);
  return rows.map((r) => toProject(r.data)).filter((p): p is Project => !!p).sort((a, b) => a.created - b.created);
}

const iso = (ms: unknown) => (typeof ms === "number" && Number.isFinite(ms) ? new Date(ms).toISOString() : null);
const statusOf = (d: Json) => (d.status === "doing" || d.status === "done" ? d.status : "todo");

/** A stored task as the API shows it. */
function publicTask(d: Json, now = Date.now()) {
  const status = statusOf(d);
  return {
    id: d.id,
    project: d.projectId ?? null,
    title: d.title,
    note: typeof d.note === "string" && d.note ? d.note : null,
    assignee: typeof d.assignee === "string" && d.assignee ? d.assignee : null,
    status,
    due: iso(d.due),
    created: iso(d.created),
    doneAt: status === "done" ? iso(d.doneAt) : null,
    late: d.late === true,
    overdue: status !== "done" && typeof d.due === "number" && d.due <= now,
    extended: typeof d.extended === "number" ? d.extended : 0,
  };
}

/* ---------- checking input ---------- */
async function readBody(request: Request): Promise<Json | Response> {
  if (Number(request.headers.get("Content-Length") ?? 0) > LIMIT.body) return fail(413, "request too large");
  const text = await request.text();
  if (text.length > LIMIT.body) return fail(413, "request too large");
  let body: unknown;
  try { body = JSON.parse(text); } catch { return fail(400, "body must be JSON"); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail(400, "body must be a JSON object");
  return body as Json;
}

/** `due` (ISO 8601 with a time zone) or `minutes` from now. Undefined when neither was sent. */
function readDue(b: Json, now: number): number | string | undefined {
  if (b.due !== undefined && b.minutes !== undefined) return "send due or minutes, not both";
  let ms: number;
  if (b.minutes !== undefined) {
    if (!Number.isInteger(b.minutes)) return "minutes must be a whole number";
    ms = now + (b.minutes as number) * 60_000;
  } else if (b.due !== undefined) {
    if (typeof b.due !== "string" || !/(Z|[+-]\d{2}:?\d{2})$/i.test(b.due.trim()) || !Number.isFinite(Date.parse(b.due))) {
      return "due must be ISO 8601 with a time zone, e.g. 2026-11-20T18:00:00+09:00";
    }
    ms = Date.parse(b.due);
  } else {
    return undefined;
  }
  if (ms < now + MIN_AHEAD) return "the deadline must be at least a minute from now";
  if (ms > now + MAX_AHEAD) return "the deadline must be within a year";
  return Math.floor(ms / 60_000) * 60_000;
}

function readTitle(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/\s+/g, " ");
  return s.length >= 1 && [...s].length <= LIMIT.title ? s : null;
}

/** undefined = not sent, null = clear it, string = the new note. Error text when too long. */
function readNote(v: unknown): string | null | undefined | { error: string } {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  if (typeof v !== "string") return { error: "note must be a string" };
  return [...v].length <= LIMIT.note ? v : { error: `note must be at most ${LIMIT.note} characters` };
}

/** undefined = not sent, null = nobody, string = a member of the project's roster. */
function readAssignee(v: unknown, project: Project): string | null | undefined | { error: string } {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  if (typeof v !== "string" || !project.members.some((m) => m.id === v)) {
    return { error: "assignee must be the id of a member of the task's project (GET /api/v1/projects)" };
  }
  return v;
}
const isErr = (v: unknown): v is { error: string } => !!v && typeof v === "object" && "error" in (v as object);

/* ---------- routes ---------- */
async function listProjects(db: Db, uid: string): Promise<Response> {
  return json({ projects: await projectsOf(db, uid) });
}

async function listTasks(db: Db, uid: string, url: URL): Promise<Response> {
  const project = url.searchParams.get("project");
  const status = url.searchParams.get("status");
  if (status && !["todo", "doing", "done"].includes(status)) return fail(400, "status must be todo, doing or done");
  const { rows } = await db.query<{ data: Json }>("SELECT data FROM tasks WHERE user_id = $1", [uid]);
  const now = Date.now();
  const tasks = rows.map((r) => r.data)
    .filter((d) => (!project || d.projectId === project) && (!status || statusOf(d) === status))
    .sort((a, b) => (a.due as number) - (b.due as number))
    .map((d) => publicTask(d, now));
  return json({ tasks });
}

async function createTask(db: Db, uid: string, request: Request): Promise<Response> {
  const b = await readBody(request);
  if (b instanceof Response) return b;
  const now = Date.now();
  const title = readTitle(b.title);
  if (!title) return fail(400, `title is required (1 to ${LIMIT.title} characters)`);
  const due = readDue(b, now);
  if (due === undefined) return fail(400, "send due (ISO 8601) or minutes");
  if (typeof due === "string") return fail(400, due);
  if (b.status !== undefined && b.status !== "todo" && b.status !== "doing") return fail(400, "status must be todo or doing");

  const projects = await projectsOf(db, uid);
  if (!projects.length) return fail(409, "no project yet: sign in on the board once, then try again");
  let project = projects[0];
  if (b.project !== undefined) {
    const p = projects.find((x) => x.id === b.project);
    if (!p) return fail(404, "no such project (GET /api/v1/projects)");
    project = p;
  }
  const note = readNote(b.note);
  if (isErr(note)) return fail(400, note.error);
  const assignee = readAssignee(b.assignee, project);
  if (isErr(assignee)) return fail(400, assignee.error);

  const counts = await db.query<{ open: number; total: number }>(
    `SELECT count(*) FILTER (WHERE data->>'projectId' = $2 AND coalesce(data->>'status', 'todo') <> 'done')::int AS open,
            count(*)::int AS total
       FROM tasks WHERE user_id = $1`, [uid, project.id]);
  if ((counts.rows[0]?.open ?? 0) >= LIMIT.open) return fail(409, `this project already holds ${LIMIT.open} open candles`);
  if ((counts.rows[0]?.total ?? 0) >= LIMIT.stored) return fail(409, "too many tasks stored");

  // the same shape as a task made on the board (src/store.ts: Task)
  const task: Json = {
    id: crypto.randomUUID(), projectId: project.id, title,
    ...(note ? { note } : {}), ...(assignee ? { assignee } : {}),
    created: now, due, status: (b.status as string | undefined) ?? "todo",
    extended: 0, cursed: false, penalty: 0, updated: now,
  };
  await db.query(
    "INSERT INTO tasks (user_id, id, data, updated_at) VALUES ($1, $2, $3::jsonb, now())",
    [uid, task.id, JSON.stringify(task)]);
  return json({ task: publicTask(task, now) }, 201, { Location: `/api/v1/tasks/${task.id}` });
}

async function updateTask(db: Db, uid: string, id: string, request: Request): Promise<Response> {
  const b = await readBody(request);
  if (b instanceof Response) return b;
  const { rows } = await db.query<{ data: Json }>("SELECT data FROM tasks WHERE user_id = $1 AND id = $2", [uid, id]);
  if (!rows[0]) return fail(404, "no such task");
  const task: Json = { ...rows[0].data };
  const now = Date.now();

  if (b.title !== undefined) {
    const title = readTitle(b.title);
    if (!title) return fail(400, `title must be 1 to ${LIMIT.title} characters`);
    task.title = title;
  }
  const note = readNote(b.note);
  if (isErr(note)) return fail(400, note.error);
  if (note === null) delete task.note; else if (note !== undefined) task.note = note;

  if (b.assignee !== undefined) {
    const project = (await projectsOf(db, uid)).find((p) => p.id === task.projectId);
    if (!project) return fail(409, "the task's project is gone");
    const assignee = readAssignee(b.assignee, project);
    if (isErr(assignee)) return fail(400, assignee.error);
    if (assignee === null) delete task.assignee; else task.assignee = assignee;
  }

  const due = readDue(b, now);
  if (typeof due === "string") return fail(400, due);
  if (due !== undefined) {
    // like "Add wax" on the board: a later deadline counts as an extension; the haunting's toll is lifted
    if (typeof task.due === "number" && due > task.due) task.extended = (typeof task.extended === "number" ? task.extended : 0) + 1;
    task.due = due;
    task.penalty = 0;
  }

  if (b.status !== undefined) {
    if (b.status !== "todo" && b.status !== "doing" && b.status !== "done") return fail(400, "status must be todo, doing or done");
    const was = statusOf(task);
    if (b.status === "done" && was !== "done") {
      task.doneAt = now;
      if (typeof task.due === "number" && now > task.due) task.late = true; else delete task.late;
    } else if (b.status !== "done") {
      if (was === "done") {
        const open = await db.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM tasks WHERE user_id = $1 AND data->>'projectId' = $2 AND coalesce(data->>'status', 'todo') <> 'done'`,
          [uid, task.projectId]);
        if ((open.rows[0]?.n ?? 0) >= LIMIT.open) return fail(409, `this project already holds ${LIMIT.open} open candles`);
      }
      delete task.doneAt;
      delete task.late;
    }
    task.status = b.status;
  }

  task.updated = now;
  const data = JSON.stringify(task);
  if (data.length > LIMIT.item) return fail(413, "task too large");
  await db.query("UPDATE tasks SET data = $3::jsonb, updated_at = now() WHERE user_id = $1 AND id = $2", [uid, id, data]);
  return json({ task: publicTask(task, now) });
}

/** Everything under /api/v1. `withDb` comes from worker/index.ts. */
export async function v1(
  request: Request, env: Env, withDb: <T>(fn: (db: Db) => Promise<T>) => Promise<T>,
): Promise<Response> {
  const url = new URL(request.url);
  const header = request.headers.get("Authorization") ?? "";
  const secret = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const challenge = { "WWW-Authenticate": 'Bearer realm="tomoshibi"' };
  if (!secret) return fail(401, "API key required: Authorization: Bearer <key>", challenge);
  if (secret.length > 512) return fail(401, "invalid API key", challenge);
  const hash = await sha256(secret);

  return withDb(async (db) => {
    const wait = await overLimit(db, hash);
    if (wait) return fail(429, `too many requests: at most ${LIMIT.perMinute} a minute per key`, { "Retry-After": String(wait) });
    const uid = await keyOwner(secret, hash, env);
    if (!uid) return fail(401, "invalid API key", challenge);

    const path = url.pathname.replace(/\/+$/, "");
    const method = request.method;
    if (path === "/api/v1/projects") {
      return method === "GET" ? listProjects(db, uid) : fail(405, "method not allowed");
    }
    if (path === "/api/v1/tasks") {
      if (method === "GET") return listTasks(db, uid, url);
      if (method === "POST") return createTask(db, uid, request);
      return fail(405, "method not allowed");
    }
    const m = /^\/api\/v1\/tasks\/([^/]{1,64})$/.exec(path);
    if (m) {
      return method === "PATCH" ? updateTask(db, uid, decodeURIComponent(m[1]), request) : fail(405, "method not allowed");
    }
    return fail(404, "not found");
  });
}
