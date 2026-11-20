import "./style.css";
import * as audio from "./audio";
import {
  load, save, loadStats, saveStats, newMember, touchMe, MAX_MEMBERS, loadInfo, setSaveFailHandler,
  loadProjects, saveProjects, newProject, projectName, getCurrentProject, setCurrentProject, ensureProjects, PROJECTS_STORAGE_KEY, type Project, type FieldDef,
  formatLeft, truePct, visualPct, isOverdue, STATUSES, type Task, type Status, type Member, type Stats,
} from "./store";
import { playCurse } from "./curse";
import { startPresence, fire, type PresenceHooks } from "./presence";
import { t, setLang, applyI18n, detectLang, formatDue, type Lang, type Key } from "./i18n";
import { initDialog, openNew, openEdit, isOpen as isTaskDialogOpen, MAX_MS } from "./dialog";
import { initProjectDialog, openNewProject, openProjectSettings, isProjectDialogOpen } from "./projectDialog";
import { describe, icon } from "./links";
import { initAuth, refreshAuth, allowAuth, authUser, onAuthChange, sessionToken } from "./auth";
import { initConsent, refreshConsent } from "./consent";
import * as ledger from "./sync";

const isOpen = () => isTaskDialogOpen() || isProjectDialogOpen() || menuOpen();

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
/** Open tasks (to do + in progress) the room can hold. */
const MAX_OPEN = 60;
/** Finished tasks kept in the Done column. Older ones are dropped. */
const MAX_DONE = 200;
const COL_KEY: Record<Status, Key> = { todo: "colTodo", doing: "colDoing", done: "colDone" };

let tasks: Task[] = load();
let stats: Stats = loadStats();
let projects: Project[] = loadProjects();
let currentId = "";
const cur = () => projects.find((p) => p.id === currentId) ?? projects[0];
const inCur = (x: Task) => x.projectId === currentId;
let cursing = false;
let dragging = false;
const els = new Map<string, HTMLElement>();
const lists = new Map<Status, HTMLElement>(
  STATUSES.map((s) => [s, document.querySelector<HTMLElement>(`.col[data-status="${s}"] .list`)!]));

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
  try {
    localStorage.setItem("tomoshibi.settings", JSON.stringify({
      safe: isSafe(), mute: muteBox.checked, lang: langSel.value, theme: themeSel.value,
    }));
  } catch { /* settings are not worth an error message */ }
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
  if (undo) $("undo-text").textContent = t(undo.key);
  void refreshAuth();
  refreshConsent();
  // render, not only refresh: the project name (default names follow the language) and the menu
  render();
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
themeSel.addEventListener("change", () => { applyAtmosphere(); saveSettings(); void refreshAuth(); });
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
const gateUp = () => !!document.getElementById("gate");

/* ---------- cursor light ---------- */
addEventListener("pointermove", (e) => {
  document.documentElement.style.setProperty("--mx", `${e.clientX}px`);
  document.documentElement.style.setProperty("--my", `${e.clientY}px`);
});

/* ---------- messages ---------- */
const errBox = document.createElement("div");
errBox.className = "err";
errBox.setAttribute("role", "alert");
errBox.hidden = true;
document.body.appendChild(errBox);
let errTimer = 0;
function notify(key: Key, ms = 3200) {
  errBox.textContent = t(key);
  errBox.hidden = false;
  clearTimeout(errTimer);
  errTimer = window.setTimeout(() => { errBox.hidden = true; }, ms);
}
setSaveFailHandler(() => notify("errSave", 6000));
const announce = (s: string) => { $("live").textContent = s; };

/* ---------- saving ---------- */
function persist() {
  // keep the newest finished tasks only
  const done = tasks.filter((x) => x.status === "done").sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
  if (done.length > MAX_DONE) {
    const drop = new Set(done.slice(MAX_DONE).map((x) => x.id));
    tasks = tasks.filter((x) => !drop.has(x.id));
  }
  save(tasks);
  saveStats(stats);
  seen();
}

/** Record that "me" is here in the open project (at most once a minute). */
function seen(force = false) {
  if (touchMe(cur(), force)) saveProjects(projects);
}

