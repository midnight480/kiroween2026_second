// Step 1: read the narration aloud with macOS `say`, one file per scene, and note how long each is.
//   node video/tts.mjs            -> video/out/audio/<scene>.wav, video/out/durations.json
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const n = JSON.parse(readFileSync("video/narration.json", "utf8"));
mkdirSync("video/out/audio", { recursive: true });
const durations = {};
for (const s of n.scenes) {
  const aiff = `video/out/audio/${s.id}.aiff`;
  const wav = `video/out/audio/${s.id}.wav`;
  execFileSync("say", ["-v", n.voice, "-r", String(n.rate), "-o", aiff, s.text]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", aiff, "-ar", "48000", "-ac", "2", wav]);
  const sec = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wav]).toString());
  // a scene lasts as long as its voice plus a breath, or longer when the picture needs time (hold)
  durations[s.id] = { voice: +sec.toFixed(2), scene: +Math.max(sec + 1.5, s.hold ?? 0).toFixed(2) };
}
writeFileSync("video/out/durations.json", JSON.stringify(durations, null, 2));
let total = 0;
for (const [id, d] of Object.entries(durations)) { total += d.scene; console.log(id.padEnd(12), `voice ${d.voice}s`, `scene ${d.scene}s`); }
console.log(`total ${total.toFixed(1)}s (limit 180s)`);
