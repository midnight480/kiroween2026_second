/**
 * The ledger of a signed-in person lives on the server (worker/index.ts, Neon through Hyperdrive).
 *
 * The board keeps calling `save(tasks)` and `saveProjects(projects)` as before (src/store.ts). While
 * signed in, those calls land here: we compare each item with what the server last confirmed and
 * send only what changed. A failed send is kept and tried again, so nothing is lost while offline.
 */
import { normalizeProjects, normalizeTasks, setRemote, type Project, type Task } from "./store";

type Kind = "tasks" | "projects";
const KINDS: Kind[] = ["tasks", "projects"];
type Token = () => Promise<string | null>;

/** What the server has, item by item (id -> JSON). */
let base: Record<Kind, Map<string, string>> = { tasks: new Map(), projects: new Map() };
/** The newest lists from the board, not yet sent. */
const latest: Record<Kind, Map<string, string> | null> = { tasks: null, projects: null };
let token: Token | null = null;
let onError: (() => void) | null = null;
let timer = 0;
let sending: Promise<void> | null = null;
let retryMs = 0;
let failed = false;

const toMap = (items: { id: string }[]) => new Map(items.map((x) => [x.id, JSON.stringify(x)]));

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const t = await token?.();
  if (!t) throw new Error("no session");
  const res = await fetch(path, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res;
}

/** The signed-in person's tasks and projects, as the board uses them. */
export async function fetchData(getToken: Token): Promise<{ tasks: Task[]; projects: Project[] }> {
  token = getToken;
  const body = await (await call("/api/data")).json() as { tasks?: unknown[]; projects?: unknown[] };
  return { tasks: normalizeTasks(body.tasks ?? []), projects: normalizeProjects(body.projects ?? []) };
}

let setRemoteOn = false;
/** True while the board saves to the server. */
export const active = () => setRemoteOn;

/** Start sending the board's saves to the server. `server` is what fetchData returned. */
export function start(getToken: Token, server: { tasks: Task[]; projects: Project[] }, error: () => void): void {
  token = getToken;
  onError = error;
  base = { tasks: toMap(server.tasks), projects: toMap(server.projects) };
  latest.tasks = latest.projects = null;
  failed = false;
  retryMs = 0;
  setRemoteOn = true;
  setRemote({
    tasks: (tasks) => queue("tasks", tasks),
    projects: (projects) => queue("projects", projects),
  });
}

/**
 * Sign-in: load the person's ledger from the server and start saving there.
 * On the very first sign-in the server is empty, and `local` (this device's guest ledger) moves up:
 * the caller gets a copy of it with `first: true` and should save it once, so it is sent.
 */
export async function connect(
  getToken: Token, local: { tasks: Task[]; projects: Project[] }, error: () => void,
  /** Checked after loading: false when the person signed out or switched meanwhile. Nothing starts then. */
  wanted: () => boolean = () => true,
): Promise<{ data: { tasks: Task[]; projects: Project[] }; first: boolean } | null> {
  const server = await fetchData(getToken);
  if (!wanted()) return null;
  const first = !server.tasks.length && !server.projects.length;
  start(getToken, server, error);
  return { data: first ? structuredClone(local) : server, first };
}

/** True when the server has something the board has not seen (another device, or the API). */
export function differs(server: { tasks: Task[]; projects: Project[] }): boolean {
  const now = { tasks: toMap(server.tasks), projects: toMap(server.projects) };
  return KINDS.some((k) => now[k].size !== base[k].size || [...now[k]].some(([id, data]) => base[k].get(id) !== data));
}

/** Back to the guest ledger in localStorage. Sends what is left first, if it can. */
export async function stop(): Promise<void> {
  clearTimeout(timer);
  if (pending()) await flush().catch(() => {});
  setRemote(null);
  setRemoteOn = false;
  token = null;
  latest.tasks = latest.projects = null;
}

/** True while some change has not reached the server. */
export function pending(): boolean {
  return KINDS.some((k) => latest[k] !== null);
}

function queue(kind: Kind, items: { id: string }[]): void {
  latest[kind] = toMap(items);
  if (!retryMs) schedule(400);
}

function schedule(ms: number): void {
  clearTimeout(timer);
  timer = window.setTimeout(() => { void flush().catch(() => {}); }, ms);
}

function diff(kind: Kind, now: Map<string, string>) {
  const upsert: unknown[] = [];
  for (const [id, data] of now) if (base[kind].get(id) !== data) upsert.push(JSON.parse(data));
  const remove = [...base[kind].keys()].filter((id) => !now.has(id));
  return { upsert, remove };
}

/** Send what changed since the server last confirmed. One request at a time. */
export async function flush(keepalive = false): Promise<void> {
  // one request at a time: wait for the one on its way, then send what is still left
  while (sending) await sending.catch(() => {});
  const snap: Partial<Record<Kind, Map<string, string>>> = {};
  for (const k of KINDS) if (latest[k]) snap[k] = latest[k]!;
  if (!Object.keys(snap).length) return;
  const body = { upsert: { tasks: [] as unknown[], projects: [] as unknown[] }, remove: { tasks: [] as string[], projects: [] as string[] } };
  for (const k of KINDS) {
    if (!snap[k]) continue;
    const d = diff(k, snap[k]!);
    body.upsert[k] = d.upsert;
    body.remove[k] = d.remove;
  }
  // nothing really changed: the board saved the same lists again
  if (KINDS.every((k) => !body.upsert[k].length && !body.remove[k].length)) {
    for (const k of KINDS) if (latest[k] === snap[k]) latest[k] = null;
    return;
  }
  sending = (async () => {
    try {
      await call("/api/sync", { method: "POST", body: JSON.stringify(body), keepalive });
      for (const k of KINDS) {
        if (!snap[k]) continue;
        base[k] = snap[k]!;
        // newer saves made while this was on its way stay queued
        if (latest[k] === snap[k]) latest[k] = null;
      }
      failed = false;
      retryMs = 0;
      if (pending()) schedule(400);
    } catch (e) {
      console.warn("[tomoshibi] could not reach the ledger:", e);
      if (!failed) onError?.();
      failed = true;
      retryMs = Math.min(retryMs ? retryMs * 2 : 2000, 30_000);
      schedule(retryMs);
      throw e;
    } finally {
      sending = null;
    }
  })();
  return sending;
}

// leaving the page: try once more to send what is left
addEventListener("pagehide", () => { if (setRemoteOn && pending()) void flush(true).catch(() => {}); });
