// Put a demo ledger ("making the Kiroween 2026 entry") into the production board, for screenshots
// and the demo video. Run it right before recording: every time is counted from the moment it runs.
//
//   npm run demo:seed                     English titles, the curse comes 3 minutes later
//   npm run demo:seed -- --lang ja        Japanese titles
//   npm run demo:seed -- --curse-in 5     the curse comes 5 minutes later (1..30)
//   npm run demo:seed -- --remove         take the demo out again
//   npm run demo:seed -- --print          print the demo as JSON (no key, no database)
//
// Whose board: the owner of TOMOSHIBI_API_KEY (.env.production.local). The key is used only to ask
// the public API for that person's projects; the rows are then written with the direct database
// connection in .env.local (DATABASE_URL_UNPOOLED), in the same JSON shape the board saves, because
// the API cannot set what a demo needs (half-burnt candles, rosters, links, project fields).
//
// Only the project `demo-kiroween2026` and tasks whose id starts with `demo-` are touched.
// Each run replaces them. Nothing else on the board changes. Nothing secret is printed.
import pg from "pg";

const args = process.argv.slice(2);
const lang = args.includes("--lang") ? args[args.indexOf("--lang") + 1] : "en";
const remove = args.includes("--remove");
const curseIn = args.includes("--curse-in") ? Number(args[args.indexOf("--curse-in") + 1]) : 3;
if (lang !== "en" && lang !== "ja") { console.error("--lang must be en or ja"); process.exit(1); }
if (!Number.isInteger(curseIn) || curseIn < 1 || curseIn > 30) { console.error("--curse-in must be 1..30 (minutes)"); process.exit(1); }

if (args.includes("--print")) {
  console.log(JSON.stringify(demo(Date.now())));
  process.exit(0);
}

process.loadEnvFile(".env.production.local");
process.loadEnvFile(".env.local");
const key = process.env.TOMOSHIBI_API_KEY;
const dbUrl = process.env.DATABASE_URL_UNPOOLED;
const origin = process.env.TOMOSHIBI_ORIGIN ?? "https://tomoshibi.midnight480.com";
if (!key) { console.error("TOMOSHIBI_API_KEY is not set in .env.production.local"); process.exit(1); }
if (!dbUrl) { console.error("DATABASE_URL_UNPOOLED is not set in .env.local"); process.exit(1); }

/* ---------- whose board ---------- */
const res = await fetch(`${origin}/api/v1/projects`, { headers: { Authorization: `Bearer ${key}` } });
if (!res.ok) { console.error(`GET /api/v1/projects: ${res.status} (is the API key valid?)`); process.exit(1); }
const own = (await res.json()).projects ?? [];
if (!own.length) { console.error("no project yet: sign in on the board once, then run this again"); process.exit(1); }

const db = new pg.Client({ connectionString: dbUrl });
await db.connect();
try {
  const found = await db.query("SELECT DISTINCT user_id FROM projects WHERE id = $1", [own[0].id]);
  if (found.rows.length !== 1) throw new Error("could not tell whose board this is");
  const uid = found.rows[0].user_id;

  await db.query("BEGIN");
  const gone = await db.query("DELETE FROM tasks WHERE user_id = $1 AND id LIKE 'demo-%'", [uid]);
  await db.query("DELETE FROM projects WHERE user_id = $1 AND id = 'demo-kiroween2026'", [uid]);
  if (remove) {
    await db.query("COMMIT");
    console.log(`removed the demo (${gone.rowCount} tasks)`);
    process.exit(0);
  }

  const { project, tasks } = demo(Date.now());
  await db.query("INSERT INTO projects (user_id, id, data, updated_at) VALUES ($1, $2, $3::jsonb, now())",
    [uid, project.id, JSON.stringify(project)]);
  await db.query(
    `INSERT INTO tasks (user_id, id, data, updated_at)
     SELECT $1, u.id, u.data::jsonb, now() FROM unnest($2::text[], $3::text[]) AS u(id, data)`,
    [uid, tasks.map((x) => x.id), tasks.map((x) => JSON.stringify(x))]);
  await db.query("COMMIT");

  const at = new Date(Date.now() + curseIn * 60_000).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  console.log(`seeded "${project.name}": ${tasks.length} tasks (${lang})`);
  console.log(`the curse comes at about ${at} (in ${curseIn} min). The counting song plays in its last 10 seconds.`);
  console.log("Reload the board, then choose the project from the project menu (P).");
} catch (e) {
  await db.query("ROLLBACK").catch(() => {});
  console.error("failed:", e.message);
  process.exitCode = 1;
} finally {
  await db.end();
}

