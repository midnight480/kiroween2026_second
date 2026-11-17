import "./style.css";
import * as audio from "./audio";
import { load, save, loadStats, saveStats, loadInfo, setSaveFailHandler, formatLeft, truePct, visualPct, type Task } from "./store";
import { playCurse } from "./curse";
import { startPresence, fire, type PresenceHooks } from "./presence";
import { t, setLang, applyI18n, detectLang, formatDue, type Lang, type Key } from "./i18n";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const CARD_W = 168;
/** Estimated card height. Real heights are measured where it matters. */
const CARD_H = 350;
/** Room above the first row: the flame stands 40px above the candle and the board clips what leaves it. */
const TOP_PAD = 56;
const MAX_TASKS = 60;
const MIN_MS = 60_000;
const MAX_MS = 365 * 86_400_000;
let tasks: Task[] = load();
const stats = loadStats();
let cursing = false;
let dragging = false;
const els = new Map<string, HTMLElement>();
const board = $("board");

/* ---------- jack-o'-lantern (the only Western element, used as UI chrome) ---------- */
const PUMPKIN = `<svg viewBox="0 0 64 56" aria-hidden="true">
  <path d="M30 6 Q32 0 38 2 L36 9Z" fill="#3b5a1e"/>
  <ellipse cx="32" cy="32" rx="28" ry="22" fill="#e8730c"/>
  <ellipse cx="20" cy="32" rx="12" ry="21" fill="#f0861c" opacity=".7"/>
  <ellipse cx="44" cy="32" rx="12" ry="21" fill="#d1620a" opacity=".7"/>
  <path d="M17 26 L27 26 L22 17Z M37 26 L47 26 L42 17Z" fill="#2a1200"/>
  <path d="M16 38 L22 43 L27 39 L32 45 L37 39 L42 43 L48 38 L44 49 Q32 54 20 49Z" fill="#2a1200"/>
  <path d="M17 26 L27 26 L22 17Z M37 26 L47 26 L42 17Z M16 38 L22 43 L27 39 L32 45 L37 39 L42 43 L48 38 L44 49 Q32 54 20 49Z" fill="#ffc457" opacity=".9"/>
</svg>`;
document.querySelectorAll(".pumpkin-btn, .pumpkin-mini").forEach((e) => (e.innerHTML = PUMPKIN));

/* ---------- settings: safe mode, mute, theme, language ---------- */
type ThemeSetting = "system" | "light" | "dark";
const safeBox = $<HTMLInputElement>("safe");
const muteBox = $<HTMLInputElement>("mute");
const safeGate = $<HTMLInputElement>("safe-gate");
const themeSel = $<HTMLSelectElement>("theme");
const langSel = $<HTMLSelectElement>("lang");
const isSafe = () => safeBox.checked;
const mqLight = matchMedia("(prefers-color-scheme: light)");

function saveSettings() {
  localStorage.setItem("tomoshibi.settings", JSON.stringify({
    safe: isSafe(), mute: muteBox.checked, lang: langSel.value, theme: themeSel.value,
  }));
}
function applySettings() {
  document.body.classList.toggle("safe", isSafe());
  audio.setMuted(muteBox.checked);
  saveSettings();
}

/* ---------- atmosphere: light/dark is the base, the hour is only a tint on top ---------- */
function resolveTheme(): "light" | "dark" {
  const v = themeSel.value as ThemeSetting;
  return v === "system" ? (mqLight.matches ? "light" : "dark") : v;
}
function applyAtmosphere() {
  const theme = resolveTheme();
  const root = document.documentElement;
  root.dataset.theme = theme;
  const h = new Date().getHours();
  const dusk = h === 17 || h === 18; // 逢魔が時
  const night = h >= 19 || h < 5;
  if (theme === "light") {
    root.style.setProperty("--veil", dusk ? "rgba(120,50,10,.16)" : night ? "rgba(15,20,45,.2)" : "rgba(0,0,0,0)");
  } else if (dusk) {
    root.style.setProperty("--dark-mid", "rgba(40,8,0,.38)");
    root.style.setProperty("--dark-edge", "rgba(30,6,0,.66)");
  } else if (night) {
    root.style.setProperty("--dark-mid", "rgba(0,0,0,.45)");
    root.style.setProperty("--dark-edge", "rgba(0,0,0,.74)");
  } else { // day: the room is dim but you can see
    root.style.setProperty("--dark-mid", "rgba(0,0,0,.3)");
    root.style.setProperty("--dark-edge", "rgba(0,0,0,.58)");
  }
}

