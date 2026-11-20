// Step 2: record each scene of the demo video from the live site, as a guest.
//   node video/record.mjs [scene-id ...]   -> video/out/clips/<scene>.webm, video/out/clips.json
//
// The board runs as a guest: the demo ledger (scripts/demo-seed.mjs --print) is put into the browser's
// localStorage before the page loads, so no sign-in is needed and nothing is written to the database.
// Playwright is not a dependency of the project: this uses playwright-core from the npx cache
// (or PLAYWRIGHT_CORE=/path/to/playwright-core) and the installed Google Chrome.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const ORIGIN = process.env.TOMOSHIBI_ORIGIN ?? "https://tomoshibi.midnight480.com";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const VIEW = { width: 1440, height: 810 };

function findPlaywright() {
  if (process.env.PLAYWRIGHT_CORE) return process.env.PLAYWRIGHT_CORE;
  const base = join(homedir(), ".npm/_npx");
  for (const d of existsSync(base) ? readdirSync(base) : []) {
    const p = join(base, d, "node_modules/playwright-core");
    if (existsSync(join(p, "package.json")) && !JSON.parse(readFileSync(join(p, "package.json"), "utf8")).version.includes("alpha")) return p;
  }
  throw new Error("playwright-core not found: set PLAYWRIGHT_CORE");
}
const { chromium } = await import(join(findPlaywright(), "index.mjs"));

const durations = JSON.parse(readFileSync("video/out/durations.json", "utf8"));
const only = process.argv.slice(2);
mkdirSync("video/out/clips", { recursive: true });
const clipsFile = "video/out/clips.json";
const clips = existsSync(clipsFile) ? JSON.parse(readFileSync(clipsFile, "utf8")) : {};

