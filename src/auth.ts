/**
 * Optional sign-in with Clerk. The ledger never waits for it: the board is drawn first, and if Clerk
 * is not configured or cannot load (offline, blocked), the app stays a guest app on localStorage.
 *
 * Signed in, the person's tasks and projects live on the server (src/sync.ts). Guests stay on localStorage.
 */
import type { Clerk as ClerkType } from "@clerk/clerk-js";
import { t, getLang } from "./i18n";
import { authAllowedOnLoad, rememberSignedIn } from "./consent";

declare global {
  interface Window { __internal_ClerkUICtor?: unknown }
}

let clerk: ClerkType | null = null;
let rootEl: HTMLElement | null = null;

/** Clerk's own text in the app's language. English is Clerk's default. */
async function localization(): Promise<object | undefined> {
  if (getLang() !== "ja") return undefined;
  const { jaJP } = await import("@clerk/localizations");
  return jaJP;
}
const listeners: Array<() => void> = [];

export const authUser = () => clerk?.user ?? null;
export const onAuthChange = (fn: () => void) => { listeners.push(fn); };
/** A fresh session token for our API, or null when signed out. Clerk caches and renews it. */
export const sessionToken = async (): Promise<string | null> => (await clerk?.session?.getToken()) ?? null;

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

let pubKey: string | null = null;
let starting: Promise<void> | null = null;
let loadFailed = false;

/** A sign-in button that loads Clerk only when pressed (cookie choice "essential", see consent.ts). */
function renderLazy(root: HTMLElement) {
  root.innerHTML = "";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "auth-btn";
  btn.textContent = t("signIn");
  btn.title = t("signInTitle");
  btn.addEventListener("click", () => {
    btn.disabled = true;
    void start(root, true);
  });
  root.appendChild(btn);
  root.hidden = false;
}

/**
 * Set up sign-in. Safe to call when no key is set. Clerk (and its cookies) loads with the page only
 * when the cookie notice was accepted or the person was signed in before; otherwise on the first press.
 */
export async function initAuth(root: HTMLElement): Promise<void> {
  rootEl = root;
  const key = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  if (!key) { root.hidden = true; return; }
  // A production build must not talk to the development instance (strict limits). Keys come from
  // .env.development.local / .env.production.local (see .env.example).
  if (import.meta.env.PROD && key.startsWith("pk_test_") && !import.meta.env.VITE_CLERK_ALLOW_DEV_KEY) {
    console.warn("[tomoshibi] development Clerk key in a production build: sign-in is turned off.");
    root.hidden = true;
    return;
  }
  pubKey = key;
  if (authAllowedOnLoad()) await start(root, false);
  else renderLazy(root);
}

/** The cookie notice was accepted: load Clerk now if it is not loaded yet. */
export function allowAuth(): void {
  if (rootEl && pubKey && !clerk) void start(rootEl, false);
}

function start(root: HTMLElement, openSignIn: boolean): Promise<void> {
  starting ??= load(root, pubKey!).finally(() => { starting = null; });
  return starting.then(() => { if (openSignIn && clerk && !clerk.user) clerk.openSignIn({ appearance: appearance() }); });
}

async function load(root: HTMLElement, key: string): Promise<void> {
  if (clerk) return;
  try {
    // the Frontend API domain is encoded in the publishable key
    const domain = atob(key.split("_")[2] ?? "").replace(/\$$/, "");
    await loadUiBundle(domain);
    const { Clerk } = await import("@clerk/clerk-js");
    const c = new Clerk(key);
    await c.load({
      ui: { ClerkUI: window.__internal_ClerkUICtor },
      appearance: appearance(),
      localization: await localization(),
    } as Parameters<ClerkType["load"]>[0]);
    clerk = c;
    let last = c.user?.id ?? null;
    rememberSignedIn(!!last);
    c.addListener(() => {
      const now = c.user?.id ?? null;
      if (now === last) return;
      last = now;
      rememberSignedIn(!!now);
      render(root);
      listeners.forEach((fn) => fn());
    });
    root.hidden = false;
    render(root);
    listeners.forEach((fn) => fn());
  } catch (e) {
    // Sign-in is optional. Without it the ledger still works as a guest.
    console.warn("[tomoshibi] sign-in unavailable:", e);
    loadFailed = true;
    root.hidden = true;
  }
}

/**
 * Language or theme changed: redraw our button, and pass the new text and colours to Clerk's
 * components. Clerk has no public API for this, so a failure only means the change shows on the next load.
 */
export async function refreshAuth(): Promise<void> {
  if (!rootEl) return;
  if (!clerk) { if (pubKey && !starting && !loadFailed) renderLazy(rootEl); return; }
  if (!clerk.user) render(rootEl);
  try {
    const c = clerk as unknown as { __internal_updateProps?: (p: object) => Promise<void> | undefined };
    await c.__internal_updateProps?.({ options: { appearance: appearance(), localization: (await localization()) ?? {} } });
  } catch (e) {
    console.warn("[tomoshibi] could not update Clerk's language:", e);
  }
}
