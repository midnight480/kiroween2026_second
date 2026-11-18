import * as audio from "./audio";
import { t, formatDue, type Key } from "./i18n";
import { formatLeft, type Member, type Status, type Task } from "./store";

export const MIN_MS = 60_000;
export const MAX_MS = 365 * 86_400_000;

/** What the dialog hands back. The caller decides how to create or update a task. */
export interface TaskInput {
  title: string;
  due: number;
  assignee?: string;
  note?: string;
  status: Status;
}

interface Ctx {
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

let ctx: Ctx;
let editing: Task | undefined;

/** `datetime-local` wants local time without a zone, to the minute. */
function toLocalInput(ms: number): string {
  const d = new Date(ms);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const minute = (ms: number) => Math.floor(ms / 60_000) * 60_000;

function showError(key: Key) {
  fErr.textContent = t(key);
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

function open(task?: Task) {
  editing = task;
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
  ctx.onOpen();
  dlg.showModal();
  fTitle.focus();
  fTitle.select();
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

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    clearError();
    const title = fTitle.value.trim();
    if (!title) return showError("errTitle");
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
