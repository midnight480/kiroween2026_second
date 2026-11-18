import { t } from "./i18n";
import { cleanUrl } from "./links";

/** Where the task is in the work. Overdue is not a status: it is derived from `due` (see `isOverdue`). */
export type Status = "todo" | "doing" | "done";
export const STATUSES: Status[] = ["todo", "doing", "done"];
export const MEMBERS_STORAGE_KEY = "tomoshibi.members";

/* ---------- projects ---------- */
export type FieldType = "text" | "number" | "select" | "date" | "checkbox" | "url";
export const FIELD_TYPES: FieldType[] = ["text", "number", "select", "date", "checkbox", "url"];
export type FieldValue = string | number | boolean;

/** A field the project adds to every one of its tasks. */
export interface FieldDef {
  id: string;
  name: string;
  type: FieldType;
  /** Choices, for `select`. */
  options?: string[];
  /** Show the value on the card, not only in the form. */
  onCard: boolean;
}

export interface Project {
  id: string;
  name: string;
  created: number;
  fields: FieldDef[];
}

export interface Link {
  id: string;
  url: string;
}

export const MAX_LINKS = 10;

export interface Task {
  id: string;
  /** The project the task belongs to. */
  projectId: string;
  title: string;
  /** Values of the project's own fields, by field id. */
  fields?: Record<string, FieldValue>;
  /** Reference links: GitHub, Google Docs / Slides / Sheets, Word / PowerPoint / Excel, anything. */
  links?: Link[];
  /** Free text, 0..500 characters. */
  note?: string;
  /** Id of a `Member`. Later this becomes an account id. */
  assignee?: string;
  created: number;
  /** The real deadline (ms). Only the user changes this. */
  due: number;
  status: Status;
  doneAt?: number;
  /** Put out after the deadline. */
  late?: boolean;
  /** How many times wax was added. */
  extended: number;
  /** The curse has played for this task (once per task). */
  cursed: boolean;
  /**
   * Time (ms) the candle looks shorter than it really is.
   * Hauntings eat the candle, never the deadline: the text always shows the true time.
   */
  penalty: number;
  updated: number;
}

/** Shown and set now. Enforced once sign-in exists (see docs/team.md). */
export type Role = "owner" | "admin" | "member" | "viewer";
export const ROLES: Role[] = ["owner", "admin", "member", "viewer"];

export interface Member {
  id: string;
  name: string;
  role: Role;
  created: number;
  /**
   * Last time this member used the app. Without sign-in this is only known for the member
   * marked as "me" on this device. With sign-in it will come from each account.
   */
  lastSeen?: number;
}

export interface Stats {
  /** Candles put out by hand (done, including late). */
  putOut: number;
  /** Of those, how many were put out after the deadline (exorcised). */
  late: number;
  /** Cards burned away without finishing. */
  burned: number;
}

const KEY = "tomoshibi.tasks.v2";
const KEY_V1 = "tomoshibi.tasks.v1"; // kept after migration, so nothing is lost
const STATS_KEY = "tomoshibi.stats";
const MEMBERS_KEY = "tomoshibi.members";

/** Set when the saved data could not be read. The original text is kept under `tomoshibi.tasks.broken.<time>`. */
export const loadInfo = { recovered: false };
let onSaveFail: (() => void) | null = null;
export function setSaveFailHandler(fn: () => void): void { onSaveFail = fn; }

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function backUp(raw: string): void {
  loadInfo.recovered = true;
  try { localStorage.setItem(`tomoshibi.tasks.broken.${Date.now()}`, raw); } catch { /* storage is full: nothing more to do */ }
}

