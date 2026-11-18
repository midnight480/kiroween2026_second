import { t } from "./i18n";

/** Where the task is in the work. Overdue is not a status: it is derived from `due` (see `isOverdue`). */
export type Status = "todo" | "doing" | "done";
export const STATUSES: Status[] = ["todo", "doing", "done"];

export interface Task {
  id: string;
  title: string;
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

export interface Member {
  id: string;
  name: string;
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
  return {
    id: String(x.id),
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
    return Array.isArray(v) ? v.filter((m) => m && typeof m.id === "string" && typeof m.name === "string") : [];
  } catch {
    return [];
  }
}

export function saveMembers(m: Member[]): void {
  try { localStorage.setItem(MEMBERS_KEY, JSON.stringify(m)); } catch { onSaveFail?.(); }
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