function changeLang(l: Lang) {
  langSel.value = l;
  setLang(l);
  document.querySelectorAll<HTMLElement>(".gate-lang button").forEach((b) => b.classList.toggle("on", b.dataset.lang === l));
  refresh();
  saveSettings();
}

try {
  const s = JSON.parse(localStorage.getItem("tomoshibi.settings") ?? "{}");
  safeBox.checked = !!s.safe;
  muteBox.checked = !!s.mute;
  safeGate.checked = !!s.safe;
  if (s.theme === "light" || s.theme === "dark" || s.theme === "system") themeSel.value = s.theme;
  langSel.value = s.lang === "ja" || s.lang === "en" ? s.lang : detectLang();
} catch { langSel.value = detectLang(); }
safeBox.addEventListener("change", () => { safeGate.checked = safeBox.checked; applySettings(); });
muteBox.addEventListener("change", applySettings);
safeGate.addEventListener("change", () => { safeBox.checked = safeGate.checked; applySettings(); });
themeSel.addEventListener("change", () => { applyAtmosphere(); saveSettings(); });
langSel.addEventListener("change", () => changeLang(langSel.value as Lang));
document.querySelectorAll<HTMLElement>(".gate-lang button").forEach((b) =>
  b.addEventListener("click", () => changeLang(b.dataset.lang as Lang)));
mqLight.addEventListener("change", applyAtmosphere);
applySettings();
if (matchMedia("(prefers-reduced-motion: reduce)").matches) { safeBox.checked = true; applySettings(); }
applyAtmosphere();
setInterval(applyAtmosphere, 60_000);

/* ---------- gate ---------- */
$("enter").addEventListener("click", () => {
  audio.initAudio();
  applySettings();
  $("gate").classList.add("leaving");
  setTimeout(() => $("gate").remove(), 1700);
});

/* ---------- cursor light ---------- */
addEventListener("pointermove", (e) => {
  document.documentElement.style.setProperty("--mx", `${e.clientX}px`);
  document.documentElement.style.setProperty("--my", `${e.clientY}px`);
});

/* ---------- add form + salt (error state) ---------- */
const form = $<HTMLFormElement>("add");
const titleIn = $<HTMLInputElement>("title");
const burn = $<HTMLSelectElement>("burn");
const dueIn = $<HTMLInputElement>("due");
const pumpkinBtn = form.querySelector<HTMLElement>(".pumpkin-btn")!;
const saltWrap = document.createElement("div");
saltWrap.className = "salt-wrap";
saltWrap.innerHTML = `<div class="salt"></div>`;
form.insertBefore(saltWrap, pumpkinBtn);
const errBox = document.createElement("div");
errBox.className = "err";
errBox.setAttribute("role", "alert");
errBox.hidden = true;
document.body.appendChild(errBox);
let errTimer = 0;
/** Show a message. With `salt`, the salt mound crumbles too (input errors only). */
function notify(key: Key, salt = false, ms = 3200) {
  if (salt) {
    saltWrap.classList.remove("fall");
    void saltWrap.offsetWidth;
    saltWrap.classList.add("fall");
    audio.rustle(0.5);
  }
  errBox.textContent = t(key);
  errBox.hidden = false;
  clearTimeout(errTimer);
  errTimer = window.setTimeout(() => { errBox.hidden = true; saltWrap.classList.remove("fall"); }, ms);
}
const saltError = (key: Key) => notify(key, true);
setSaveFailHandler(() => notify("errSave", false, 6000));
burn.addEventListener("change", () => {
  dueIn.hidden = burn.value !== "custom";
  if (!dueIn.hidden) {
    const d = new Date(Date.now() + 3600_000);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    dueIn.value = d.toISOString().slice(0, 16);
  }
});
titleIn.addEventListener("input", () => pumpkinBtn.classList.toggle("ready", titleIn.value.trim().length > 0));

