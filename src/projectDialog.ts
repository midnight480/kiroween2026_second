import * as audio from "./audio";
import { t, type Key } from "./i18n";
import { FIELD_TYPES, projectName, type FieldDef, type FieldType, type Project } from "./store";

const TYPE_KEY: Record<FieldType, Key> = {
  text: "ftText", number: "ftNumber", select: "ftSelect", date: "ftDate", checkbox: "ftCheckbox", url: "ftUrl",
};

interface Ctx {
  /** Save a new or changed project. Return an error key to keep the dialog open. */
  onSave(name: string, fields: FieldDef[], project?: Project): Key | null;
  /** Delete. Return an error key (not empty, last one) to refuse. */
  onDelete(project: Project): Key | null;
  onClose(): void;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const dlg = $<HTMLDialogElement>("proj-dialog");
const form = $<HTMLFormElement>("proj-form");
const nameIn = $<HTMLInputElement>("pd-name");
const list = $("pd-fields");
const err = $("pd-err");
const del = $("pd-delete");
const saltWrap = form.querySelector<HTMLElement>(".salt-wrap")!;

let ctx: Ctx;
let editing: Project | undefined;
let rows: FieldDef[] = [];

function esc(s: string) { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)); }

function showError(key: Key) {
  err.textContent = t(key);
  err.hidden = false;
  saltWrap.classList.remove("fall");
  void saltWrap.offsetWidth;
  saltWrap.classList.add("fall");
  audio.rustle(0.5);
}
function clearError() { err.hidden = true; saltWrap.classList.remove("fall"); }

/** Read what the user typed into the rows back into `rows`. */
function collect() {
  list.querySelectorAll<HTMLElement>(".frow").forEach((r, i) => {
    const f = rows[i];
    f.name = r.querySelector<HTMLInputElement>(".fn")!.value;
    f.type = r.querySelector<HTMLSelectElement>(".ft")!.value as FieldType;
    f.onCard = r.querySelector<HTMLInputElement>(".fc")!.checked;
    const opts = r.querySelector<HTMLInputElement>(".fo")!.value;
    f.options = f.type === "select" ? opts.split(/[,、]/).map((s) => s.trim()).filter(Boolean) : undefined;
  });
}

function renderRows() {
  list.innerHTML = "";
  rows.forEach((f, i) => {
    const r = document.createElement("div");
    r.className = "frow";
    r.innerHTML = `
      <input class="fn" type="text" maxlength="30" value="${esc(f.name)}" placeholder="${esc(t("fieldName"))}" aria-label="${esc(t("fieldName"))} ${i + 1}" />
      <select class="ft" aria-label="${esc(t("fieldType"))} ${i + 1}">${FIELD_TYPES.map((ty) =>
        `<option value="${ty}"${ty === f.type ? " selected" : ""}>${esc(t(TYPE_KEY[ty]))}</option>`).join("")}</select>
      <label class="fcl"><input class="fc" type="checkbox"${f.onCard ? " checked" : ""} /> ${esc(t("fieldOnCard"))}</label>
      <button type="button" class="ghost frm" aria-label="${esc(t("fieldRemove"))} ${i + 1}">×</button>
      <input class="fo" type="text" maxlength="300" value="${esc((f.options ?? []).join(", "))}" placeholder="${esc(t("fieldOptions"))}" aria-label="${esc(t("fieldOptions"))} ${i + 1}"${f.type === "select" ? "" : " hidden"} />`;
    r.querySelector(".ft")!.addEventListener("change", (e) => {
      r.querySelector<HTMLInputElement>(".fo")!.hidden = (e.target as HTMLSelectElement).value !== "select";
    });
    r.querySelector(".frm")!.addEventListener("click", () => {
      collect();
      rows.splice(i, 1);
      renderRows();
      $("pd-add-field").focus();
    });
    list.appendChild(r);
  });
}

function open(project?: Project, canDelete = false) {
  editing = project;
  clearError();
  $("pd-title").textContent = t(project ? "projDlgEdit" : "projDlgNew");
  $("pd-ok").textContent = t(project ? "save" : "projCreate");
  nameIn.value = project ? projectName(project) : "";
  rows = (project?.fields ?? []).map((f) => ({ ...f, options: f.options ? [...f.options] : undefined }));
  renderRows();
  del.hidden = !project || !canDelete;
  dlg.showModal();
  nameIn.focus();
  nameIn.select();
}

export const openNewProject = () => open();
export const openProjectSettings = (p: Project, canDelete: boolean) => open(p, canDelete);
export const isProjectDialogOpen = () => dlg.open;

export function initProjectDialog(c: Ctx): void {
  ctx = c;
  $("pd-add-field").addEventListener("click", () => {
    collect();
    rows.push({ id: crypto.randomUUID(), name: "", type: "text", onCard: false });
    renderRows();
    list.querySelector<HTMLInputElement>(".frow:last-child .fn")?.focus();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    clearError();
    collect();
    const name = nameIn.value.trim();
    if (!name) return showError("errProjName");
    for (const f of rows) {
      f.name = f.name.trim();
      if (!f.name) return showError("errFieldName");
      if (f.type === "select" && !(f.options ?? []).length) return showError("errFieldOptions");
    }
    const errKey = ctx.onSave(name, rows, editing);
    if (errKey) return showError(errKey);
    dlg.close();
  });

  // delete: press and hold, like burning a card
  let timer = 0;
  const start = () => {
    if (timer || !editing) return;
    del.classList.add("peeling");
    timer = window.setTimeout(() => {
      timer = 0;
      del.classList.remove("peeling");
      const errKey = editing ? ctx.onDelete(editing) : null;
      if (errKey) showError(errKey); else dlg.close();
    }, 900);
  };
  const stop = () => { clearTimeout(timer); timer = 0; del.classList.remove("peeling"); };
  del.addEventListener("pointerdown", start);
  del.addEventListener("pointerup", stop);
  del.addEventListener("pointerleave", stop);
  del.addEventListener("pointercancel", stop);
  del.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); start(); } });
  del.addEventListener("keyup", stop);
  del.addEventListener("blur", stop);

  $("pd-cancel").addEventListener("click", () => dlg.close());
  $("pd-close").addEventListener("click", () => dlg.close());
  let downOnBackdrop = false;
  dlg.addEventListener("pointerdown", (e) => { downOnBackdrop = e.target === dlg; });
  dlg.addEventListener("click", (e) => { if (e.target === dlg && downOnBackdrop) dlg.close(); });
  dlg.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); form.requestSubmit(); }
  });
  dlg.addEventListener("close", () => { editing = undefined; ctx.onClose(); });
}