/** The English demo ledger, with every time counted from now. */
function ledger(curseInSec) {
  const both = JSON.parse(execFileSync("node", ["scripts/demo-seed.mjs", "--print", "--lang", "en", "--curse-in", "30"]).toString());
  const { project, tasks } = both[1];
  const now = Date.now();
  const doomed = tasks.find((x) => x.title.startsWith("Upload the demo video"));
  if (curseInSec) { doomed.due = now + curseInSec * 1000; doomed.created = doomed.due - 60 * 60_000; }
  return { project, tasks };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const card = (page, title) => page.locator(".card", { hasText: title }).first();

/* ---------- the scenes ---------- */
const SCENES = {
  async "01-gate"(page, mark) {
    mark();
    await sleep(durations["01-gate"].scene * 1000 + 1500);
  },
  async "02-board"(page, mark, enter, zoom) {
    await enter(); mark();
    const d = durations["02-board"].scene * 1000;
    await page.mouse.move(300, 400, { steps: 30 });
    await sleep(d * 0.25);
    await page.mouse.move(800, 350, { steps: 40 });
    await sleep(d * 0.2);
    // a close look at one card: assignee, project fields, links
    const c = card(page, "Polish the ofuda cards");
    await c.hover();
    await zoom("card", c, d * 0.45, { left: 70 });
    await sleep(800);
  },
  async "03-haunting"(page, mark, enter, zoom) {
    await enter();
    const urgent = card(page, "Check the contrast");
    await urgent.scrollIntoViewIfNeeded();
    mark();
    const d = durations["03-haunting"].scene * 1000;
    await urgent.hover();
    await zoom("urgent", urgent, d * 0.3, { left: 70 });
    await page.evaluate(() => window.__t?.fire(0)); // a figure passes
    await sleep(d * 0.2);
    const eaten = card(page, "Tune the whisper");
    await eaten.scrollIntoViewIfNeeded();
    await eaten.hover();
    await zoom("eaten", eaten, d * 0.35, { left: 70 });
    await page.evaluate(() => window.__t?.fire(3)); // a card shifts
    await sleep(d * 0.15);
  },
  async "04-add"(page, mark, enter, zoom) {
    await enter(); mark();
    const d = durations["04-add"].scene * 1000;
    await sleep(800);
    await page.click("#new");
    await sleep(d * 0.25);
    await page.click("#dlg-ok"); // no title: the salt
    await sleep(300);
    await zoom("salt", page.locator("#task-form footer"), d * 0.4, { top: 60 });
    await sleep(d * 0.1);
    await page.locator("#f-title").pressSequentially("Record the narration with say", { delay: 55 });
    await page.click('.chips button[data-min="30"]');
    await page.selectOption("#f-assignee", { index: 1 }).catch(() => {});
    await sleep(900);
    await page.click("#dlg-ok");
    await sleep(2500);
  },
  async "05-finish"(page, mark, enter, zoom) {
    await enter();
    const c = card(page, "Check the board at 360px");
    await c.scrollIntoViewIfNeeded();
    mark();
    await sleep(1200);
    await c.locator(".seal").hover();
    await page.mouse.down();
    await zoom("seal", c, 1400, { left: 70 });
    await page.mouse.up();
    await sleep(durations["05-finish"].scene * 1000 * 0.35);
    const w = card(page, "Write the Devpost story");
    await w.scrollIntoViewIfNeeded();
    await w.locator(".act.extend").click();
    await sleep(600);
    await w.locator(".wax-pick").selectOption({ index: 2 }).catch(() => {});
    await zoom("wax", w, 2600, { left: 70 });
    await sleep(600);
  },
  async "06-language"(page, mark, enter, zoom) {
    await enter();
    const c = card(page, "Read the submission rules");
    await c.scrollIntoViewIfNeeded();
    mark();
    await c.hover();
    await zoom("seal-en", c, 3500);
    await page.selectOption("#lang", "ja");
    await sleep(600);
    await zoom("seal-ja", c, 3500);
    await page.selectOption("#theme", "light");
    await sleep(3500);
    await page.selectOption("#lang", "en");
    await page.selectOption("#theme", "dark");
    await sleep(2000);
  },
  async "07-curse"(page, mark, enter, zoom) {
    await enter();
    const c = card(page, "Upload the demo video");
    await c.scrollIntoViewIfNeeded();
    mark();
    await c.hover();
    // the last seconds of the candle, close: the counting song is written on the card
    await zoom("doomed", c, 40_000, { left: 70, until: () => page.evaluate(() => !document.getElementById("curse").hidden) });
    zoom.stamp("curse");
    // wait for the curse to go, then let the quiet board stay a moment
    await page.waitForFunction(() => document.getElementById("curse").hidden, null, { timeout: 60_000 });
    zoom.stamp("curseEnd");
    await sleep(2500);
  },
  async "08-outro"(page, mark, enter, zoom) {
    await enter();
    mark();
    await sleep(1500);
    await page.click("#safe");
    await zoom("safe", page.locator("label:has(#safe)"), 3000);
    // with every effect off, the ledger still works: finish a task
    const c = card(page, "Check the contrast");
    await c.scrollIntoViewIfNeeded();
    await c.locator(".seal").hover();
    await sleep(500);
    await page.mouse.down();
    // close while the seal peels (900 ms), then the whole board: the card leaves for Done
    await zoom("safe-seal", c, 1100, { left: 70 });
    await page.mouse.up();
    await sleep(Math.max(3000, durations["08-outro"].scene * 1000 - 5600));
  },
};
// the curse task's deadline, counted from when the page opens: room for the cold open (00-cold) and 10 s of song
const CURSE_AT = { "07-curse": 20 };

/* ---------- recording ---------- */
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
try {
  for (const [id, run] of Object.entries(SCENES)) {
    if (only.length && !only.includes(id)) continue;
    const dir = `video/out/raw-${id}`;
    rmSync(dir, { recursive: true, force: true });
    const data = ledger(CURSE_AT[id]);
    const context = await browser.newContext({ viewport: VIEW, recordVideo: { dir, size: VIEW }, reducedMotion: "no-preference", locale: "en-US" });
    await context.addInitScript((d) => {
      if (sessionStorage.getItem("demo-seeded")) return;
      sessionStorage.setItem("demo-seeded", "1");
      localStorage.setItem("tomoshibi.tasks.v2", JSON.stringify(d.tasks));
      localStorage.setItem("tomoshibi.projects", JSON.stringify([d.project]));
      localStorage.setItem("tomoshibi.project", d.project.id);
      localStorage.setItem("tomoshibi.consent", "essential");
      localStorage.removeItem("tomoshibi.signedIn");
      localStorage.setItem("tomoshibi.settings", JSON.stringify({ lang: "en", theme: "dark", safe: false, mute: true }));
    }, data);
    const t0 = Date.now();
    const page = await context.newPage();
    await page.goto(`${ORIGIN}/?debug`, { waitUntil: "networkidle" });
    let start = 0;
    const zooms = [];
    const at = () => (Date.now() - t0) / 1000 - start;
    const mark = () => { start = (Date.now() - t0) / 1000; };
    const enter = async () => { await page.click("#enter"); await sleep(1900); };
    /**
     * A close-up for build.mjs: note where `locator` is and for how long (ms, or until `until()` is true).
     * `pad` widens the box (left: 70 takes in the candle beside a card; a negative right trims it).
     */
    const zoom = async (name, locator, ms, pad = {}) => {
      const b = await locator.boundingBox();
      const from = at();
      if (pad.until) {
        const limit = Date.now() + ms;
        while (Date.now() < limit && !(await pad.until())) await sleep(100);
      } else await sleep(ms);
      if (b) {
        const x = b.x - (pad.left ?? 16), y = b.y - (pad.top ?? 16);
        const w = b.width + (pad.left ?? 16) + (pad.right ?? 16), h = b.height + (pad.top ?? 16) + 16;
        zooms.push({ name, from: +from.toFixed(2), to: +at().toFixed(2), box: [x, y, w, h].map((v) => Math.round(v)) });
      }
    };
    const marks = {};
    zoom.stamp = (name) => { marks[name] = +at().toFixed(2); };
    await run(page, mark, enter, zoom);
    const end = (Date.now() - t0) / 1000;
    const video = page.video();
    await context.close();
    const out = `video/out/clips/${id}.webm`;
    renameSync(await video.path(), out);
    rmSync(dir, { recursive: true, force: true });
    clips[id] = { file: out, start: +start.toFixed(2), end: +end.toFixed(2), zooms, marks };
    writeFileSync(clipsFile, JSON.stringify(clips, null, 2));
    console.log(`${id.padEnd(12)} ${(end - start).toFixed(1)}s`);
  }
} finally {
  await browser.close();
}
