import * as audio from "./audio";
import { t, formatDue, type Key } from "./i18n";
import { formatLeft, MAX_LINKS, projectName, type FieldDef, type FieldValue, type Link, type Member, type Project, type Status, type Task } from "./store";
import { cleanUrl, describe, icon } from "./links";

export const MIN_MS = 60_000;
export const MAX_MS = 365 * 86_400_000;

/** What the dialog hands back. The caller decides how to create or update a task. */
export interface TaskInput {
  title: string;
  due: number;
  assignee?: string;
  note?: string;
  status: Status;
  projectId: string;
  fields?: Record<string, FieldValue>;
  links?: Link[];
}

interface Ctx {
  /** The project the new task goes into (or the edited task's project). */
  project(task?: Task): Project | undefined;
  projects(): Project[];
  members(): Member[];
  addMember(name: string): Member;
  /** Return an error key to keep the dialog open, or null when the task was saved. */
  onSubmit(input: TaskInput, task?: Task): Key | null;
  onOpen(): void;
  onClose(): void;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const dlg = $<HTMLDialogElement>("task-dialog");
const form = $<HTMLFormElement>("task-form");
const fTitle = $<HTMLInputElement>("f-title");
const fDue = $<HTMLInputElement>("f-due");
const fHint = $("f-due-hint");
const fAssignee = $<HTMLSelectElement>("f-assignee");
const fStatus = $<HTMLSelectElement>("f-status");
const fNote = $<HTMLTextAreaElement>("f-note");
const fNoteCount = $("f-note-count");
const fErr = $("f-err");
const newMember = $("f-newmember");
const memberName = $<HTMLInputElement>("f-member-name");
const saltWrap = form.querySelector<HTMLElement>(".salt-wrap")!;
const custom = $("f-custom");
const fProject = $<HTMLSelectElement>("f-project");
const linkList = $("f-links");
const linkIn = $<HTMLInputElement>("f-link");
let links: Link[] = [];
let fieldDefs: FieldDef[] = [];

let ctx: Ctx;
let editing: Task | undefined;

/** `datetime-local` wants local time without a zone, to the minute. */
function toLocalInput(ms: number): string {
  const d = new Date(ms);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const minute = (ms: number) => Math.floor(ms / 60_000) * 60_000;

function esc(s: string) { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)); }

function showError(key: Key, vars?: Record<string, string>) {
  fErr.textContent = t(key, vars);
  fErr.hidden = false;
  saltWrap.classList.remove("fall");
  void saltWrap.offsetWidth;
  saltWrap.classList.add("fall");
  audio.rustle(0.5);
}

function clearError() {
  fErr.hidden = true;
  saltWrap.classList.remove("fall");
}

function updateHint() {
  const due = new Date(fDue.value).getTime();
  fHint.textContent = Number.isFinite(due) ? `${formatDue(due)} · ${formatLeft(due - Date.now())}` : "";
}

function fillAssignees(selected?: string) {
  fAssignee.innerHTML = "";
  const add = (value: string, label: string) => {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = label;
    fAssignee.appendChild(o);
  };
  add("", t("fNone"));
  for (const m of ctx.members()) add(m.id, m.name);
  add("__new", t("fNewMember"));
  fAssignee.value = selected && ctx.members().some((m) => m.id === selected) ? selected : "";
  newMember.hidden = true;
}