/* ---------- undo: five seconds to take the last put-out or burn back ---------- */
interface Snapshot { tasks: Task[]; stats: Stats; hideTimer: number; key: Key }
let undo: Snapshot | null = null;
const undoBox = $("undo");
function hideUndo() {
  if (undo) clearTimeout(undo.hideTimer);
  undo = null;
  undoBox.hidden = true;
}
/** Call before a change that should be undoable. */
function snapshot(): Omit<Snapshot, "hideTimer" | "key"> {
  return { tasks: structuredClone(tasks), stats: { ...stats } };
}
function offerUndo(snap: Omit<Snapshot, "hideTimer" | "key">, key: Key) {
  hideUndo();
  undo = { ...snap, key, hideTimer: window.setTimeout(hideUndo, 5000) };
  $("undo-text").textContent = t(key);
  undoBox.hidden = false;
}
function undoLast() {
  if (!undo) return;
  tasks = undo.tasks;
  stats = undo.stats;
  hideUndo();
  // cards still burning are dropped, so they come back clean
  for (const [id, el] of els) if (el.classList.contains("burning")) { el.remove(); els.delete(id); }
  persist();
  audio.rustle(0.3);
  render();
}
$("undo-btn").addEventListener("click", undoLast);

/* ---------- state changes ---------- */
function setStatus(task: Task, to: Status) {
  if (task.status === to) return;
  const snap = snapshot();
  const now = Date.now();
  if (to === "done") {
    // Past the deadline it is an exorcism: done, and recorded as late.
    task.late = task.due <= now ? true : undefined;
    task.doneAt = now;
    stats.putOut++;
    if (task.late) stats.late++;
    audio.candleOut();
    offerUndo(snap, "undoPutOut");
  } else {
    if (task.status === "done") {
      stats.putOut = Math.max(0, stats.putOut - 1);
      if (task.late) stats.late = Math.max(0, stats.late - 1);
      task.doneAt = undefined;
      task.late = undefined;
    }
    audio.rustle(0.4);
  }
  task.status = to;
  task.updated = now;
  persist();
  render();
  announce(t("liveMoved", { col: t(COL_KEY[to]), title: task.title }));
}

function burnTask(el: HTMLElement, task: Task) {
  const snap = snapshot();
  tasks = tasks.filter((x) => x.id !== task.id);
  stats.burned++;
  persist();
  el.classList.add("burning");
  audio.burn();
  offerUndo(snap, "undoBurned");
  setTimeout(() => {
    if (!tasks.some((x) => x.id === task.id) && els.get(task.id) === el) { el.remove(); els.delete(task.id); render(); }
  }, 1600);
  render();
}

/** Re-light an extinguished candle from now, or lengthen a burning one. */
function extend(task: Task, min: number) {
  const now = Date.now();
  if (task.due <= now) {
    // A new candle: its length is measured again from now. The curse already played and does not come twice.
    task.created = now;
    task.due = now + min * 60_000;
    task.penalty = 0;
  } else {
    task.due = Math.min(task.due + min * 60_000, now + MAX_MS);
  }
  task.extended++;
  task.updated = now;
  persist();
  audio.rustle(0.3);
  render();
}

/* ---------- the dialog ---------- */
/** Add someone to a project's roster from the task form. Each project keeps its own roster. */
function addMember(name: string, projectId: string): Member | null {
  const p = projects.find((x) => x.id === projectId);
  if (!p) return null;
  const found = p.members.find((m) => m.name === name);
  if (found) return found;
  if (p.members.length >= MAX_MEMBERS) return null;
  const m = newMember(name);
  p.members.push(m);
  saveProjects(projects);
  return m;
}

initDialog({
  project: (task) => projects.find((p) => p.id === (task?.projectId ?? currentId)),
  projects: () => projects,
  members: (projectId) => projects.find((p) => p.id === projectId)?.members ?? [],
  addMember,
  onOpen: () => { /* hauntings wait while the user writes (see checkExpiry and hooks.cards) */ },
  onClose: () => {
    const focus = lastFocus;
    lastFocus = null;
    if (focus && document.contains(focus)) focus.focus();
  },
  onSubmit(input, task) {
    const now = Date.now();
    if (!task) {
      if (tasks.filter((x) => x.projectId === input.projectId && x.status !== "done").length >= MAX_OPEN) return "errLimit";
      const created: Task = {
        id: crypto.randomUUID(), projectId: input.projectId, fields: input.fields, links: input.links,
        title: input.title, note: input.note, assignee: input.assignee,
        created: now, due: input.due, status: input.status === "done" ? "todo" : input.status,
        extended: 0, cursed: false, penalty: 0, updated: now,
      };
      tasks.push(created);
      persist();
      audio.rustle(0.4);
      // a task lit for another project takes you there, so you see where it went
      if (created.projectId !== currentId) switchProject(created.projectId, false); else render();
      requestAnimationFrame(() => els.get(created.id)?.scrollIntoView({ block: "nearest" }));
      return null;
    }
    if (input.due !== task.due) {
      if (task.due <= now && input.due > now) {
        // re-lit from now, like adding wax
        task.created = now;
        task.penalty = 0;
      }
      task.due = input.due;
    }
    task.title = input.title;
    task.note = input.note;
    task.assignee = input.assignee;
    task.fields = input.fields;
    task.links = input.links;
    const moved = task.projectId !== input.projectId;
    task.projectId = input.projectId;
    task.updated = now;
    if (input.status !== task.status) setStatus(task, input.status);
    persist();
    render();
    if (moved) announce(t("liveMoved", { col: (() => { const p = projects.find((p) => p.id === task.projectId); return p ? projectName(p) : ""; })(), title: task.title }));
    return null;
  },
});
let lastFocus: HTMLElement | null = null;
function openDialog(task?: Task) {
  if (cursing) return;
  lastFocus = (document.activeElement as HTMLElement) ?? null;
  if (task) openEdit(task); else openNew();
}
$("new").addEventListener("click", () => openDialog());