function normalize(x: Record<string, unknown>, now: number): Task {
  const status: Status = x.status === "doing" || x.status === "done" ? x.status : "todo";
  const fields: Record<string, FieldValue> = {};
  if (x.fields && typeof x.fields === "object") {
    for (const [k, v] of Object.entries(x.fields as Record<string, unknown>)) {
      if (typeof v === "string" || typeof v === "boolean" || isNum(v)) fields[k] = v;
    }
  }
  const links: Link[] = Array.isArray(x.links)
    ? (x.links as unknown[]).flatMap((l) => {
      const o = l as Partial<Link> | null;
      const url = o && typeof o.url === "string" ? cleanUrl(o.url) : null;
      return url ? [{ id: typeof o!.id === "string" ? o!.id : crypto.randomUUID(), url }] : [];
    }).slice(0, MAX_LINKS)
    : [];
  return {
    id: String(x.id),
    projectId: typeof x.projectId === "string" ? x.projectId : "",
    fields: Object.keys(fields).length ? fields : undefined,
    links: links.length ? links : undefined,
    title: String(x.title),
    note: typeof x.note === "string" && x.note ? x.note : undefined,
    assignee: typeof x.assignee === "string" && x.assignee ? x.assignee : undefined,
    created: x.created as number,
    due: x.due as number,
    status,
    doneAt: isNum(x.doneAt) ? x.doneAt : undefined,
    late: x.late === true ? true : undefined,
    extended: isNum(x.extended) ? x.extended : 0,
    cursed: !!x.cursed,
    penalty: isNum(x.penalty) ? x.penalty : 0,
    updated: isNum(x.updated) ? x.updated : now,
  };
}

const valid = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && typeof (x as Task).id === "string" && typeof (x as Task).title === "string"
  && isNum((x as Task).created) && isNum((x as Task).due);

function parse(raw: string): Task[] {
  const v: unknown = JSON.parse(raw);
  if (!Array.isArray(v)) throw new Error("not an array");
  const now = Date.now();
  const ok = v.filter(valid).map((x) => normalize(x, now));
  if (ok.length !== v.length) backUp(raw); // some entries were unreadable: keep the original
  return ok;
}

export function load(): Task[] {
  let raw: string | null = null;
  let v1: string | null = null;
  try { raw = localStorage.getItem(KEY); v1 = localStorage.getItem(KEY_V1); } catch { return []; }
  try {
    if (raw) return parse(raw);
    if (v1) {
      // First run after the board change: v1 tasks all start in "To do". The v1 key is left in place.
      const tasks = parse(v1);
      save(tasks);
      return tasks;
    }
    return [];
  } catch {
    // Never overwrite what we could not read: keep a copy first, then start empty.
    backUp((raw ?? v1) as string);
    return [];
  }
}

export function save(tasks: Task[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(tasks)); } catch { onSaveFail?.(); }
}

export function loadStats(): Stats {
  try {
    const s = JSON.parse(localStorage.getItem(STATS_KEY) ?? "{}");
    return { putOut: Number(s.putOut) || 0, late: Number(s.late) || 0, burned: Number(s.burned) || 0 };
  } catch {
    return { putOut: 0, late: 0, burned: 0 };
  }
}

export function saveStats(s: Stats): void {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch { onSaveFail?.(); }
}

export function loadMembers(): Member[] {
  try {
    const v = JSON.parse(localStorage.getItem(MEMBERS_KEY) ?? "[]");
    if (!Array.isArray(v)) return [];
    const now = Date.now();
    return v.filter((m) => m && typeof m.id === "string" && typeof m.name === "string").map((m) => ({
      id: m.id,
      name: m.name,
      role: ROLES.includes(m.role) ? m.role : "member",
      created: isNum(m.created) ? m.created : now,
      lastSeen: isNum(m.lastSeen) ? m.lastSeen : undefined,
    }));
  } catch {
    return [];
  }
}

export function newMember(name: string, role: Role = "member"): Member {
  return { id: crypto.randomUUID(), name, role, created: Date.now() };
}

/* ---------- "me": which member uses this device ---------- */
const ME_KEY = "tomoshibi.me";
export function getMe(): string | null {
  try { return localStorage.getItem(ME_KEY); } catch { return null; }
}
export function setMe(id: string | null): void {
  try { if (id) localStorage.setItem(ME_KEY, id); else localStorage.removeItem(ME_KEY); } catch { onSaveFail?.(); }
}