/** First free place on the board, row by row. Cards never start on top of each other. */
function findSlot(): { x: number; y: number } {
  const stepX = CARD_W + 24;
  const cols = Math.max(1, Math.floor((board.clientWidth - 24) / stepX));
  const taken = tasks.map((o) => ({ x: o.x, y: o.y, h: els.get(o.id)?.offsetHeight ?? CARD_H }));
  for (let r = 0; r < 500; r++) {
    for (let c = 0; c < cols; c++) {
      const x = 24 + c * stepX;
      const y = TOP_PAD + r * (CARD_H + 12);
      const clash = taken.some((o) => Math.abs(o.x - x) < CARD_W + 8 && o.y < y + CARD_H && y < o.y + o.h + 8);
      if (!clash) return { x: x + Math.random() * 8, y: y + Math.random() * 8 };
    }
  }
  return { x: 24, y: TOP_PAD };
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = titleIn.value.trim();
  if (!title) return saltError("errTitle");
  if (tasks.length >= MAX_TASKS) return notify("errLimit", true);
  let due: number;
  if (burn.value === "custom") {
    due = new Date(dueIn.value).getTime();
    if (!Number.isFinite(due) || due < Date.now() + MIN_MS) return saltError("errPast");
    if (due > Date.now() + MAX_MS) return saltError("errFar");
  } else {
    due = Date.now() + Number(burn.value) * 60_000;
  }
  const { x, y } = findSlot();
  const task: Task = { id: crypto.randomUUID(), title, created: Date.now(), due, x, y, cursed: false, penalty: 0 };
  tasks.push(task);
  save(tasks);
  titleIn.value = "";
  pumpkinBtn.classList.remove("ready");
  audio.rustle(0.4);
  const el = createCard(task);
  refresh();
  el.scrollIntoView({ block: "nearest" });
  titleIn.focus(); // keep adding
});

/* ---------- cards ---------- */
function esc(s: string) { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)); }

function createCard(task: Task): HTMLElement {
  const el = document.createElement("div");
  el.className = "card";
  el.dataset.id = task.id;
  el.tabIndex = 0;
  el.setAttribute("role", "group");
  const x = Math.max(0, Math.min(Math.max(0, board.clientWidth - CARD_W), task.x));
  el.style.left = `${x}px`;
  el.style.top = `${Math.max(TOP_PAD - 12, task.y)}px`;
  el.style.setProperty("--rot", `${(Math.random() * 6 - 3).toFixed(1)}deg`);
  el.innerHTML = `
    <div class="candle"><div class="wax"><div class="wick"></div><div class="flame"></div></div></div>
    <div class="ofuda">
      <h3>${esc(task.title)}</h3>
      <div class="left"></div>
      <div class="when"></div>
      <div class="song" aria-hidden="true"></div>
      <div class="acts">
        <button type="button" class="act rewrite" data-i18n-title="actRewriteTitle"><span data-i18n="actRewrite"></span></button>
        <button type="button" class="act extend" data-i18n-title="actWaxTitle"><span data-i18n="actWax"></span></button>
        <select class="wax-pick" hidden data-i18n-aria="actWaxTitle">
          <option value="" data-i18n="waxPick"></option>
          <option value="30" data-i18n="wax30"></option>
          <option value="120" data-i18n="wax120"></option>
          <option value="1440" data-i18n="wax1440"></option>
          <option value="4320" data-i18n="wax4320"></option>
        </select>
        <button type="button" class="act hold burn" data-i18n-title="actBurnTitle"><span data-i18n="actBurn"></span></button>
      </div>
      <div class="seal" role="button" tabindex="0"><span></span></div>
    </div>`;
  board.appendChild(el);
  els.set(task.id, el);
  applyI18n(el);
  wireDrag(el, task);
  wireKeys(el, task);
  wireSeal(el, task);
  wireBurn(el, task);
  wireRewrite(el, task);
  wireWax(el, task);
  return el;
}

/** Press and hold. Used where a mistake would cost something (finish, burn). */
function wireHold(btn: HTMLElement, ms: number, onDone: () => void) {
  let timer = 0;
  const start = () => {
    if (timer) return;
    btn.classList.add("peeling");
    audio.rustle(0.3);
    timer = window.setTimeout(() => { timer = 0; btn.classList.remove("peeling"); onDone(); }, ms);
  };
  const stop = () => { clearTimeout(timer); timer = 0; btn.classList.remove("peeling"); };
  btn.addEventListener("pointerdown", (e) => { e.stopPropagation(); start(); });
  btn.addEventListener("pointerup", stop);
  btn.addEventListener("pointerleave", stop);
  btn.addEventListener("pointercancel", stop);
  btn.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); start(); } });
  btn.addEventListener("keyup", stop);
  btn.addEventListener("blur", stop);
}

/* ---------- undo: five seconds to put a candle back ---------- */
type UndoKind = "done" | "late" | "burn";
interface UndoEntry { task: Task; kind: UndoKind; removeTimer: number; hideTimer: number }
let undo: UndoEntry | null = null;
const undoBox = $("undo");