/* ---------- projects: the menu in the header ---------- */
const projBtn = $("proj-btn");
const projMenu = $("proj-menu");
const menuOpen = () => !projMenu.hidden;

function switchProject(id: string, sound = true) {
  if (id === currentId || !projects.some((p) => p.id === id)) { render(); return; }
  hideUndo();
  currentId = id;
  setCurrentProject(id);
  if (sound) audio.rustle(0.5);
  render();
  announce(t("liveProject", { name: cur() ? projectName(cur()!) : "" }));
}

function buildMenu() {
  const now = Date.now();
  const item = (cls: string, html: string, attrs = "") => `<button type="button" class="${cls}" ${attrs}>${html}</button>`;
  projMenu.innerHTML =
    projects.map((p) => {
      const open = tasks.filter((x) => x.projectId === p.id && x.status !== "done").length;
      const late = tasks.filter((x) => x.projectId === p.id && isOverdue(x, now)).length;
      return item("mi proj-item", `<span class="dot" aria-hidden="true"></span><span class="pn">${esc(projectName(p))}</span>
        <span class="pc">${esc(t("projOpenCount", { n: open }))}${late ? ` · <b>${late} 遅</b>` : ""}</span>`,
        `role="menuitemradio" aria-checked="${p.id === currentId}" data-id="${esc(p.id)}"`);
    }).join("") +
    `<hr role="separator" />` +
    item("mi", esc(t("projNew")), `role="menuitem" data-act="new"`) +
    item("mi", esc(t("projSettings")), `role="menuitem" data-act="settings"`);
}

function openMenu() {
  if (cursing || isTaskDialogOpen() || isProjectDialogOpen()) return;
  buildMenu();
  projMenu.hidden = false;
  projBtn.setAttribute("aria-expanded", "true");
  (projMenu.querySelector<HTMLElement>('[aria-checked="true"]') ?? projMenu.querySelector<HTMLElement>(".mi"))?.focus();
  audio.rustle(0.25);
}
function closeMenu(focusBtn = true) {
  if (!menuOpen()) return;
  projMenu.hidden = true;
  projBtn.setAttribute("aria-expanded", "false");
  if (focusBtn) projBtn.focus();
}

projBtn.addEventListener("click", () => (menuOpen() ? closeMenu() : openMenu()));
projMenu.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>(".mi");
  if (!b) return;
  if (b.dataset.id) { closeMenu(); switchProject(b.dataset.id); }
  else if (b.dataset.act === "new") { closeMenu(false); lastFocus = projBtn; openNewProject(); }
  else if (b.dataset.act === "settings") { closeMenu(false); lastFocus = projBtn; openProjectSettings(cur(), projects.length > 1); }
});
projMenu.addEventListener("keydown", (e) => {
  const items = [...projMenu.querySelectorAll<HTMLElement>(".mi")];
  const i = items.indexOf(document.activeElement as HTMLElement);
  if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
  else if (e.key === "Home") { e.preventDefault(); items[0]?.focus(); }
  else if (e.key === "End") { e.preventDefault(); items[items.length - 1]?.focus(); }
  else if (e.key === "Escape") { e.preventDefault(); closeMenu(); }
  else if (e.key === "Tab") closeMenu(false);
});
document.addEventListener("pointerdown", (e) => {
  if (menuOpen() && !(e.target as HTMLElement).closest(".proj")) closeMenu(false);
});

initProjectDialog({
  onSave(name, fields, project) {
    if (project) {
      project.name = name;
      project.fields = fields;
      saveProjects(projects);
      render();
    } else {
      const p = newProject(name);
      p.fields = fields;
      projects.push(p);
      saveProjects(projects);
      switchProject(p.id);
    }
    return null;
  },
  onDelete(project) {
    if (projects.length < 2) return "errProjLast";
    if (tasks.some((x) => x.projectId === project.id && x.status !== "done")) return "errProjNotEmpty";
    // finished tasks go with the project
    tasks = tasks.filter((x) => x.projectId !== project.id);
    projects = projects.filter((p) => p.id !== project.id);
    saveProjects(projects);
    persist();
    switchProject(projects[0].id);
    announce(t("projDeleted", { name: projectName(project) }));
    return null;
  },
  onClose() {
    const focus = lastFocus;
    lastFocus = null;
    if (focus && document.contains(focus)) focus.focus();
  },
});

