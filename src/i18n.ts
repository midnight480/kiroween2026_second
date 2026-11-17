/**
 * Two languages, no library. Horror words (灯, 遅, うしろ, 遅かったね, the counting song)
 * are not in this file on purpose: they stay Japanese in every language.
 */
export type Lang = "en" | "ja";

const en = {
  docDesc: "A to-do list where every deadline is a candle. Don't let it go out.",
  subtitle: "The Candle Ledger",
  gateWarn: "Every task is a candle. When one goes out, something notices.<br />Contains sudden imagery, blood and loud sound. Headphones recommended.",
  gateEnter: "Light the candle",
  gateSafe: "Safe mode (no flashes, no jump scare)",
  titlePh: "What must be done…",
  burnsFor: "Burns for",
  burn1: "burns 1 min (demo)",
  burn30: "burns 30 min",
  burn120: "burns 2 hours",
  burn1440: "burns 1 day",
  burn4320: "burns 3 days",
  burnCustom: "until…",
  dueAria: "Due date and time",
  addTitle: "Light a new candle",
  emptyMain: "The room is quiet.",
  emptySub1: "Only a child waits here, when there is nothing left to do.",
  emptySub2: "Light a candle.",
  rules: "Do not look behind you. Do not let a candle die alone.",
  rulesTitle: "Rules of the house",
  haunted: "Haunted:",
  putOut: "Put out:",
  putOutTitle: "Candles you put out yourself",
  safe: "Safe mode",
  safeTitle: "No flashes, no figure, no jump scare",
  mute: "Mute",
  lang: "Language",
  theme: "Theme",
  themeSystem: "Auto",
  themeLight: "Light",
  themeDark: "Dark",
  seal: "Hold to peel the seal",
  sealAria: "Hold to peel the seal and finish this task",
  exorcise: "Hold to exorcise",
  exorciseAria: "Hold to exorcise this task",
  tooLate: "too late",
  actRewrite: "Rewrite",
  actRewriteTitle: "Rewrite the title",
  actWax: "Add wax",
  actWaxTitle: "Add wax to burn longer",
  waxPick: "Add wax…",
  wax30: "+30 min",
  wax120: "+2 hours",
  wax1440: "+1 day",
  wax4320: "+3 days",
  actBurn: "Burn",
  actBurnTitle: "Hold to burn this card away. It does not count as finished.",
  cardAria: "Task: {title}. Arrow keys move the card.",
  extinguished: "extinguished",
  fmtDH: "{d}d {h}h",
  fmtHM: "{h}h {m}m",
  fmtMS: "{m}m {s}s",
  fmtS: "{s}s",
  errTitle: "The salt crumbled. Give the candle a name.",
  errPast: "The salt crumbled. That hour is too close, or already gone.",
  errFar: "The salt crumbled. That hour is more than a year away.",
  errLimit: "The room is full. Put a candle out first.",
  errBroken: "The ledger was damaged. The old pages are kept safe.",
  errSave: "Could not write this down. Storage may be full.",
  dueAt: "due {when}",
  undoPutOut: "Candle put out.",
  undoBurned: "Card burned.",
  undoBtn: "Put it back",
  liveOut: "A candle has gone out: {title}",
};

