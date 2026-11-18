import "./style.css";
import { detectLang, type Lang } from "./i18n";

// The help page shares the ledger's theme and language settings.
type Settings = { lang?: string; theme?: string; [k: string]: unknown };
const read = (): Settings => { try { return JSON.parse(localStorage.getItem("tomoshibi.settings") ?? "{}"); } catch { return {}; } };
const write = (patch: Settings) => { try { localStorage.setItem("tomoshibi.settings", JSON.stringify({ ...read(), ...patch })); } catch { /* ignore */ } };

const themeSel = document.getElementById("theme") as HTMLSelectElement;
const langSel = document.getElementById("lang") as HTMLSelectElement;
const mq = matchMedia("(prefers-color-scheme: light)");

function apply() {
  const v = themeSel.value;
  document.documentElement.dataset.theme = v === "light" || (v === "system" && mq.matches) ? "light" : "dark";
  document.documentElement.lang = langSel.value;
  document.title = langSel.value === "ja" ? "ヘルプ — 灯 Tomoshibi" : "Help — Tomoshibi 灯";
}

const s = read();
themeSel.value = s.theme === "light" || s.theme === "dark" ? s.theme : "system";
langSel.value = (s.lang === "ja" || s.lang === "en" ? s.lang : detectLang()) as Lang;
themeSel.addEventListener("change", () => { write({ theme: themeSel.value }); apply(); });
langSel.addEventListener("change", () => { write({ lang: langSel.value }); apply(); });
mq.addEventListener("change", apply);
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !(e.target instanceof HTMLSelectElement)) location.href = "./";
});
apply();