/* ---------- cards ---------- */
function esc(s: string) { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)); }

function createCard(task: Task): HTMLElement {
  const el = document.createElement("article");
  el.className = "card";
  el.dataset.id = task.id;
  el.tabIndex = 0;
  el.style.setProperty("--rot", `${(Math.random() * 2.4 - 1.2).toFixed(2)}deg`);
  el.innerHTML = `
    <div class="candle" aria-hidden="true"><div class="wax"><div class="wick"></div><div class="flame"></div></div></div>
    <div class="ofuda">
      <span class="stamp" aria-hidden="true"><b>遅</b><small></small></span>
      <h3></h3>
      <div class="who"></div>
      <div class="times"><span class="left"></span><span class="when"></span></div>
      <div class="song" aria-hidden="true"></div>
      <p class="note"></p>
      <dl class="cf"></dl>
      <div class="links"></div>
      <div class="acts">
        <button type="button" class="mv prev" aria-label=""><span aria-hidden="true">←</span></button>
        <button type="button" class="mv next" aria-label=""><span aria-hidden="true">→</span></button>
        <button type="button" class="act edit" data-i18n-title="actEditTitle"><span data-i18n="actEdit"></span></button>
        <button type="button" class="act extend" data-i18n-title="actWaxTitle"><span data-i18n="actWax"></span></button>
        <select class="wax-pick" hidden data-i18n-aria="actWaxTitle">
          <option value="" data-i18n="waxPick"></option>
          <option value="30" data-i18n="wax30"></option>
          <option value="120" data-i18n="wax120"></option>
          <option value="1440" data-i18n="wax1440"></option>
          <option value="4320" data-i18n="wax4320"></option>
        </select>
        <span class="sp"></span>
        <button type="button" class="act hold burn" data-i18n-title="actBurnTitle"><span data-i18n="actBurn"></span></button>
      </div>
      <div class="seal" role="button" tabindex="0"><span></span></div>
    </div>`;
  els.set(task.id, el);
  applyI18n(el);
  const find = () => tasks.find((x) => x.id === task.id);
  const step = (dir: -1 | 1) => {
    const cur = find();
    if (!cur) return;
    const to = STATUSES[STATUSES.indexOf(cur.status) + dir];
    if (to) setStatus(cur, to);
    requestAnimationFrame(() => el.focus());
  };
  el.querySelector(".mv.prev")!.addEventListener("click", () => step(-1));
  el.querySelector(".mv.next")!.addEventListener("click", () => step(1));
  el.querySelector(".act.edit")!.addEventListener("click", () => { const cur = find(); if (cur) openDialog(cur); });
  wireHold(el.querySelector<HTMLElement>(".seal")!, 900, () => { const cur = find(); if (cur) setStatus(cur, "done"); });
  wireHold(el.querySelector<HTMLElement>(".act.burn")!, 900, () => { const cur = find(); if (cur) burnTask(el, cur); });
  wireWax(el, find);
  wireDrag(el, find);
  el.addEventListener("keydown", (e) => {
    if (e.target !== el) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
    else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const sib = (e.key === "ArrowUp" ? el.previousElementSibling : el.nextElementSibling) as HTMLElement | null;
      sib?.classList.contains("card") && sib.focus();
    } else if (e.key === "Enter") { e.preventDefault(); const cur = find(); if (cur) openDialog(cur); }
  });
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
  btn.addEventListener("contextmenu", (e) => e.preventDefault());
  btn.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); e.stopPropagation(); start(); } });
  btn.addEventListener("keyup", stop);
  btn.addEventListener("blur", stop);
}

function wireWax(el: HTMLElement, find: () => Task | undefined) {
  const btn = el.querySelector<HTMLElement>(".act.extend")!;
  const pick = el.querySelector<HTMLSelectElement>(".wax-pick")!;
  const close = () => { pick.hidden = true; btn.hidden = false; pick.value = ""; };
  btn.addEventListener("click", () => {
    btn.hidden = true;
    pick.hidden = false;
    pick.focus();
    try { pick.showPicker?.(); } catch { /* not allowed on some browsers */ }
  });
  pick.addEventListener("change", () => {
    const min = Number(pick.value);
    const cur = find();
    close();
    if (min > 0 && cur) extend(cur, min);
  });
  pick.addEventListener("blur", close);
  pick.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); btn.focus(); } });
}

