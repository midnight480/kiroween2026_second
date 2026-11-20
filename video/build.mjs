// Step 3: put the scenes and the narration together into one video.
//   node video/build.mjs          -> video/out/tomoshibi-demo.mp4 (1920x1080, H.264 + AAC)
//
// Each scene is cut from its clip (from the moment marked by record.mjs), the narration starts 0.4 s in,
// and a quiet low drone made by ffmpeg runs under everything (no music, no recorded sound).
// The board's own Web Audio is not in the clips: a headless browser records only the picture.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const n = JSON.parse(readFileSync("video/narration.json", "utf8"));
const clips = JSON.parse(readFileSync("video/out/clips.json", "utf8"));
mkdirSync("video/out/seg", { recursive: true });
const ff = (args) => execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], { stdio: "inherit" });

const list = [];
let total = 0;
for (const s of n.scenes) {
  const c = clips[s.id];
  if (!c) throw new Error(`no clip for ${s.id}: run node video/record.mjs ${s.id}`);
  const len = +(c.end - c.start).toFixed(2);
  const out = `video/out/seg/${s.id}.mp4`;
  const fadeOut = Math.max(0, len - 0.4).toFixed(2);
  ff([
    "-ss", String(c.start), "-t", String(len), "-i", c.file,
    "-i", `video/out/audio/${s.id}.wav`,
    "-filter_complex",
    [
      `[0:v]scale=1920:1080:flags=lanczos,fps=30,format=yuv420p,fade=t=in:st=0:d=0.35,fade=t=out:st=${fadeOut}:d=0.4[v]`,
      `[1:a]adelay=400|400,apad,atrim=0:${len}[voice]`,
      // a low, quiet room drone: brown noise through a low-pass filter
      `anoisesrc=color=brown:amplitude=0.5:sample_rate=48000:duration=${len},lowpass=f=180,volume=0.12,aformat=channel_layouts=stereo[drone]`,
      `[voice][drone]amix=inputs=2:duration=first:normalize=0,afade=t=in:st=0:d=0.3,afade=t=out:st=${fadeOut}:d=0.4[a]`,
    ].join(";"),
    "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
    out,
  ]);
  list.push(`file '${s.id}.mp4'`);
  total += len;
  console.log(`${s.id.padEnd(12)} ${len.toFixed(1)}s`);
}
writeFileSync("video/out/seg/list.txt", list.join("\n") + "\n");
ff(["-f", "concat", "-safe", "0", "-i", "video/out/seg/list.txt",
  "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
  "video/out/tomoshibi-demo.mp4"]);
console.log(`total ${total.toFixed(1)}s${total > 180 ? "  OVER 3 MINUTES" : ""} -> video/out/tomoshibi-demo.mp4`);
