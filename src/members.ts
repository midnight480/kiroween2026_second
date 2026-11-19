import "./style.css";
import { t, applyI18n, formatAgo, formatDue, getLang, type Key } from "./i18n";
import { initPage } from "./page";
import {
  load, save, loadProjects, saveProjects, ensureProjects, getCurrentProject, setCurrentProject, projectName,
  newMember, getMe, setMe, touchMe, isOverdue, setSaveFailHandler,
  ROLES, MAX_MEMBERS, PROJECTS_STORAGE_KEY, type Member, type Project, type Role, type Task,
} from "./store";
import { authUser, onAuthChange, sessionToken } from "./auth";
import * as ledger from "./sync";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const ROLE_KEY: Record<Role, Key> = { owner: "roleOwner", admin: "roleAdmin", member: "roleMember", viewer: "roleViewer" };
const ROLE_DESC: Record<Role, Key> = { owner: "roleOwnerDesc", admin: "roleAdminDesc", member: "roleMemberDesc", viewer: "roleViewerDesc" };
/** Not seen for this long, the row fades: someone who has drifted away from the house. */
const GONE_MS = 7 * 86_400_000;

// Each project has its own roster (Project.members). Signed in, projects come from the server
// (src/sync.ts) exactly as on the board; as a guest, from localStorage.
let tasks: Task[] = load();
let projects: Project[] = loadProjects();
let currentId = "";
const cur = (): Project => projects.find((p) => p.id === currentId) ?? projects[0];
const roster = (): Member[] => cur()?.members ?? [];
const projSel = $<HTMLSelectElement>("m-project");
const body = $("team-body");
const errBox = $("m-err");
const saltWrap = document.querySelector<HTMLElement>("#member-form .salt-wrap")!;

function esc(s: string) { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)); }
const announce = (s: string) => { $("live").textContent = s; };

function showError(key: Key) {
  errBox.textContent = t(key);
  errBox.hidden = false;
  saltWrap.classList.remove("fall");
  void saltWrap.offsetWidth;
  saltWrap.classList.add("fall");
}
function clearError() { errBox.hidden = true; saltWrap.classList.remove("fall"); }
setSaveFailHandler(() => { errBox.textContent = t("errSave"); errBox.hidden = false; });

/** Put a set of tasks and projects on the page (load, sign in or out, another tab or device). */
function useData(next: { tasks: Task[]; projects: Project[] }) {
  tasks = next.tasks;
  projects = next.projects;
  if (ensureProjects(projects, tasks, t("projFirst"))) { saveProjects(projects); save(tasks); }
  if (!projects.some((p) => p.id === currentId)) {
    currentId = projects.some((p) => p.id === getCurrentProject()) ? getCurrentProject()! : projects[0].id;
  }
  renderProjects();
  render();
}

/** As a guest, re-read the stored projects first, so another tab's edits are not lost. */
function fresh() {
  if (ledger.active()) return;
  projects = loadProjects();
  ensureProjects(projects, tasks, t("projFirst"));
}

/** Change one member of the open project and save the project. */
function update(id: string, fn: (m: Member) => void) {
  fresh();
  const m = roster().find((x) => x.id === id);
  if (!m) return;
  fn(m);
  saveProjects(projects);
}

function renderProjects() {
  projSel.innerHTML = projects.map((p) => `<option value="${esc(p.id)}">${esc(projectName(p))}</option>`).join("");
  projSel.value = cur()?.id ?? "";
  $("m-project-wrap").hidden = projects.length < 2;
}

function roleOptions(selected: Role) {
  return ROLES.map((r) => `<option value="${r}"${r === selected ? " selected" : ""}>${esc(t(ROLE_KEY[r]))}</option>`).join("");
}

function loadText(m: Member, now: number) {
  const mine = tasks.filter((x) => x.projectId === currentId && x.assignee === m.id && x.status !== "done");
  if (!mine.length) return t("loadNone");
  const late = mine.filter((x) => isOverdue(x, now)).length;
  return late ? `${t("loadOpen", { n: mine.length })} · <span class="late">${esc(t("loadOverdue", { n: late }))}</span>` : esc(t("loadOpen", { n: mine.length }));
}

