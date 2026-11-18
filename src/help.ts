import "./style.css";
import { getLang } from "./i18n";
import { initPage } from "./page";
import { touchMe } from "./store";

// The help page keeps its text in the HTML (.en / .ja). Only the chrome comes from the dictionary.
initPage(() => {
  document.title = getLang() === "ja" ? "ヘルプ — 灯 Tomoshibi" : "Help — Tomoshibi 灯";
});
touchMe();
addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) return;
  if (e.key === "Escape" || e.key === "b" || e.key === "B") location.href = "./";
  else if (e.key === "t" || e.key === "T") location.href = "members.html";
});
