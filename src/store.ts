import { t } from "./i18n";

export interface Task {
  id: string;
  title: string;
  created: number;
  /** The real deadline (ms). Only the user changes this. */
  due: number;
  x: number;
  y: number;
  cursed: boolean;
  /**
   * Time (ms) the candle looks shorter than it really is.
   * Hauntings eat the candle, never the deadline: the text always shows the true time.
   */
  penalty?: number;
}

export interface Stats {
  /** Candles the user put out by hand (finished or exorcised). */
  putOut: number;
  /** Of those, how many were put out after the deadline (exorcised). */
  late: number;
  /** Cards burned away without finishing. */
  burned: number;
}

const KEY = "tomoshibi.tasks.v1";
const STATS_KEY = "tomoshibi.stats";

/** Set when the saved data could not be read. The original text is kept under `tomoshibi.tasks.broken.<time>`. */
export const loadInfo = { recovered: false };
let onSaveFail: (() => void) | null = null;
export function setSaveFailHandler(fn: () => void): void { onSaveFail = fn; }

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function backUp(raw: string): void {
  loadInfo.recovered = true;
  try { localStorage.setItem(`tomoshibi.tasks.broken.${Date.now()}`, raw); } catch { /* storage is full: nothing more to do */ }
}

export function load(): Task[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { return []; }
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) throw new Error("not an array");
    const ok = v.filter((x): x is Task =>
      !!x && typeof x.id === "string" && typeof x.title === "string" && isNum(x.created) && isNum(x.due))
      .map((x) => ({
        ...x,
        x: isNum(x.x) ? x.x : 24,
        y: isNum(x.y) ? x.y : 16,
        cursed: !!x.cursed,
        penalty: isNum(x.penalty) ? x.penalty : 0,
      }));
    if (ok.length !== v.length) backUp(raw); // some entries were unreadable: keep the original
    return ok;
  } catch {
    // Never overwrite what we could not read: keep a copy first, then start empty.
    backUp(raw);
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

/** True remaining life of the candle (0..1), from the real deadline. */
export function truePct(task: Task, now: number): number {
  return clamp01((task.due - now) / (task.due - task.created));
}

/** How long the candle looks (0..1). The hauntings shorten this, not the deadline. */
export function visualPct(task: Task, now: number): number {
  return clamp01((task.due - now - (task.penalty ?? 0)) / (task.due - task.created));
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