function seenCell(m: Member, now: number) {
  if (!m.lastSeen) return `<span class="dim">${esc(t("seenNever"))}</span>`;
  const days = Math.floor((now - m.lastSeen) / 86_400_000);
  const gone = now - m.lastSeen > GONE_MS ? `<small class="gone">${esc(t("notSeen", { n: days }))}</small>` : "";
  return `<time datetime="${new Date(m.lastSeen).toISOString()}" title="${esc(formatDue(m.lastSeen, now))}">${esc(formatAgo(m.lastSeen, now))}</time>${gone}`;
}

const order = (a: Member, b: Member) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.name.localeCompare(b.name, getLang());

function render() {
  const now = Date.now();
  const me = getMe(cur());
  const members = roster();
  body.innerHTML = "";
  for (const m of [...members].sort(order)) {
    const tr = document.createElement("tr");
    tr.dataset.id = m.id;
    tr.classList.toggle("me", m.id === me);
    tr.classList.toggle("faded", !!m.lastSeen && now - m.lastSeen > GONE_MS);
    tr.innerHTML = `
      <td><div class="who-cell"><span class="avatar" aria-hidden="true">${esc([...m.name][0] ?? "")}</span>
        <input class="nm" type="text" maxlength="30" value="${esc(m.name)}" aria-label="${esc(t("renameAria", { name: m.name }))}" />
        ${m.id === me ? `<span class="badge">${esc(t("you"))}</span>` : ""}</div></td>
      <td><select class="rl" aria-label="${esc(t("roleAria", { name: m.name }))}">${roleOptions(m.role)}</select></td>
      <td class="load">${loadText(m, now)}</td>
      <td class="seen">${seenCell(m, now)}</td>
      <td class="acts-cell">
        ${m.id === me ? "" : `<button type="button" class="ghost me-btn" title="${esc(t("isMeTitle"))}">${esc(t("isMe"))}</button>`}
        <button type="button" class="ghost hold rm" title="${esc(t("removeMemberTitle"))}"><span>${esc(t("removeMember"))}</span></button>
      </td>`;
    wireRow(tr, m.id);
    body.appendChild(tr);
  }
  $("team-empty").hidden = members.length > 0;
  $("team-count").textContent = t("teamCount", { n: members.length });
}

function wireRow(tr: HTMLElement, id: string) {
  const nm = tr.querySelector<HTMLInputElement>(".nm")!;
  const commitName = () => {
    const v = nm.value.trim();
    const mem = roster().find((x) => x.id === id);
    if (!mem) return;
    if (!v) { nm.value = mem.name; return showError("errMember"); }
    if (roster().some((x) => x.id !== id && x.name === v)) { nm.value = mem.name; return showError("errMemberDup"); }
    clearError();
    if (v !== mem.name) { update(id, (m) => { m.name = v; }); render(); }
  };
  nm.addEventListener("change", commitName);
  nm.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); nm.blur(); }
    else if (e.key === "Escape") { nm.value = roster().find((x) => x.id === id)?.name ?? nm.value; nm.blur(); }
  });
  tr.querySelector<HTMLSelectElement>(".rl")!.addEventListener("change", (e) => {
    const role = (e.target as HTMLSelectElement).value as Role;
    update(id, (m) => { m.role = role; });
    render();
    body.querySelector<HTMLSelectElement>(`tr[data-id="${id}"] .rl`)?.focus();
  });
  tr.querySelector(".me-btn")?.addEventListener("click", () => {
    fresh();
    setMe(cur().id, id);
    if (touchMe(cur(), true)) saveProjects(projects);
    render();
  });
  wireHold(tr.querySelector<HTMLElement>(".rm")!, 900, () => {
    fresh();
    const p = cur();
    const name = p.members.find((x) => x.id === id)?.name ?? "";
    if (getMe(p) === id) setMe(p.id, null);
    p.members = p.members.filter((x) => x.id !== id);
    saveProjects(projects);
    // their candles stay on the board; the board shows them with nobody assigned
    render();
    announce(t("memberRemoved", { name }));
  });
}

/** Press and hold, as on the board, so a slip of the hand removes nobody. */
function wireHold(btn: HTMLElement, ms: number, onDone: () => void) {
  let timer = 0;
  const start = () => { if (timer) return; btn.classList.add("peeling"); timer = window.setTimeout(() => { timer = 0; btn.classList.remove("peeling"); onDone(); }, ms); };
  const stop = () => { clearTimeout(timer); timer = 0; btn.classList.remove("peeling"); };
  btn.addEventListener("pointerdown", start);
  btn.addEventListener("pointerup", stop);
  btn.addEventListener("pointerleave", stop);
  btn.addEventListener("pointercancel", stop);
  btn.addEventListener("contextmenu", (e) => e.preventDefault());
  btn.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); start(); } });
  btn.addEventListener("keyup", stop);
  btn.addEventListener("blur", stop);
}