/* ---------- drag between columns ---------- */
const sortKey = (a: Task, b: Task) =>
  a.status === "done" ? (b.doneAt ?? 0) - (a.doneAt ?? 0) : a.due - b.due;

function wireDrag(el: HTMLElement, find: () => Task | undefined) {
  let sx = 0, sy = 0, ox = 0, oy = 0, active = false, armed = false;
  let ph: HTMLElement | null = null;
  let target: Status | null = null;
  let lastRustle = 0, lastX = 0, lastY = 0;

  const placeIn = (status: Status, task: Task) => {
    const list = lists.get(status)!;
    const hypo = { ...task, status };
    const others = tasks.filter((x) => x.status === status && x.id !== task.id);
    const idx = others.filter((o) => sortKey(o, hypo) <= 0).length;
    const before = others.sort(sortKey)[idx];
    const ref = before ? els.get(before.id) ?? null : null;
    if (ref && ref.parentElement === list) list.insertBefore(ph!, ref); else list.appendChild(ph!);
  };

  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || cursing) return;
    if ((e.target as HTMLElement).closest("button, select, .seal, a, input, textarea")) return;
    const r = el.getBoundingClientRect();
    sx = lastX = e.clientX; sy = lastY = e.clientY;
    ox = e.clientX - r.left; oy = e.clientY - r.top;
    armed = true;
    el.setPointerCapture(e.pointerId);
  });

  el.addEventListener("pointermove", (e) => {
    if (!armed) return;
    const task = find();
    if (!task) return;
    if (!active) {
      if (Math.hypot(e.clientX - sx, e.clientY - sy) < 6) return;
      active = dragging = true;
      const r = el.getBoundingClientRect();
      ph = document.createElement("div");
      ph.className = "placeholder";
      ph.style.height = `${r.height}px`;
      el.before(ph);
      el.style.width = `${r.width}px`;
      el.classList.add("drag");
      target = task.status;
      audio.rustle(0.3);
    }
    let x = e.clientX - ox, y = e.clientY - oy;
    // Rarely, something pulls the card out of your hand.
    if (Math.random() < 0.015) { x += (Math.random() - 0.5) * 36; y += (Math.random() - 0.5) * 24; }
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    const col = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>(".col");
    const s = (col?.dataset.status as Status | undefined) ?? target;
    document.querySelectorAll(".col.over").forEach((c) => c !== col && c.classList.remove("over"));
    col?.classList.add("over");
    if (s && s !== target) { target = s; placeIn(s, task); }
    // near the top or bottom of a column, it scrolls with you
    const list = col?.querySelector<HTMLElement>(".list");
    if (list) {
      const lr = list.getBoundingClientRect();
      if (e.clientY > lr.bottom - 36) list.scrollTop += 12;
      else if (e.clientY < lr.top + 36) list.scrollTop -= 12;
    }
    const now = performance.now();
    if (now - lastRustle > 110) {
      lastRustle = now;
      audio.rustle(Math.min(1, Math.hypot(e.clientX - lastX, e.clientY - lastY) / 40));
      // the other candles shiver, as if someone is standing close
      for (const [id, other] of els) {
        if (id !== task.id && Math.random() < 0.2) {
          other.classList.remove("uneasy"); void other.offsetWidth; other.classList.add("uneasy");
        }
      }
    }
    lastX = e.clientX; lastY = e.clientY;
  });

  const end = (drop: boolean) => {
    armed = false;
    if (!active) return;
    active = dragging = false;
    el.classList.remove("drag");
    el.style.left = el.style.top = el.style.width = "";
    document.querySelectorAll(".col.over").forEach((c) => c.classList.remove("over"));
    ph?.remove();
    ph = null;
    const task = find();
    if (drop && task && target && target !== task.status) setStatus(task, target);
    else render();
    el.focus({ preventScroll: true });
  };
  el.addEventListener("pointerup", () => end(true));
  el.addEventListener("pointercancel", () => end(false));
  el.addEventListener("lostpointercapture", () => end(true));
}

/* ---------- rendering ---------- */
function render() {
  if (dragging) return;
  const focused = document.activeElement as HTMLElement | null;
  const alive = new Set(tasks.filter(inCur).map((x) => x.id));
  for (const [id, el] of els) {
    if (!alive.has(id) && !el.classList.contains("burning")) { el.remove(); els.delete(id); }
  }
  for (const s of STATUSES) {
    const list = lists.get(s)!;
    const items = tasks.filter((x) => inCur(x) && x.status === s).sort(sortKey);
    items.forEach((task, i) => {
      const el = els.get(task.id) ?? createCard(task);
      // move only what is out of place, so focus and scroll stay put
      const at = [...list.children].filter((c) => !c.classList.contains("burning"))[i];
      if (at !== el) list.insertBefore(el, at ?? null);
    });
    list.closest(".col")!.classList.toggle("empty", items.length === 0);
    $(`n-${s}`).textContent = String(items.length);
  }
  if (focused && document.contains(focused) && document.activeElement !== focused) focused.focus({ preventScroll: true });
  $("proj-name").textContent = cur() ? projectName(cur()!) : "";
  if (menuOpen()) buildMenu();
  refresh();
}

