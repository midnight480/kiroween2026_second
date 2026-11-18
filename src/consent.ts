/**
 * The cookie notice. Tomoshibi itself sets no cookies; the only ones come from Clerk (sign-in).
 * There are no analytics or advertising cookies, so the choice is only *when* Clerk may load:
 *
 *   "all"        Clerk loads with the page (shows whether you are signed in at once).
 *   "essential"  Clerk loads only when you press Sign in, or when you were signed in before.
 *
 * The choice is kept in localStorage (`tomoshibi.consent`), never in a cookie. See privacy.html.
 */
import { t } from "./i18n";

export type Consent = "all" | "essential";
const KEY = "tomoshibi.consent";
/** Set while signed in, so a returning signed-in person gets their ledger without pressing anything. */
const SIGNED_IN_KEY = "tomoshibi.signedIn";

export function getConsent(): Consent | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "all" || v === "essential" ? v : null;
  } catch { return null; }
}
function setConsent(v: Consent): void {
  try { localStorage.setItem(KEY, v); } catch { /* private mode: ask again next time */ }
}

/** May Clerk load with the page? */
export function authAllowedOnLoad(): boolean {
  if (getConsent() === "all") return true;
  try { return localStorage.getItem(SIGNED_IN_KEY) === "1"; } catch { return false; }
}
export function rememberSignedIn(on: boolean): void {
  try { if (on) localStorage.setItem(SIGNED_IN_KEY, "1"); else localStorage.removeItem(SIGNED_IN_KEY); } catch { /* ignore */ }
}

let bar: HTMLElement | null = null;

function fill(el: HTMLElement): void {
  el.querySelector(".cc-text")!.textContent = t("consentText");
  const more = el.querySelector<HTMLAnchorElement>(".cc-more")!;
  more.textContent = t("consentMore");
  el.querySelector(".cc-ok")!.textContent = t("consentOk");
  el.querySelector(".cc-min")!.textContent = t("consentEssential");
  el.setAttribute("aria-label", t("consentAria"));
}

/** Show the notice until a choice is made. `onAll` runs when the person accepts. */
export function initConsent(onAll: () => void): void {
  if (getConsent()) return;
  const el = document.createElement("section");
  el.className = "cc";
  el.setAttribute("role", "region");
  el.innerHTML = `<p><span class="cc-text"></span> <a class="cc-more" href="privacy.html"></a></p>
    <div class="cc-btns"><button type="button" class="cc-min ghost"></button><button type="button" class="cc-ok btn"></button></div>`;
  fill(el);
  const close = (v: Consent) => {
    setConsent(v);
    el.remove();
    bar = null;
    if (v === "all") onAll();
  };
  el.querySelector(".cc-ok")!.addEventListener("click", () => close("all"));
  el.querySelector(".cc-min")!.addEventListener("click", () => close("essential"));
  document.body.appendChild(el);
  bar = el;
}

/** Language changed. */
export function refreshConsent(): void {
  if (bar) fill(bar);
}