/* ---------- the demo ledger ---------- */
function demo(now) {
  const MIN = 60_000, H = 60 * MIN, D = 24 * H;
  const L = (en, ja) => (lang === "ja" ? ja : en);
  const REPO = "https://github.com/midnight480/kiroween2026_second";

  const member = (id, name, role, seenAgo) => ({ id: `demo-m-${id}`, name, role, created: now - 6 * D, lastSeen: now - seenAgo });
  const members = [
    member("mio", "Mio", "owner", 2 * MIN),
    member("ren", "Ren", "admin", 40 * MIN),
    member("aoi", "Aoi", "member", 3 * H),
    member("kiro", "Kiro", "member", 5 * MIN),
    member("sora", "Sora", "viewer", 2 * D),
  ];
  const AREA = { design: L("Design", "見た目"), sound: L("Sound", "音"), code: L("Code", "実装"), entry: L("Entry", "提出") };
  const project = {
    id: "demo-kiroween2026",
    name: L("Kiroween 2026 entry", "Kiroween 2026 提出"),
    // newest, so the API's default project (the oldest) stays the person's own
    created: now,
    fields: [
      { id: "demo-f-area", name: L("Area", "領域"), type: "select", options: Object.values(AREA), onCard: true },
      { id: "demo-f-demo", name: L("In the video", "動画に入れる"), type: "checkbox", onCard: true },
    ],
    members,
  };

  let n = 0;
  /**
   * One task. `born` and `due` are relative to now (negative = in the past).
   * The candle's length is (due - now) / (due - created), so `born` sets how much has burnt.
   */
  const task = (o) => {
    n++;
    const t = {
      id: `demo-${String(n).padStart(2, "0")}`,
      projectId: project.id,
      title: o.title,
      ...(o.note ? { note: o.note } : {}),
      ...(o.who ? { assignee: `demo-m-${o.who}` } : {}),
      ...(o.area || o.demo ? { fields: { ...(o.area ? { "demo-f-area": AREA[o.area] } : {}), ...(o.demo ? { "demo-f-demo": true } : {}) } } : {}),
      ...(o.links ? { links: o.links.map((url, i) => ({ id: `demo-l-${n}-${i}`, url })) } : {}),
      created: now + o.born,
      due: Math.floor((now + o.due) / MIN) * MIN,
      status: o.status ?? "todo",
      extended: o.extended ?? 0,
      cursed: o.cursed ?? false,
      penalty: o.penalty ?? 0,
      updated: now,
    };
    if (t.status === "done") {
      t.doneAt = now + o.doneAt;
      if (o.late) t.late = true;
    }
    return t;
  };

  const tasks = [
    /* ---- Done: what is already behind the team ---- */
    task({ status: "done", born: -6 * D, due: -4 * D, doneAt: -5 * D, who: "mio", area: "entry",
      title: L("Pick the idea: every deadline is a candle", "アイデアを決める: 期限は蝋燭"),
      note: L("Costume Contest. A to-do app where fear helps you see what is urgent.", "Costume Contest 部門。怖さで「急ぐもの」が分かるToDo。") }),
    task({ status: "done", born: -5 * D, due: -3 * D, doneAt: -4 * D, who: "kiro", area: "code",
      title: L("Set up Vite + TypeScript and the Worker", "Vite + TypeScript と Worker の土台を作る"),
      links: [REPO] }),
    task({ status: "done", born: -4 * D, due: -2 * D - 6 * H, doneAt: -2 * D + 3 * H, late: true, who: "ren", area: "design",
      title: L("Draw the woman of the curse (never explain her)", "呪いの女を描く (正体は説明しない)"),
      note: L("Finished half a day late. She waited.", "半日遅れて完成。彼女は待っていた。") }),
    task({ status: "done", born: -3 * D, due: -1 * D, doneAt: -1 * D - 5 * H, who: "kiro", area: "code",
      title: L("Deploy to Cloudflare Workers", "Cloudflare Workers に公開する"),
      links: [`${REPO}/pull/12`, "https://tomoshibi.midnight480.com/"] }),

    /* ---- Doing ---- */
    // the jump scare of the video: almost burnt out, the counting song, then the curse
    task({ status: "doing", born: -57 * MIN, due: curseIn * MIN, who: "mio", area: "entry", demo: true,
      title: L("Upload the demo video before the deadline", "締切までにデモ動画を上げる"),
      note: L("Three minutes, not a second more.", "3分以内。1秒も超えない。") }),
    // a haunted candle: the clock says half is left, the wax says otherwise
    task({ status: "doing", born: -1 * D, due: 1 * D, penalty: 0.8 * D, who: "aoi", area: "sound", demo: true,
      title: L("Tune the whisper (it should be barely there)", "囁きの音を調える (聞こえるか聞こえないか)"),
      note: L("The candle looks shorter than the clock says. It was not like this yesterday.", "時計の残りより、蝋燭が短く見える。昨日はこうではなかった。") }),
    task({ status: "doing", born: -2 * D, due: 6 * H, extended: 2, who: "ren", area: "design",
      title: L("Polish the ofuda cards in the light theme", "ライトテーマの御札を仕上げる"),
      links: [`${REPO}/issues/21`, "https://docs.google.com/presentation/d/demo-tomoshibi-style/edit"] }),

    /* ---- To do ---- */
    task({ born: -2 * H, due: 18 * MIN, who: "kiro", area: "code", demo: true,
      title: L("Check the board at 360px on a phone", "スマートフォン (360px) で看板を確かめる") }),
    task({ born: -1 * H, due: 1 * D, who: "mio", area: "entry",
      title: L("Write the Devpost story", "Devpost の説明文を書く"),
      note: L("What it does, how fear helps, how we built it with Kiro.", "何をするか、怖さがどう役立つか、Kiro でどう作ったか。"),
      links: ["https://docs.google.com/document/d/demo-tomoshibi-story/edit", "https://kiroween.devpost.com/"] }),
    task({ born: -3 * H, due: 2 * D, who: "aoi", area: "design",
      title: L("Explain ofuda and mori-shio for the judges", "御札と盛り塩の意味を審査員向けに書く"),
      links: ["https://docs.google.com/spreadsheets/d/demo-tomoshibi-glossary/edit"] }),
    task({ born: -1 * D, due: 3 * D, who: "sora", area: "design",
      title: L("Review Safe mode: no flash, no figure, no loud sound", "Safe mode を見直す (閃光・人影・大音量なし)") }),
    task({ born: -5 * H, due: 12 * H, area: "code",
      title: L("Make the 404 page: spirited away", "404 ページを作る (神隠し)"),
      links: [`${REPO}/issues/34`] }),
    task({ born: -2 * D, due: 4 * D + 6 * H, who: "mio", area: "entry",
      title: L("Submit to Kiroween", "Kiroween に提出する"),
      links: ["https://kiroween.devpost.com/"] }),
    // already out, and the curse already came for it: it only waits, unlit
    task({ born: -1 * D, due: -2 * H, cursed: true, who: "ren", area: "entry",
      title: L("Read the submission rules again", "応募規約を読み直す"),
      note: L("Nobody read it in time.", "誰も間に合わなかった。") }),
  ];
  return { project, tasks };
}
