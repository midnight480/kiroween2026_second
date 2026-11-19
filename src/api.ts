import "./style.css";
import { getLang } from "./i18n";
import { initPage } from "./page";

// The API docs keep their text in the HTML (.en / .ja), like the help page. Only the chrome comes
// from the dictionary. The examples use this site's own address, so they can be copied as they are.
initPage(() => {
  document.title = getLang() === "ja" ? "API — 灯 Tomoshibi" : "API — Tomoshibi 灯";
});
document.querySelectorAll<HTMLElement>("[data-origin] code").forEach((el) => {
  el.textContent = el.textContent!.replaceAll("https://tomoshibi.midnight480.com", location.origin);
});
addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === "Escape" || e.key === "b" || e.key === "B") location.href = "./";
  else if (e.key === "?") location.href = "help.html";
});
