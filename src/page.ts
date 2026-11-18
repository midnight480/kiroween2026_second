import { detectLang, setLang, type Lang } from "./i18n";

/** Theme and language for the side pages (team, help). Same settings as the board. */
type Settings = { lang?: string; theme?: string; [k: string]: unknown };
const KEY = "tomoshibi.settings";
const read = (): Settings => { try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; } };
const write = (patch: Settings) => { try { localStorage.setItem(KEY, JSON.stringify({ ...read(), ...patch })); } catch { /* ignore */ } };

export function initPage(onLang: () => void = () => {}): void {
  const themeSel = document.getElementById("theme") as HTMLSelectElement;
  const langSel = document.getElementById("lang") as HTMLSelectElement;
  const mq = matchMedia("(prefers-color-scheme: light)");
  const s = read();
  themeSel.value = s.theme === "light" || s.theme === "dark" ? s.theme : "system";
  langSel.value = (s.lang === "ja" || s.lang === "en" ? s.lang : detectLang()) as Lang;
  const applyTheme = () => {
    const v = themeSel.value;
    document.documentElement.dataset.theme = v === "light" || (v === "system" && mq.matches) ? "light" : "dark";
  };
  const applyLang = () => { setLang(langSel.value as Lang); onLang(); };
  themeSel.addEventListener("change", () => { write({ theme: themeSel.value }); applyTheme(); });
  langSel.addEventListener("change", () => { write({ lang: langSel.value }); applyLang(); });
  mq.addEventListener("change", applyTheme);
  applyTheme();
  applyLang();
}
