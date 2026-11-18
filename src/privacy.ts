import "./style.css";
import { getLang } from "./i18n";
import { initPage } from "./page";

// The policy keeps its text in the HTML (.en / .ja). Only the chrome comes from the dictionary.
initPage(() => {
  document.title = getLang() === "ja" ? "プライバシー — 灯 Tomoshibi" : "Privacy — Tomoshibi 灯";
});
// Forget the cookie choice and show the notice again.
document.getElementById("consent-reset")?.addEventListener("click", () => {
  try { localStorage.removeItem("tomoshibi.consent"); } catch { /* ignore */ }
  location.reload();
});