function hideUndo() {
  if (undo) { clearTimeout(undo.hideTimer); undo = null; }
  undoBox.hidden = true;
}

function undoLast() {
  if (!undo) return;
  const u = undo;
  clearTimeout(u.removeTimer);
  hideUndo();
  if (u.kind === "burn") stats.burned--;
  else { stats.putOut--; if (u.kind === "late") stats.late--; }
  saveStats(stats);
  tasks.push(u.task);
  save(tasks);
  els.get(u.task.id)?.remove();
  els.delete(u.task.id);
  createCard(u.task);
  audio.rustle(0.3);
  refresh();
}

/** The task leaves the list at once (data first, animation follows) and can be put back for 5 seconds. */
function removeTask(el: HTMLElement, task: Task, ms: number, kind: UndoKind) {
  hideUndo();
  tasks = tasks.filter((x) => x.id !== task.id);
  save(tasks);
  saveStats(stats);
  const removeTimer = window.setTimeout(() => { el.remove(); els.delete(task.id); refresh(); }, ms);
  const hideTimer = window.setTimeout(hideUndo, 5000);
  undo = { task, kind, removeTimer, hideTimer };
  $("undo-text").textContent = t(kind === "burn" ? "undoBurned" : "undoPutOut");
  undoBox.hidden = false;
  refresh();
}
$("undo-btn").addEventListener("click", undoLast);

/** Finish: peel the seal, the candle is put out by hand. */
function wireSeal(el: HTMLElement, task: Task) {
  wireHold(el.querySelector<HTMLElement>(".seal")!, 900, () => {
    el.classList.add("leaving");
    audio.candleOut();
    // Past the deadline it is an exorcism: the task is finished late, and it is recorded as late.
    const late = task.due <= Date.now();
    stats.putOut++;
    if (late) stats.late++;
    removeTask(el, task, 1500, late ? "late" : "done");
  });
}

/** Delete: the card is burned. Not counted as finished. */
function wireBurn(el: HTMLElement, task: Task) {
  wireHold(el.querySelector<HTMLElement>(".act.burn")!, 900, () => {
    el.classList.add("burning");
    audio.burn();
    stats.burned++;
    removeTask(el, task, 1600, "burn");
  });
}

/** Edit: the title is rewritten on the same paper. */
function wireRewrite(el: HTMLElement, task: Task) {
  el.querySelector<HTMLElement>(".act.rewrite")!.addEventListener("click", () => {
    const h3 = el.querySelector<HTMLElement>("h3")!;
    if (el.classList.contains("editing")) return;
    el.classList.add("editing");
    const input = document.createElement("input");
    input.className = "rewrite-in";
    input.maxLength = 40;
    input.value = task.title;
    input.setAttribute("aria-label", t("actRewriteTitle"));
    h3.hidden = true;
    h3.after(input);
    input.focus();
    input.select();
    let done = false;
    const close = (commit: boolean) => {
      if (done) return;
      done = true;
      const v = input.value.trim();
      if (commit && !v) saltError("errTitle");
      else if (commit && v !== task.title) {
        task.title = v;
        h3.textContent = v;
        save(tasks);
        audio.rustle(0.3);
      }
      input.remove();
      h3.hidden = false;
      el.classList.remove("editing");
    };
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") close(true);
      else if (e.key === "Escape") close(false);
    });
    input.addEventListener("blur", () => close(true));
  });
}

/** Extend: wax is added and the deadline moves with it. */
function wireWax(el: HTMLElement, task: Task) {
  const btn = el.querySelector<HTMLElement>(".act.extend")!;
  const pick = el.querySelector<HTMLSelectElement>(".wax-pick")!;
  const close = () => { pick.hidden = true; btn.hidden = false; pick.value = ""; };
  btn.addEventListener("click", () => {
    btn.hidden = true;
    pick.hidden = false;
    pick.focus();
    try { pick.showPicker?.(); } catch { /* not allowed without a gesture on some browsers */ }
  });
  pick.addEventListener("change", () => {
    const min = Number(pick.value);
    if (min > 0) {
      const now = Date.now();
      if (task.due <= now) {
        // An extinguished candle is lit again from now. The curse already played and does not play twice.
        task.created = now;
        task.due = now + min * 60_000;
        task.penalty = 0;
      } else {
        task.due = Math.min(task.due + min * 60_000, now + MAX_MS);
      }
      save(tasks);
      audio.rustle(0.3);
      refresh();
    }
    close();
  });
  pick.addEventListener("blur", close);
}