/* ---------- what the card shows of the project's fields and the links ---------- */
const dateFmt = () => new Intl.DateTimeFormat(document.documentElement.lang === "ja" ? "ja-JP" : "en-US", { year: "numeric", month: "short", day: "numeric" });
function fieldsHtml(task: Task, defs: FieldDef[]): string {
  const v = task.fields ?? {};
  return defs.filter((f) => f.onCard && v[f.id] !== undefined && v[f.id] !== "").map((f) => {
    const val = v[f.id];
    if (f.type === "checkbox") return val === true ? `<div class="chk"><dt>✓</dt><dd>${esc(f.name)}</dd></div>` : "";
    let shown: string;
    if (f.type === "date" && typeof val === "string") {
      const d = new Date(`${val}T00:00`);
      shown = Number.isFinite(d.getTime()) ? esc(dateFmt().format(d)) : esc(val);
    } else if (f.type === "url" && typeof val === "string") {
      const info = describe(val);
      shown = `<a href="${esc(val)}" target="_blank" rel="noopener noreferrer">${esc(info.label)}</a>`;
    } else shown = esc(String(val));
    return `<div><dt>${esc(f.name)}</dt><dd>${shown}</dd></div>`;
  }).join("");
}
function linksHtml(task: Task): string {
  return (task.links ?? []).map((l) => {
    const info = describe(l.url);
    const label = t("linkOpen", { service: info.service, label: info.label });
    return `<a class="chip lk-${info.kind}" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" title="${esc(label)}" aria-label="${esc(label)}">${icon(info.kind)}<span>${esc(info.label)}</span></a>`;
  }).join("");
}

// The counting song stays Japanese in every language.
const SONG = ["ひとつ", "ふたつ", "みっつ", "よっつ", "いつつ", "むっつ", "ななつ", "やっつ", "ここのつ", "とお"];
function refresh() {
  const now = Date.now();
  $("empty").classList.toggle("hide", tasks.some(inCur));
  $("haunted").textContent = String(tasks.filter((x) => inCur(x) && x.cursed && isOverdue(x, now)).length);
  const defs = cur()?.fields ?? [];
  $("putout").textContent = String(stats.putOut);
  for (const task of tasks) {
    const el = els.get(task.id);
    if (!el) continue;
    const done = task.status === "done";
    const left = task.due - now;
    const out = !done && left <= 0;
    const vp = done ? 0.06 : visualPct(task, now); // what the candle looks like (hauntings shorten it)
    const tp = truePct(task, now);                 // what the clock says (never touched)
    el.querySelector<HTMLElement>(".wax")!.style.height = `${Math.max(6, vp * 100)}%`;
    el.classList.toggle("done", done);
    el.classList.toggle("low", !done && left > 0 && vp < 0.2);
    el.classList.toggle("urgent", !done && left > 0 && tp < 0.2);
    el.classList.toggle("out", out);
    el.setAttribute("aria-label", t("cardAria", { title: task.title }));
    el.querySelector("h3")!.textContent = task.title;
    // the seal stays 遅 in every language; English adds a small reading for those who cannot read it
    const stamp = el.querySelector<HTMLElement>(".stamp")!;
    stamp.querySelector("small")!.textContent = t("stampGloss");
    stamp.title = t("stampTitle");
    const m = task.assignee ? projects.find((p) => p.id === task.projectId)?.members.find((x) => x.id === task.assignee) : undefined;
    el.querySelector(".who")!.innerHTML = m ? `<span class="avatar" aria-hidden="true">${esc([...m.name][0] ?? "")}</span>${esc(m.name)}` : "";
    el.querySelector(".note")!.textContent = task.note ?? "";
    // only touch the DOM when something changed: links must stay clickable between ticks
    const cf = fieldsHtml(task, defs);
    const cfEl = el.querySelector<HTMLElement>(".cf")!;
    if (cfEl.dataset.v !== cf) { cfEl.innerHTML = cf; cfEl.dataset.v = cf; }
    const lk = linksHtml(task);
    const lkEl = el.querySelector<HTMLElement>(".links")!;
    if (lkEl.dataset.v !== lk) { lkEl.innerHTML = lk; lkEl.dataset.v = lk; }
    if (done) {
      el.querySelector(".left")!.textContent = t("doneAt", { when: formatDue(task.doneAt ?? now, now) });
      el.querySelector(".when")!.textContent = task.late ? t("doneLate") : "";
    } else {
      el.querySelector(".left")!.textContent = task.cursed && out ? t("tooLate") : formatLeft(left);
      el.querySelector(".when")!.textContent = t("dueAt", { when: formatDue(task.due, now) });
    }
    // count song for the final ten seconds
    el.querySelector(".song")!.textContent = !done && left > 0 && left <= 10_000 ? SONG[10 - Math.ceil(left / 1000)] ?? "" : "";
    const seal = el.querySelector<HTMLElement>(".seal")!;
    seal.querySelector("span")!.textContent = t(out ? "exorcise" : "seal");
    seal.setAttribute("aria-label", t(out ? "exorciseAria" : "sealAria"));
    const i = STATUSES.indexOf(task.status);
    const prev = el.querySelector<HTMLButtonElement>(".mv.prev")!;
    const next = el.querySelector<HTMLButtonElement>(".mv.next")!;
    prev.hidden = i === 0;
    next.hidden = i === STATUSES.length - 1;
    if (i > 0) { const l = t("moveTo", { col: t(COL_KEY[STATUSES[i - 1]]) }); prev.setAttribute("aria-label", l); prev.title = l; }
    if (i < 2) { const l = t("moveTo", { col: t(COL_KEY[STATUSES[i + 1]]) }); next.setAttribute("aria-label", l); next.title = l; }
  }
}