const SEEN_EVERY = 60_000;
/**
 * Record that "me" is here. Written at most once a minute. Reads the stored list fresh,
 * so it never overwrites changes made in another tab.
 */
export function touchMe(force = false): void {
  const me = getMe();
  if (!me) return;
  const list = loadMembers();
  const m = list.find((x) => x.id === me);
  if (!m) return;
  const now = Date.now();
  if (!force && m.lastSeen && now - m.lastSeen < SEEN_EVERY) return;
  m.lastSeen = now;
  saveMembers(list);
}

export function saveMembers(m: Member[]): void {
  try { localStorage.setItem(MEMBERS_KEY, JSON.stringify(m)); } catch { onSaveFail?.(); }
}

const PROJECTS_KEY = "tomoshibi.projects";
const CURRENT_KEY = "tomoshibi.project";
export const PROJECTS_STORAGE_KEY = PROJECTS_KEY;

function normalizeField(f: Record<string, unknown>): FieldDef | null {
  if (typeof f.id !== "string" || typeof f.name !== "string" || !FIELD_TYPES.includes(f.type as FieldType)) return null;
  const options = Array.isArray(f.options) ? f.options.filter((o): o is string => typeof o === "string" && !!o.trim()) : undefined;
  return { id: f.id, name: f.name, type: f.type as FieldType, options: f.type === "select" ? options ?? [] : undefined, onCard: !!f.onCard };
}

export function loadProjects(): Project[] {
  try {
    const v = JSON.parse(localStorage.getItem(PROJECTS_KEY) ?? "[]");
    if (!Array.isArray(v)) return [];
    return v.filter((p) => p && typeof p.id === "string" && typeof p.name === "string").map((p) => ({
      id: p.id,
      name: p.name,
      created: isNum(p.created) ? p.created : Date.now(),
      fields: Array.isArray(p.fields) ? p.fields.map(normalizeField).filter((f: FieldDef | null): f is FieldDef => !!f) : [],
    }));
  } catch {
    return [];
  }
}

export function saveProjects(p: Project[]): void {
  try { localStorage.setItem(PROJECTS_KEY, JSON.stringify(p)); } catch { onSaveFail?.(); }
}

export function newProject(name: string): Project {
  return { id: crypto.randomUUID(), name, created: Date.now(), fields: [] };
}

export function getCurrentProject(): string | null {
  try { return localStorage.getItem(CURRENT_KEY); } catch { return null; }
}
export function setCurrentProject(id: string): void {
  try { localStorage.setItem(CURRENT_KEY, id); } catch { onSaveFail?.(); }
}

/**
 * There is always at least one project. Tasks saved before projects existed (or whose project
 * is gone) are put in the first one. Returns true when something had to be written.
 */
export function ensureProjects(projects: Project[], tasks: Task[], firstName: string): boolean {
  let changed = false;
  if (!projects.length) { projects.push(newProject(firstName)); changed = true; }
  const ids = new Set(projects.map((p) => p.id));
  for (const task of tasks) {
    if (!ids.has(task.projectId)) { task.projectId = projects[0].id; changed = true; }
  }
  return changed;
}

/** Overdue = still open and past the real deadline. */
export function isOverdue(task: Task, now: number): boolean {
  return task.status !== "done" && task.due <= now;
}

/** True remaining life of the candle (0..1), from the real deadline. */
export function truePct(task: Task, now: number): number {
  return clamp01((task.due - now) / (task.due - task.created));
}

/** How long the candle looks (0..1). The hauntings shorten this, not the deadline. */
export function visualPct(task: Task, now: number): number {
  return clamp01((task.due - now - task.penalty) / (task.due - task.created));
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function formatLeft(ms: number): string {
  if (ms <= 0) return t("extinguished");
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return t("fmtDH", { d, h });
  if (h > 0) return t("fmtHM", { h, m });
  if (m > 0) return t("fmtMS", { m, s: s % 60 });
  return t("fmtS", { s });
}