function boardPoint(e: PointerEvent) {
  const r = board.getBoundingClientRect();
  return { x: e.clientX - r.left + board.scrollLeft, y: e.clientY - r.top + board.scrollTop };
}

function wireDrag(el: HTMLElement, task: Task) {
  let ox = 0, oy = 0, lastRustle = 0, lastX = 0, lastY = 0;
  el.addEventListener("pointerdown", (e) => {
    if ((e.target as HTMLElement).closest(".seal, .act, .rewrite-in, .wax-pick")) return;
    dragging = true;
    el.setPointerCapture(e.pointerId);
    el.classList.add("drag");
    el.classList.remove("slide");
    const p = boardPoint(e);
    ox = p.x - el.offsetLeft;
    oy = p.y - el.offsetTop;
    lastX = e.clientX; lastY = e.clientY;
    audio.rustle(0.3);
  });
  el.addEventListener("pointermove", (e) => {
    if (!el.classList.contains("drag")) return;
    const p = boardPoint(e);
    let x = p.x - ox;
    let y = p.y - oy;
    // Rarely, something pulls the card out of your hand.
    if (Math.random() < 0.015) { x += (Math.random() - 0.5) * 36; y += (Math.random() - 0.5) * 24; }
    x = Math.max(0, Math.min(board.clientWidth - CARD_W, x));
    y = Math.max(TOP_PAD - 12, y);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    // near the edge, the board scrolls with you
    const r = board.getBoundingClientRect();
    if (e.clientY > r.bottom - 40) board.scrollTop += 14;
    else if (e.clientY < r.top + 40) board.scrollTop -= 14;
    const speed = Math.hypot(e.clientX - lastX, e.clientY - lastY);
    lastX = e.clientX; lastY = e.clientY;
    const now = performance.now();
    if (now - lastRustle > 110) {
      lastRustle = now;
      audio.rustle(Math.min(1, speed / 40));
      // the other candles shiver, as if someone is standing close
      for (const [id, other] of els) {
        if (id !== task.id && Math.random() < 0.25) {
          other.classList.remove("uneasy"); void other.offsetWidth; other.classList.add("uneasy");
        }
      }
    }
  });
  const end = () => {
    if (!el.classList.contains("drag")) return;
    el.classList.remove("drag");
    dragging = false;
    task.x = el.offsetLeft; task.y = el.offsetTop;
    save(tasks);
    // sometimes it does not stay where you put it
    if (Math.random() < 0.25) {
      setTimeout(() => {
        if (!els.has(task.id) || el.classList.contains("drag")) return;
        el.classList.add("slide");
        task.x = Math.max(0, Math.min(board.clientWidth - CARD_W, task.x + (Math.random() - 0.5) * 30));
        task.y = Math.max(TOP_PAD - 12, task.y + (Math.random() - 0.5) * 20);
        el.style.left = `${task.x}px`; el.style.top = `${task.y}px`;
        audio.rustle(0.4);
        save(tasks);
      }, 700);
    }
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
}

/** Keyboard: focus a card, move it with the arrow keys (Shift for bigger steps). */
function wireKeys(el: HTMLElement, task: Task) {
  let saveTimer = 0;
  el.addEventListener("keydown", (e) => {
    if (e.target !== el) return;
    const step = e.shiftKey ? 56 : 16;
    const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const m = d[e.key];
    if (!m) return;
    e.preventDefault();
    task.x = Math.max(0, Math.min(board.clientWidth - CARD_W, el.offsetLeft + m[0]));
    task.y = Math.max(TOP_PAD - 12, el.offsetTop + m[1]);
    el.classList.remove("slide");
    el.style.left = `${task.x}px`;
    el.style.top = `${task.y}px`;
    el.scrollIntoView({ block: "nearest" });
    audio.rustle(0.15);
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => save(tasks), 300);
  });
}

