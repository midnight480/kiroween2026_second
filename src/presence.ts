import * as audio from "./audio";

export interface PresenceHooks {
  /** Smallest remaining-life ratio among lit candles (0..1), or 1 if none. */
  urgency(): number;
  cards(): HTMLElement[];
  /** Called when the visitor breaks the rule "do not look at it". */
  onNoticed(): void;
  safe(): boolean;
}

const layer = () => document.getElementById("presence")!;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

// 丑三つ時 (02:00-03:00) is the thinnest hour. 逢魔が時 (17:00-18:00) is the second.
function hourFactor(): number {
  const h = new Date().getHours();
  if (h === 2) return 0.35;
  if (h === 17) return 0.7;
  return 1;
}

let mouse = { x: -999, y: -999 };
addEventListener("pointermove", (e) => (mouse = { x: e.clientX, y: e.clientY }));

export function startPresence(hooks: PresenceHooks): void {
  const next = () => {
    const urgent = hooks.urgency() < 0.25;
    const base = urgent ? rand(7000, 16000) : rand(22000, 55000);
    setTimeout(() => {
      if (!document.getElementById("curse")!.hidden) return next();
      fire(hooks);
      next();
    }, base * hourFactor());
  };
  next();
}

export function fire(hooks: PresenceHooks, which?: number): void {
  const events = [figure, eyes, whisperOnly, nudge, breath, glitchTitle];
  // The figure is rarer and only appears if the room is not empty.
  const i = which ?? Math.floor(Math.random() * events.length);
  events[i](hooks);
}

/** Someone standing at the edge of the screen. Look toward it and it is gone, and you pay. */
function figure(hooks: PresenceHooks) {
  if (hooks.safe()) return whisperOnly();
  const el = document.createElement("div");
  el.className = "figure";
  const left = Math.random() < 0.5;
  el.style.left = left ? `${rand(1, 4)}%` : "";
  el.style.right = left ? "" : `${rand(1, 4)}%`;
  layer().appendChild(el);
  requestAnimationFrame(() => el.classList.add("on"));
  audio.whisper();
  const born = performance.now();
  const timer = setInterval(() => {
    const r = el.getBoundingClientRect();
    const dx = mouse.x - (r.left + r.width / 2);
    const near = Math.abs(dx) < 260 && performance.now() - born > 1500;
    if (near) {
      // rule broken: it was there, now it is not, and a candle is shorter
      clearInterval(timer);
      el.remove();
      audio.rustle(0.9);
      hooks.onNoticed();
    } else if (performance.now() - born > 7000) {
      clearInterval(timer);
      el.classList.remove("on");
      setTimeout(() => el.remove(), 2600);
    }
  }, 120);
}

function eyes() {
  const el = document.createElement("div");
  el.className = "eyes";
  el.style.left = `${rand(8, 90)}%`;
  el.style.top = `${rand(18, 80)}%`;
  layer().appendChild(el);
  setTimeout(() => el.remove(), 1700);
}

function whisperOnly() {
  audio.whisper();
}

function nudge(hooks: PresenceHooks) {
  const cards = hooks.cards();
  if (!cards.length) return;
  const c = cards[Math.floor(Math.random() * cards.length)];
  const x = parseFloat(c.style.left) + rand(-12, 12);
  const y = parseFloat(c.style.top) + rand(-8, 8);
  c.classList.add("slide");
  c.style.left = `${x}px`;
  c.style.top = `${y}px`;
  audio.rustle(0.6);
  setTimeout(() => c.classList.remove("slide"), 1500);
}

function breath() {
  const d = document.getElementById("dark")!;
  d.classList.remove("breath");
  void d.offsetWidth;
  d.classList.add("breath");
  audio.rustle(0.2);
}

function glitchTitle(hooks: PresenceHooks) {
  const cards = hooks.cards();
  if (!cards.length) return;
  const c = cards[Math.floor(Math.random() * cards.length)];
  const h = c.querySelector("h3");
  if (!h || c.classList.contains("glitch")) return;
  const original = h.textContent;
  const words = ["うしろ", "いる", "みてる", "まだ"];
  h.textContent = words[Math.floor(Math.random() * words.length)];
  c.classList.add("glitch");
  setTimeout(() => {
    h.textContent = original;
    c.classList.remove("glitch");
  }, 500);
}