/** Hauntings eat the candle, never the deadline. */
function shortenCandle(task: Task, ratio: number) {
  const visualLeft = Math.max(0, task.due - Date.now() - task.penalty);
  task.penalty += visualLeft * ratio;
}

async function checkExpiry() {
  if (cursing || dragging || isOpen()) return;
  const now = Date.now();
  const task = tasks.find((x) => !x.cursed && isOverdue(x, now));
  if (!task) return;
  cursing = true;
  task.cursed = true;
  persist();
  refresh();
  announce(t("liveOut", { title: task.title }));
  await playCurse(task.title, isSafe());
  // The curse spreads: the open candle with the nearest deadline looks shorter. No explanation is given.
  const next = tasks.filter((x) => x.status !== "done" && x.due > Date.now()).sort((a, b) => a.due - b.due)[0];
  if (next) {
    shortenCandle(next, 0.25);
    persist();
    els.get(next.id)?.classList.add("uneasy");
    audio.whisper();
  }
  refresh();
  cursing = false;
}

/* ---------- presence ---------- */
const hooks: PresenceHooks = {
  urgency() {
    const now = Date.now();
    const live = tasks.filter((x) => x.status !== "done" && x.due > now);
    return live.length ? Math.min(...live.map((x) => visualPct(x, now))) : 1;
  },
  // nothing moves while the user is writing or dragging
  cards: () => (isOpen() || dragging ? [] : [...els.values()].filter((c) => !c.classList.contains("done"))),
  safe: isSafe,
  onNoticed() {
    // Rule broken ("do not look behind you"): a random candle looks a tenth shorter. The clock does not change.
    const now = Date.now();
    const live = tasks.filter((x) => inCur(x) && x.status !== "done" && x.due > now);
    if (!live.length) return;
    const task = live[Math.floor(Math.random() * live.length)];
    shortenCandle(task, 0.1);
    persist();
    els.get(task.id)?.classList.add("uneasy");
    refresh();
  },
};
startPresence(hooks);

/* ---------- keyboard shortcuts (listed on the help page) ---------- */
const typing = (e: KeyboardEvent) => {
  const el = e.target as HTMLElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || el.isContentEditable;
};
addEventListener("keydown", (e) => {
  if (gateUp() || isOpen() || cursing || typing(e) || e.altKey) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === "z") {
    if (undo) { e.preventDefault(); undoLast(); }
    return;
  }
  if (mod) return;
  if (e.key === "n" || e.key === "N" || e.key === "/") { e.preventDefault(); openDialog(); }
  else if (e.key === "?") { e.preventDefault(); location.href = "help.html"; }
  else if (e.key === "t" || e.key === "T") { e.preventDefault(); location.href = "members.html"; }
  else if (e.key === "p" || e.key === "P") { e.preventDefault(); openMenu(); }
  else if (e.key === "1" || e.key === "2" || e.key === "3") {
    // jump to the first card of a column
    const first = lists.get(STATUSES[Number(e.key) - 1])!.querySelector<HTMLElement>(".card");
    if (first) { e.preventDefault(); first.focus(); }
  }
});