/* ---------- ticking ---------- */
// The counting song stays Japanese in every language.
const SONG = ["ひとつ", "ふたつ", "みっつ", "よっつ", "いつつ", "むっつ", "ななつ", "やっつ", "ここのつ", "とお"];
function refresh() {
  const now = Date.now();
  $("empty").classList.toggle("hide", tasks.length > 0);
  $("haunted").textContent = String(tasks.filter((x) => x.cursed && x.due <= now).length);
  $("putout").textContent = String(stats.putOut);
  for (const task of tasks) {
    const el = els.get(task.id);
    if (!el) continue;
    const left = task.due - now;
    const vp = visualPct(task, now); // what the candle looks like (hauntings shorten it)
    const tp = truePct(task, now);   // what the clock says (never touched)
    const wax = el.querySelector<HTMLElement>(".wax")!;
    wax.style.height = `${Math.max(6, vp * 100)}%`;
    el.classList.toggle("low", left > 0 && vp < 0.2);
    el.classList.toggle("urgent", left > 0 && tp < 0.2);
    el.classList.toggle("out", left <= 0);
    el.setAttribute("aria-label", t("cardAria", { title: task.title }));
    el.querySelector(".left")!.textContent = task.cursed && left <= 0 ? t("tooLate") : formatLeft(left);
    el.querySelector(".when")!.textContent = t("dueAt", { when: formatDue(task.due, now) });
    // count song for the final ten seconds
    el.querySelector(".song")!.textContent = left > 0 && left <= 10_000 ? SONG[10 - Math.ceil(left / 1000)] ?? "" : "";
    const seal = el.querySelector<HTMLElement>(".seal")!;
    const late = left <= 0;
    seal.querySelector("span")!.textContent = t(late ? "exorcise" : "seal");
    seal.setAttribute("aria-label", t(late ? "exorciseAria" : "sealAria"));
  }
}

/** Hauntings eat the candle, never the deadline. */
function shortenCandle(task: Task, ratio: number) {
  const now = Date.now();
  const visualLeft = Math.max(0, task.due - now - (task.penalty ?? 0));
  task.penalty = (task.penalty ?? 0) + visualLeft * ratio;
}

async function checkExpiry() {
  if (cursing || dragging) return;
  const task = tasks.find((x) => !x.cursed && x.due <= Date.now());
  if (!task) return;
  cursing = true;
  task.cursed = true;
  save(tasks);
  refresh();
  $("live").textContent = t("liveOut", { title: task.title });
  await playCurse(task.title, isSafe());
  // The curse spreads: the nearest living candle looks shorter. No explanation is given.
  const el = els.get(task.id);
  if (el) {
    let best: Task | null = null, bd = Infinity;
    for (const o of tasks) {
      if (o.due <= Date.now() || o.id === task.id) continue;
      const oe = els.get(o.id);
      if (!oe) continue;
      const d = Math.hypot(oe.offsetLeft - el.offsetLeft, oe.offsetTop - el.offsetTop);
      if (d < bd) { bd = d; best = o; }
    }
    if (best) {
      shortenCandle(best, 0.25);
      save(tasks);
      els.get(best.id)?.classList.add("uneasy");
      audio.whisper();
    }
  }
  refresh();
  cursing = false;
}

/* ---------- presence ---------- */
const hooks: PresenceHooks = {
  urgency() {
    const now = Date.now();
    const live = tasks.filter((x) => x.due > now);
    return live.length ? Math.min(...live.map((x) => visualPct(x, now))) : 1;
  },
  cards: () => [...els.values()].filter((c) => !c.classList.contains("editing")),
  safe: isSafe,
  onNoticed() {
    // Rule broken ("do not look behind you"): a random candle looks a tenth shorter. The clock does not change.
    const now = Date.now();
    const live = tasks.filter((x) => x.due > now);
    if (!live.length) return;
    const task = live[Math.floor(Math.random() * live.length)];
    shortenCandle(task, 0.1);
    save(tasks);
    els.get(task.id)?.classList.add("uneasy");
    refresh();
  },
};
startPresence(hooks);

/* ---------- keyboard shortcuts ---------- */
const typing = (e: KeyboardEvent) => {
  const el = e.target as HTMLElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || el.isContentEditable;
};
addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !typing(e)) {
    if (undo) { e.preventDefault(); undoLast(); }
  } else if ((e.key === "n" || e.key === "/") && !e.ctrlKey && !e.metaKey && !e.altKey && !typing(e)) {
    e.preventDefault();
    titleIn.focus();
  }
});

/* ---------- boot ---------- */
setLang(langSel.value as Lang);
for (const task of tasks) createCard(task);
changeLang(langSel.value as Lang);
if (loadInfo.recovered) notify("errBroken", false, 9000);
setInterval(() => { refresh(); void checkExpiry(); }, 1000);

if (new URLSearchParams(location.search).has("debug")) {
  (window as unknown as Record<string, unknown>).__t = {
    fire: (i?: number) => fire(hooks, i),
    curse: () => playCurse("Debug task", isSafe()),
  };
}