function renderRoles() {
  $("roles").innerHTML = ROLES.map((r) => `<dt>${esc(t(ROLE_KEY[r]))}</dt><dd>${esc(t(ROLE_DESC[r]))}</dd>`).join("");
  const sel = $<HTMLSelectElement>("m-role");
  const v = (sel.value as Role) || "member";
  sel.innerHTML = roleOptions(v);
}

$("member-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $<HTMLInputElement>("m-name");
  const name = input.value.trim();
  if (!name) return showError("errMember");
  fresh();
  const p = cur();
  if (p.members.some((x) => x.name === name)) return showError("errMemberDup");
  if (p.members.length >= MAX_MEMBERS) return showError("errMemberFull");
  clearError();
  p.members.push(newMember(name, $<HTMLSelectElement>("m-role").value as Role));
  saveProjects(projects);
  input.value = "";
  render();
  input.focus();
});

initPage(() => {
  applyI18n();
  document.title = getLang() === "ja" ? "名簿 — 灯 Tomoshibi" : "Team — Tomoshibi 灯";
  renderRoles();
  renderProjects();
  render();
});
projSel.addEventListener("change", () => {
  currentId = projSel.value;
  setCurrentProject(currentId); // the board opens the same project next time
  clearError();
  seen();
  render();
  announce(t("liveProject", { name: projectName(cur()) }));
});

/** Record that "me" is here in the open project (at most once a minute). */
function seen(force = false) {
  if (touchMe(cur(), force)) { saveProjects(projects); render(); }
}

/* ---------- signed in: the same ledger on the server as the board ---------- */
let ledgerUser: string | null = null;
async function followAuth() {
  const user = authUser()?.id ?? null;
  if (user === ledgerUser) return;
  ledgerUser = user;
  if (ledger.active()) await ledger.stop();
  if (!user) { useData({ tasks: load(), projects: loadProjects() }); return; }
  try {
    const got = await ledger.connect(sessionToken, { tasks, projects }, () => { errBox.textContent = t("errSync"); errBox.hidden = false; }, () => ledgerUser === user);
    if (!got) return;
    useData(got.data);
    // first sign-in: this device's guest ledger moves up, the same as from the board
    if (got.first) { save(tasks); saveProjects(projects); }
    seen();
  } catch (e) {
    console.warn("[tomoshibi] could not load the ledger:", e);
    ledgerUser = null;
    errBox.textContent = t("errSyncLoad");
    errBox.hidden = false;
  }
}
onAuthChange(() => { void followAuth(); });
async function pull() {
  if (!ledger.active() || ledger.pending() || document.activeElement?.closest("#team-body, #member-form")) return;
  try {
    const server = await ledger.fetchData(sessionToken);
    if (!ledger.active() || ledger.pending() || !ledger.differs(server)) return;
    ledger.start(sessionToken, server, () => { errBox.textContent = t("errSync"); errBox.hidden = false; });
    useData(server);
  } catch { /* offline: keep what is shown */ }
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) { seen(); void pull(); } });

useData({ tasks, projects });
seen(true);

// the clock moves on; so do the other tabs
setInterval(() => {
  const now = Date.now();
  for (const tr of body.querySelectorAll<HTMLElement>("tr")) {
    const m = roster().find((x) => x.id === tr.dataset.id);
    if (m) tr.querySelector(".seen")!.innerHTML = seenCell(m, now);
  }
}, 30_000);
addEventListener("storage", (e) => {
  if (ledger.active()) { if (e.key === "tomoshibi.me.v2") render(); return; }
  if (e.key === PROJECTS_STORAGE_KEY) { fresh(); renderProjects(); render(); }
  else if (e.key === "tomoshibi.me.v2") render();
  else if (e.key === "tomoshibi.tasks.v2") { tasks = load(); render(); }
});
addEventListener("keydown", (e) => {
  const tgt = e.target as HTMLElement;
  if (tgt instanceof HTMLInputElement || tgt instanceof HTMLSelectElement || tgt instanceof HTMLTextAreaElement) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === "Escape" || e.key === "b" || e.key === "B") location.href = "./";
  else if (e.key === "n" || e.key === "N") { e.preventDefault(); $("m-name").focus(); }
  else if (e.key === "?") location.href = "help.html";
});