/* ---------- the project's own fields ---------- */
function renderCustom(values: Record<string, FieldValue> = {}) {
  custom.innerHTML = "";
  for (const f of fieldDefs) {
    const id = `cf-${f.id}`;
    const v = values[f.id];
    const wrap = document.createElement("div");
    wrap.className = f.type === "checkbox" ? "f check" : "f";
    if (f.type === "checkbox") {
      wrap.innerHTML = `<label><input id="${id}" type="checkbox"${v === true ? " checked" : ""} /> <span>${esc(f.name)}</span></label>`;
    } else {
      let control: string;
      const val = v === undefined ? "" : esc(String(v));
      if (f.type === "select") {
        control = `<select id="${id}"><option value="">—</option>${(f.options ?? []).map((o) =>
          `<option${o === v ? " selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
      } else {
        const type = f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "url" ? "url" : "text";
        control = `<input id="${id}" type="${type}" value="${val}"${f.type === "text" ? ' maxlength="200"' : ""}${f.type === "number" ? ' step="any"' : ""} />`;
      }
      wrap.innerHTML = `<label for="${id}">${esc(f.name)}</label>${control}`;
    }
    custom.appendChild(wrap);
  }
}

/** Read the fields back. Returns an error, or the values (empty ones are left out). */
function readCustom(): { error?: [Key, Record<string, string>]; values?: Record<string, FieldValue> } {
  const out: Record<string, FieldValue> = {};
  for (const f of fieldDefs) {
    const el = document.getElementById(`cf-${f.id}`) as HTMLInputElement | HTMLSelectElement | null;
    if (!el) continue;
    if (f.type === "checkbox") { if ((el as HTMLInputElement).checked) out[f.id] = true; continue; }
    const raw = el.value.trim();
    if (!raw) continue;
    if (f.type === "number") {
      const n = Number(raw);
      if (!Number.isFinite(n)) return { error: ["errNumber", { name: f.name }] };
      out[f.id] = n;
    } else if (f.type === "url") {
      const u = cleanUrl(raw);
      if (!u) return { error: ["errUrlField", { name: f.name }] };
      out[f.id] = u;
    } else out[f.id] = raw;
  }
  return { values: out };
}

/* ---------- reference links ---------- */
function renderLinks() {
  linkList.innerHTML = "";
  for (const l of links) {
    const info = describe(l.url);
    const li = document.createElement("li");
    li.className = `lk lk-${info.kind}`;
    li.innerHTML = `${icon(info.kind)}<span class="svc">${esc(info.service)}</span><span class="u" title="${esc(l.url)}">${esc(info.label)}</span>
      <button type="button" class="rm" aria-label="${esc(t("fLinkRemove"))}: ${esc(info.label)}">×</button>`;
    li.querySelector(".rm")!.addEventListener("click", () => {
      links = links.filter((x) => x.id !== l.id);
      renderLinks();
      linkIn.focus();
    });
    linkList.appendChild(li);
  }
}

function addLink(): boolean {
  if (!linkIn.value.trim()) return true;
  const url = cleanUrl(linkIn.value);
  if (!url) { showError("errLink"); return false; }
  if (links.length >= MAX_LINKS) { showError("errLinkMax"); return false; }
  if (!links.some((l) => l.url === url)) links.push({ id: crypto.randomUUID(), url });
  linkIn.value = "";
  clearError();
  renderLinks();
  return true;
}

function open(task?: Task) {
  editing = task;
  const proj = ctx.project(task);
  fieldDefs = proj?.fields ?? [];
  // the project picker only matters when there is somewhere else to go
  const all = ctx.projects();
  fProject.innerHTML = all.map((p) => `<option value="${esc(p.id)}">${esc(projectName(p))}</option>`).join("");
  fProject.value = proj?.id ?? all[0]?.id ?? "";
  $("f-project-wrap").hidden = all.length < 2;
  links = (task?.links ?? []).map((l) => ({ ...l }));
  linkIn.value = "";
  renderCustom(task?.fields);
  renderLinks();
  clearError();
  $("dlg-title").textContent = t(task ? "dlgEdit" : "dlgNew");
  $("dlg-ok").textContent = t(task ? "save" : "gateEnter");
  fTitle.value = task?.title ?? "";
  fDue.value = toLocalInput(task?.due ?? Date.now() + 2 * 3600_000);
  fNote.value = task?.note ?? "";
  fNoteCount.textContent = `${fNote.value.length} / 500`;
  fStatus.value = task?.status ?? "todo";
  // a new candle cannot start out finished
  (fStatus.querySelector('option[value="done"]') as HTMLOptionElement).disabled = !task;
  fillAssignees(task?.assignee);
  updateHint();
  applyLabels();
  ctx.onOpen();
  dlg.showModal();
  fTitle.focus();
  fTitle.select();
}

/** Field labels come from the project, the rest from the dictionary. */
function applyLabels() {
  linkIn.setAttribute("placeholder", t("fLinkPh"));
}

export const openNew = () => open();
export const openEdit = (task: Task) => open(task);
export const isOpen = () => dlg.open;

function addMemberFromField() {
  const name = memberName.value.trim();
  if (!name) return showError("errMember");
  const m = ctx.addMember(name);
  memberName.value = "";
  clearError();
  fillAssignees(m.id);
  fAssignee.focus();
}

export function initDialog(c: Ctx): void {
  ctx = c;

  document.querySelectorAll<HTMLButtonElement>(".chips button").forEach((b) =>
    b.addEventListener("click", () => {
      fDue.value = toLocalInput(Date.now() + Number(b.dataset.min) * 60_000);
      clearError();
      updateHint();
    }));
  fDue.addEventListener("input", updateHint);
  fNote.addEventListener("input", () => { fNoteCount.textContent = `${fNote.value.length} / 500`; });

  fAssignee.addEventListener("change", () => {
    newMember.hidden = fAssignee.value !== "__new";
    if (!newMember.hidden) memberName.focus();
  });
  $("f-member-add").addEventListener("click", addMemberFromField);
  memberName.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); addMemberFromField(); }
  });

  fProject.addEventListener("change", () => {
    // another project brings its own fields; values typed for the old ones are kept on the task
    const keep = readCustom().values ?? {};
    fieldDefs = ctx.projects().find((p) => p.id === fProject.value)?.fields ?? [];
    renderCustom({ ...(editing?.fields ?? {}), ...keep });
  });
  $("f-link-add").addEventListener("click", () => { addLink(); linkIn.focus(); });
  linkIn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); addLink(); }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    clearError();
    const title = fTitle.value.trim();
    if (!title) return showError("errTitle");
    // a link typed but not added yet is added on save
    if (!addLink()) return;
    const cf = readCustom();
    if (cf.error) return showError(cf.error[0], cf.error[1]);
    const status = fStatus.value as Status;
    const typed = new Date(fDue.value).getTime();
    if (!Number.isFinite(typed)) return showError("errPast");
    // An untouched deadline (or a finished task) is never re-checked against the clock.
    const unchanged = !!editing && minute(editing.due) === typed;
    let due = typed;
    if (unchanged && editing) due = editing.due;
    else if (!(editing && status === "done")) {
      if (typed < Date.now() + MIN_MS) return showError("errPast");
      if (typed > Date.now() + MAX_MS) return showError("errFar");
    }
    const input: TaskInput = {
      title,
      due,
      assignee: fAssignee.value && fAssignee.value !== "__new" ? fAssignee.value : undefined,
      note: fNote.value.trim() || undefined,
      status,
      projectId: fProject.value,
      fields: cf.values && Object.keys(cf.values).length ? cf.values : undefined,
      links: links.length ? links : undefined,
    };
    const err = ctx.onSubmit(input, editing);
    if (err) return showError(err);
    dlg.close();
  });

  $("dlg-cancel").addEventListener("click", () => dlg.close());
  $("dlg-close").addEventListener("click", () => dlg.close());
  // a click on the backdrop closes, but a drag that starts inside and ends outside does not
  let downOnBackdrop = false;
  dlg.addEventListener("pointerdown", (e) => { downOnBackdrop = e.target === dlg; });
  dlg.addEventListener("click", (e) => { if (e.target === dlg && downOnBackdrop) dlg.close(); });
  dlg.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); form.requestSubmit(); }
  });
  dlg.addEventListener("close", () => { editing = undefined; ctx.onClose(); });
}
