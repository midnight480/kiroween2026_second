// Step 3: put the scenes and the narration together into one video.
//   node video/build.mjs          -> video/out/tomoshibi-demo.mp4 (1920x1080, H.264 + AAC)
//
// For each scene of video/narration.json:
//   clip   which recording to cut from (default: the scene's own id)
//   range  [from, to] in seconds from the moment record.mjs marked; also "curse-8", "curseEnd+1.8"
//          (times record.mjs stamped)
//   cuts   [[from, to], ...] taken out of the range (same notation)
// Close-ups recorded by record.mjs (zoom) become cuts to a crop of the card, kept at 16:9.
// The narration starts 0.4 s in; a quiet low drone made by ffmpeg runs under everything.
// The board's own Web Audio is not in the clips: a headless browser records only the picture.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const n = JSON.parse(readFileSync("video/narration.json", "utf8"));
const clips = JSON.parse(readFileSync("video/out/clips.json", "utf8"));
const durations = JSON.parse(readFileSync("video/out/durations.json", "utf8"));
mkdirSync("video/out/seg", { recursive: true });
const ff = (args) => execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], { stdio: "inherit" });
const VW = 1440, VH = 810;   // the recording
const MIN_W = 600;           // the closest close-up (2.4x)

/** "curse-8" -> the stamped time of "curse" minus 8. Numbers pass through. */
function time(v, c) {
  if (typeof v === "number") return v;
  const m = /^(\w+)([+-][\d.]+)?$/.exec(v);
  if (!m || c.marks?.[m[1]] === undefined) throw new Error(`unknown time "${v}"`);
  return c.marks[m[1]] + Number(m[2] ?? 0);
}

/** A 16:9 crop around the box, inside the frame. */
function crop([x, y, w, h]) {
  let cw = Math.max(MIN_W, w, h * 16 / 9);
  cw = Math.min(cw, VW);
  const ch = cw * 9 / 16;
  const cx = Math.min(Math.max(x + w / 2 - cw / 2, 0), VW - cw);
  const cy = Math.min(Math.max(y + h / 2 - ch / 2, 0), VH - ch);
  const even = (v) => Math.round(v / 2) * 2;
  return `crop=${even(cw)}:${even(ch)}:${even(cx)}:${even(cy)}`;
}

/** The pieces of a scene: kept parts of the range, split where a close-up begins or ends. */
function pieces(s, c) {
  const [a, b] = s.range ? s.range.map((v) => time(v, c)) : [0, c.end - c.start];
  let keep = [[a, b]];
  for (const [f, t] of (s.cuts ?? []).map(([f, t]) => [time(f, c), time(t, c)])) {
    keep = keep.flatMap(([x, y]) => (t <= x || f >= y ? [[x, y]] : [[x, f], [t, y]].filter(([p, q]) => q - p > 0.05)));
  }
  const zooms = c.zooms ?? [];
  const out = [];
  for (const [x, y] of keep) {
    const edges = new Set([x, y]);
    for (const z of zooms) for (const e of [z.from, z.to]) if (e > x && e < y) edges.add(e);
    const sorted = [...edges].sort((p, q) => p - q);
    for (let i = 0; i < sorted.length - 1; i++) {
      const [p, q] = [sorted[i], sorted[i + 1]];
      if (q - p < 0.05) continue;
      const z = zooms.find((z) => z.from <= p + 0.01 && z.to >= q - 0.01);
      out.push({ from: p, to: q, crop: z ? crop(z.box) : null });
    }
  }
  return out;
}

const list = [];
let total = 0;
for (const s of n.scenes) {
  const c = clips[s.clip ?? s.id];
  if (!c) throw new Error(`no clip for ${s.id}: run node video/record.mjs ${s.clip ?? s.id}`);
  const ps = pieces(s, c);
  const len = +ps.reduce((sum, p) => sum + p.to - p.from, 0).toFixed(2);
  if (len < durations[s.id].voice + 0.5) console.warn(`  ${s.id}: the picture (${len}s) is shorter than the voice (${durations[s.id].voice}s)`);
  const fadeOut = Math.max(0, len - 0.4).toFixed(2);
  const v = ps.map((p, i) =>
    `[src${i}]trim=start=${(c.start + p.from).toFixed(3)}:end=${(c.start + p.to).toFixed(3)},setpts=PTS-STARTPTS,` +
    `${p.crop ? p.crop + "," : ""}scale=1920:1080:flags=lanczos,setsar=1,fps=30[p${i}]`);
  const graph = [
    `[0:v]split=${ps.length}${ps.map((_, i) => `[src${i}]`).join("")}`,
    ...v,
    `${ps.map((_, i) => `[p${i}]`).join("")}concat=n=${ps.length}:v=1:a=0,format=yuv420p,fade=t=in:st=0:d=0.35,fade=t=out:st=${fadeOut}:d=0.4[v]`,
    `[1:a]adelay=400|400,apad,atrim=0:${len}[voice]`,
    `anoisesrc=color=brown:amplitude=0.5:sample_rate=48000:duration=${len},lowpass=f=180,volume=0.12,aformat=channel_layouts=stereo[drone]`,
    `[voice][drone]amix=inputs=2:duration=first:normalize=0,afade=t=in:st=0:d=0.3,afade=t=out:st=${fadeOut}:d=0.4[a]`,
  ].join(";");
  const out = `video/out/seg/${s.id}.mp4`;
  ff(["-i", c.file, "-i", `video/out/audio/${s.id}.wav`, "-filter_complex", graph, "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", out]);
  list.push(`file '${s.id}.mp4'`);
  total += len;
  console.log(`${s.id.padEnd(12)} ${len.toFixed(1)}s  ${ps.filter((p) => p.crop).length} close-up(s)`);
}
writeFileSync("video/out/seg/list.txt", list.join("\n") + "\n");
ff(["-f", "concat", "-safe", "0", "-i", "video/out/seg/list.txt",
  "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
  "video/out/tomoshibi-demo.mp4"]);
console.log(`total ${total.toFixed(1)}s${total > 180 ? "  OVER 3 MINUTES" : ""} -> video/out/tomoshibi-demo.mp4`);