/* ---------- signed in: the ledger lives on the server (src/sync.ts) ---------- */
/** Put a new set of tasks and projects on the board (signing in or out, another device's changes). */
function replaceData(next: { tasks: Task[]; projects: Project[] }) {
  hideUndo();
  for (const el of els.values()) el.remove();
  els.clear();
  tasks = next.tasks;
  projects = next.projects;
  if (ensureProjects(projects, tasks, t("projFirst"))) { saveProjects(projects); save(tasks); }
  if (!projects.some((p) => p.id === currentId)) currentId = projects.some((p) => p.id === getCurrentProject()) ? getCurrentProject()! : projects[0].id;
  setCurrentProject(currentId);
  render();
}
let ledgerUser: string | null = null;
async function followAuth() {
  const user = authUser()?.id ?? null;
  if (user === ledgerUser) return;
  ledgerUser = user;
  if (ledger.active()) await ledger.stop();
  if (!user) {
    // signed out: this device's guest ledger, as it was before signing in
    replaceData({ tasks: load(), projects: loadProjects() });
    return;
  }
  try {
    const got = await ledger.connect(sessionToken, { tasks, projects }, () => notify("errSync", 6000), () => ledgerUser === user);
    if (!got) return; // signed out or switched while loading
    const { data, first } = got;
    // First sign-in: this device's candles move to the server. The guest copy stays in localStorage.
    replaceData(data);
    if (first) { save(tasks); saveProjects(projects); }
    announce(t(first && tasks.length ? "syncMoved" : "syncOn"));
  } catch (e) {
    console.warn("[tomoshibi] could not load the ledger:", e);
    ledgerUser = null; // try again on the next sign-in change or when the tab comes back
    notify("errSyncLoad", 8000);
  }
}
/** Coming back to the tab: pick up changes made on another device (only when nothing is waiting to be sent). */
async function pullLedger() {
  if (!ledger.active() || ledger.pending() || dragging || cursing) return;
  try {
    const server = await ledger.fetchData(sessionToken);
    if (!ledger.active() || ledger.pending() || dragging || cursing || isOpen() || holding()) return;
    if (!ledger.differs(server)) return; // nothing new: leave the board (and what is under the pointer) alone
    ledger.start(sessionToken, server, () => notify("errSync", 6000));
    replaceData(server);
  } catch { /* offline: keep what is on the board */ }
}
onAuthChange(() => { void followAuth(); });
/** A seal or a burn is being held down: never redraw the card under the finger. */
const holding = () => !!document.querySelector(".peeling");
// Tasks added through the API (or on another device) show up within a minute while the tab is open.
setInterval(() => { if (!document.hidden) void pullLedger(); }, 60_000);

/* ---------- the brand: back to the top ---------- */
// On the other pages it is a plain link to the board. Here we are already on the board, and a
// reload would bring back the gate, so it closes what is open and returns to the top instead.
$("brand").addEventListener("click", (e) => {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // new tab / window: let the link work
  e.preventDefault();
  if (gateUp() || cursing) return;
  closeMenu(false);
  scrollTo({ top: 0, behavior: isSafe() ? "auto" : "smooth" });
  $("board").scrollTo?.({ left: 0, top: 0 });
  $("new").focus();
});

/* ---------- boot ---------- */
setLang(langSel.value as Lang);
if (ensureProjects(projects, tasks, t("projFirst"))) { saveProjects(projects); save(tasks); }
currentId = projects.some((p) => p.id === getCurrentProject()) ? getCurrentProject()! : projects[0].id;
setCurrentProject(currentId);
render();
changeLang(langSel.value as Lang);
if (loadInfo.recovered) notify("errBroken", 9000);
// sign-in is optional and loads in the background; the board never waits for it
void initAuth($("auth"));
initConsent(allowAuth);
setInterval(() => { refresh(); void checkExpiry(); }, 1000);
// a tab coming back from sleep checks the deadlines at once
document.addEventListener("visibilitychange", () => { if (!document.hidden) { seen(); refresh(); void checkExpiry(); void pullLedger(); } });
seen(true);
// the team page, in another tab, renamed or removed someone
addEventListener("storage", (e) => {
  // rosters live in the projects, so a change on the team page arrives here too
  if (e.key === PROJECTS_STORAGE_KEY && !ledger.active()) {
    projects = loadProjects();
    if (ensureProjects(projects, tasks, t("projFirst"))) saveProjects(projects);
    if (!projects.some((p) => p.id === currentId)) currentId = projects[0].id;
    render();
  }
});

if (new URLSearchParams(location.search).has("debug")) {
  (window as unknown as Record<string, unknown>).__t = {
    fire: (i?: number) => fire(hooks, i),
    curse: () => playCurse("Debug task", isSafe()),
  };
}
