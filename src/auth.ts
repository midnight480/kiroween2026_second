/**
 * Optional sign-in with Clerk. The ledger never waits for it: the board is drawn first, and if Clerk
 * is not configured or cannot load (offline, blocked), the app stays a guest app on localStorage.
 *
 * Tasks are not synced yet. Sign-in only identifies the person until the API exists (docs/deploy.md, stage 2).
 */
import type { Clerk as ClerkType } from "@clerk/clerk-js";
import { t } from "./i18n";

declare global {
  interface Window { __internal_ClerkUICtor?: unknown }
}

let clerk: ClerkType | null = null;
const listeners: Array<() => void> = [];

export const authUser = () => clerk?.user ?? null;
export const onAuthChange = (fn: () => void) => { listeners.push(fn); };

/** Paper, ink and vermilion, so the Clerk card looks like one more ofuda. Direct colours only (Clerk's advice). */
function appearance() {
  const light = document.documentElement.dataset.theme === "light";
  return {
    variables: {
      colorPrimary: "#8e1010",
      colorPrimaryForeground: "#f4ecd6",
      colorBackground: "#d8cdb0",
      colorForeground: "#1a1410",
      colorMutedForeground: "#4a3d2c",
      colorInput: "#efe6cf",
      colorInputForeground: "#1a1410",
      colorBorder: "#7a6a4a",
      colorDanger: "#7a0a0a",
      colorNeutral: "#1a1410",
      colorShadow: light ? "#3a2c1a" : "#000000",
      fontFamily: '"Hiragino Mincho ProN", "Noto Serif JP", "Yu Mincho", Georgia, serif',
      borderRadius: "2px",
    },
  };
}

function loadUiBundle(domain: string, ms = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.__internal_ClerkUICtor) return resolve();
    const s = document.createElement("script");
    s.src = `https://${domain}/npm/@clerk/ui@1/dist/ui.browser.js`;
    s.async = true;
    s.crossOrigin = "anonymous";
    const timer = setTimeout(() => reject(new Error("Clerk UI timed out")), ms);
    s.onload = () => { clearTimeout(timer); resolve(); };
    s.onerror = () => { clearTimeout(timer); reject(new Error("Clerk UI failed to load")); };
    document.head.appendChild(s);
  });
}

function render(root: HTMLElement) {
  root.innerHTML = "";
  if (!clerk) return;
  if (clerk.user) {
    const slot = document.createElement("div");
    slot.className = "auth-user";
    root.appendChild(slot);
    clerk.mountUserButton(slot, { appearance: appearance() });
  } else {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "auth-btn";
    btn.textContent = t("signIn");
    btn.title = t("signInTitle");
    btn.addEventListener("click", () => clerk?.openSignIn({ appearance: appearance() }));
    root.appendChild(btn);
  }
}

/** Start Clerk in the background. Safe to call when no key is set. */
export async function initAuth(root: HTMLElement): Promise<void> {
  const key = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  if (!key) { root.hidden = true; return; }
  try {
    // the Frontend API domain is encoded in the publishable key
    const domain = atob(key.split("_")[2] ?? "").replace(/\$$/, "");
    await loadUiBundle(domain);
    const { Clerk } = await import("@clerk/clerk-js");
    const c = new Clerk(key);
    await c.load({
      ui: { ClerkUI: window.__internal_ClerkUICtor },
      appearance: appearance(),
      // Clerk's own text follows the browser; the app's language switch covers the rest
    } as Parameters<ClerkType["load"]>[0]);
    clerk = c;
    let last = c.user?.id ?? null;
    c.addListener(() => {
      const now = c.user?.id ?? null;
      if (now === last) return;
      last = now;
      render(root);
      listeners.forEach((fn) => fn());
    });
    root.hidden = false;
    render(root);
    listeners.forEach((fn) => fn());
  } catch (e) {
    // Sign-in is optional. Without it the ledger still works as a guest.
    console.warn("[tomoshibi] sign-in unavailable:", e);
    root.hidden = true;
  }
}

/** Language changed: redraw the button's text. */
export function refreshAuthText(root: HTMLElement): void {
  if (clerk && !clerk.user) render(root);
}