const ja: Record<keyof typeof en, string> = {
  docDesc: "期限がすべて蝋燭になる ToDo。灯を消さないで。",
  subtitle: "灯の帳面",
  gateWarn: "ひとつの用事に、ひとつの灯。灯が消えると、何かが気づく。<br />突然の映像、血、大きな音を含みます。ヘッドホン推奨。",
  gateEnter: "灯をともす",
  gateSafe: "セーフモード(閃光・驚かせる演出なし)",
  titlePh: "なすべきこと…",
  burnsFor: "燃える長さ",
  burn1: "1分燃える(デモ)",
  burn30: "30分燃える",
  burn120: "2時間燃える",
  burn1440: "1日燃える",
  burn4320: "3日燃える",
  burnCustom: "日時を決める…",
  dueAria: "期限の日時",
  addTitle: "新しい灯をともす",
  emptyMain: "部屋は静かだ。",
  emptySub1: "やることがなくなると、ここには子どもが一人だけ待っている。",
  emptySub2: "灯をともして。",
  rules: "うしろを見るな。灯を一人で死なせるな。",
  rulesTitle: "家の掟",
  haunted: "呪い:",
  putOut: "消した灯:",
  putOutTitle: "自分の手で消した灯の数",
  safe: "セーフモード",
  safeTitle: "閃光・人影・驚かせる演出をなくす",
  mute: "消音",
  lang: "言語",
  theme: "表示",
  themeSystem: "自動",
  themeLight: "ライト",
  themeDark: "ダーク",
  seal: "長押しで封を剥がす",
  sealAria: "長押しで封を剥がして、このタスクを完了する",
  exorcise: "長押しでお祓い",
  exorciseAria: "長押しでこのタスクをお祓いする",
  tooLate: "遅すぎた",
  actRewrite: "書き直す",
  actRewriteTitle: "タイトルを書き直す",
  actWax: "蝋を足す",
  actWaxTitle: "蝋を足して、長く燃やす",
  waxPick: "蝋を足す…",
  wax30: "+30分",
  wax120: "+2時間",
  wax1440: "+1日",
  wax4320: "+3日",
  actBurn: "燃やす",
  actBurnTitle: "長押しでこの札を燃やす。完了にはなりません。",
  cardAria: "タスク: {title}。矢印キーでカードを動かせます。",
  extinguished: "燃え尽きた",
  fmtDH: "{d}日 {h}時間",
  fmtHM: "{h}時間 {m}分",
  fmtMS: "{m}分 {s}秒",
  fmtS: "{s}秒",
  errTitle: "塩が崩れた。灯に名を付けて。",
  errPast: "塩が崩れた。その刻は近すぎるか、もう過ぎている。",
  errFar: "塩が崩れた。その刻は一年より先だ。",
  errLimit: "部屋がいっぱいだ。先に灯を一つ消して。",
  errBroken: "帳が傷んでいた。古い頁は取ってある。",
  errSave: "書き留められなかった。保存の空きがないかもしれない。",
  dueAt: "{when} 期限",
  undoPutOut: "灯を消した。",
  undoBurned: "札を焼いた。",
  undoBtn: "灯を戻す",
  liveOut: "灯が消えた: {title}",
};

export type Key = keyof typeof en;
const dict: Record<Lang, Record<Key, string>> = { en, ja };

let lang: Lang = "en";

export function detectLang(): Lang {
  return (navigator.language || "en").toLowerCase().startsWith("ja") ? "ja" : "en";
}
export const getLang = () => lang;

export function t(key: Key, vars?: Record<string, string | number>): string {
  let s = dict[lang][key];
  if (vars) for (const k in vars) s = s.split(`{${k}}`).join(String(vars[k]));
  return s;
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(key: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const k = `${lang}|${key}`;
  let f = fmtCache.get(k);
  if (!f) { f = new Intl.DateTimeFormat(lang === "ja" ? "ja-JP" : "en-US", opts); fmtCache.set(k, f); }
  return f;
}

/** "18:00" today, "Tue 18:00" within a week, "Nov 18 18:00" otherwise. Always from the real deadline. */
export function formatDue(due: number, now = Date.now()): string {
  const d = new Date(due);
  const time = fmt("time", { hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day(d) - day(new Date(now))) / 86_400_000);
  if (days === 0) return time;
  if (days > 0 && days < 7) return `${fmt("wd", { weekday: "short" }).format(d)} ${time}`;
  return `${fmt("md", { month: "short", day: "numeric" }).format(d)} ${time}`;
}

/** Fill every [data-i18n*] element under root. Strings are our own, so innerHTML is safe here. */
export function applyI18n(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((e) => (e.textContent = t(e.dataset.i18n as Key)));
  root.querySelectorAll<HTMLElement>("[data-i18n-html]").forEach((e) => (e.innerHTML = t(e.dataset.i18nHtml as Key)));
  root.querySelectorAll<HTMLElement>("[data-i18n-ph]").forEach((e) => e.setAttribute("placeholder", t(e.dataset.i18nPh as Key)));
  root.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((e) => e.setAttribute("title", t(e.dataset.i18nTitle as Key)));
  root.querySelectorAll<HTMLElement>("[data-i18n-aria]").forEach((e) => e.setAttribute("aria-label", t(e.dataset.i18nAria as Key)));
}

export function setLang(l: Lang): void {
  lang = l;
  document.documentElement.lang = l;
  document.querySelector('meta[name="description"]')?.setAttribute("content", t("docDesc"));
  applyI18n();
}
