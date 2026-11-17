import * as audio from "./audio";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// seeded PRNG so the figure is stable between frames
function mulberry(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Strand { r: number; side: number; spread: number; sway: number; phase: number; w: number; len: number }

function makeStrands(): Strand[] {
  const rnd = mulberry(1983);
  const s: Strand[] = [];
  for (let i = 0; i < 520; i++) {
    const r = rnd() * 2 - 1;
    // the middle is left open except for a few strands that cross the face
    const crossing = Math.abs(r) < 0.28 && rnd() > 0.1;
    if (crossing) continue;
    s.push({ r, side: r < 0 ? -1 : 1, spread: 0.55 + rnd() * 0.9, sway: 4 + rnd() * 14, phase: rnd() * 6.28, w: 1.5 + rnd() * 3.5, len: 0.9 + rnd() * 0.2 });
  }
  return s;
}

function drawFigure(c: CanvasRenderingContext2D, w: number, h: number, t: number, strands: Strand[], approach: number) {
  c.fillStyle = "#07090a";
  c.fillRect(0, 0, w, h);
  // dim room: a doorway of sickly light behind her
  const g = c.createRadialGradient(w / 2, h * 0.45, 10, w / 2, h * 0.45, h * 0.9);
  g.addColorStop(0, "#2a3330");
  g.addColorStop(1, "#050606");
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);

  c.save();
  const s = 0.45 + approach * 0.95;
  const cx = w / 2 + Math.sin(t * 0.9) * 6 * approach;
  const cy = h * 0.5;
  c.translate(cx, cy);
  c.scale(s, s);
  c.rotate(Math.sin(t * 0.5) * 0.03 + approach * 0.08);
  c.translate(0, -h * 0.05);

  const H = h;
  const faceW = H * 0.14, faceH = H * 0.2, faceY = 0;
  const top = -H * 0.2;

  // white garment
  c.fillStyle = "#cfcabc";
  c.beginPath();
  c.moveTo(-faceW * 1.9, H * 0.5);
  c.quadraticCurveTo(-faceW * 1.6, faceH * 0.9, 0, faceH * 0.75);
  c.quadraticCurveTo(faceW * 1.6, faceH * 0.9, faceW * 1.9, H * 0.5);
  c.fill();

  // face (pale, only seen through the gap)
  c.fillStyle = "#b9b8ac";
  c.beginPath();
  c.ellipse(0, faceY, faceW, faceH, 0, 0, Math.PI * 2);
  c.fill();
  // shadow over the upper face
  const sh = c.createLinearGradient(0, -faceH, 0, faceH);
  sh.addColorStop(0, "#000d"); sh.addColorStop(0.45, "#0000"); sh.addColorStop(1, "#0008");
  c.fillStyle = sh;
  c.fill();

  // one eye, wide open
  const ex = faceW * 0.16, ey = -faceH * 0.08;
  c.fillStyle = "#050505";
  c.beginPath(); c.ellipse(ex, ey, faceW * 0.3, faceW * 0.2, 0, 0, 6.3); c.fill();
  c.fillStyle = "#e9e6da";
  c.beginPath(); c.ellipse(ex, ey, faceW * 0.2, faceW * 0.12, 0, 0, 6.3); c.fill();
  c.fillStyle = "#000";
  const look = Math.sin(t * 0.7) * 0.02;
  c.beginPath(); c.arc(ex + faceW * look * 3, ey, faceW * 0.055, 0, 6.3); c.fill();
  // mouth: a thin dark line, not quite straight
  c.strokeStyle = "#2a1414"; c.lineWidth = 2;
  c.beginPath(); c.moveTo(-faceW * 0.25, faceH * 0.55); c.quadraticCurveTo(0, faceH * 0.6 + Math.sin(t) * 1.5, faceW * 0.3, faceH * 0.5); c.stroke();

  // hair strands
  c.lineCap = "round";
  for (const st of strands) {
    const sway = Math.sin(t * 0.8 + st.phase) * st.sway;
    const x0 = st.r * faceW * 0.9;
    const xs = st.side * (faceW * (0.9 + st.spread * 0.55)) + sway * 0.4;
    c.strokeStyle = `rgba(4,4,5,${0.75 + (st.w - 1.5) * 0.06})`;
    c.lineWidth = st.w * (H / 600);
    c.beginPath();
    c.moveTo(x0, top);
    c.bezierCurveTo(xs * 1.25, top + faceH * 0.5, xs, faceY + faceH * 0.5, xs + sway, H * 0.5 * st.len);
    c.stroke();
  }
  c.restore();
}

function drawStatic(c: CanvasRenderingContext2D, w: number, h: number, alpha: number) {
  const sw = 160, sh = Math.max(90, Math.round((160 * h) / w));
  const off = (drawStatic as unknown as { off?: HTMLCanvasElement }).off ?? document.createElement("canvas");
  (drawStatic as unknown as { off?: HTMLCanvasElement }).off = off;
  off.width = sw; off.height = sh;
  const o = off.getContext("2d")!;
  const img = o.createImageData(sw, sh);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  o.putImageData(img, 0, 0);
  c.save();
  c.globalAlpha = alpha;
  c.imageSmoothingEnabled = false;
  c.drawImage(off, 0, 0, w, h);
  c.restore();
}

export async function playCurse(taskTitle: string, safe: boolean): Promise<void> {
  const root = document.getElementById("curse")!;
  root.innerHTML = "";
  root.hidden = false;
  root.style.background = "#000";

  const canvas = document.createElement("canvas");
  const blood = document.createElement("div"); blood.className = "blood";
  const flash = document.createElement("div"); flash.className = "flash";
  const text = document.createElement("div"); text.className = "text";
  text.innerHTML = `<b>遅かったね</b><small>${taskTitle.replace(/[<>&]/g, "")}</small>`;
  const scan = document.createElement("div"); scan.className = "scan";
  root.append(canvas, scan, blood, flash, text);

  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const w = (canvas.width = Math.floor(innerWidth * dpr));
  const h = (canvas.height = Math.floor(innerHeight * dpr));
  const c = canvas.getContext("2d")!;
  const strands = makeStrands();

  // 1. The room goes quiet. Silence is part of it.
  audio.candleOut();
  root.style.transition = "none";
  await wait(1800);

  // 2. Blood runs down from the top.
  audio.bloodSound();
  const N = 22;
  for (let i = 0; i < N; i++) {
    const col = document.createElement("div");
    col.className = "col";
    const width = 100 / N;
    col.style.left = `${i * width - width * 0.3}%`;
    col.style.width = `${width * (1.4 + Math.random() * 0.8)}%`;
    const dur = 1.4 + Math.random() * 2.6;
    col.style.transition = `height ${dur}s cubic-bezier(.45,0,.75,.55) ${Math.random() * 0.8}s`;
    blood.appendChild(col);
  }
  void blood.offsetHeight;
  blood.querySelectorAll<HTMLElement>(".col").forEach((el) => (el.style.height = "125%"));
  await wait(4600);

  if (safe) {
    // Safe mode: no figure, no flash. Only the blood and the words.
    blood.classList.add("drain");
    text.style.opacity = "1";
    await wait(5000);
    await fadeOut(root);
    return;
  }

  // 3. Under the blood, the cut. She is already there, far away.
  audio.startDrone();
  audio.heartbeat(8, 52);
  canvas.style.opacity = "1";
  let t0 = performance.now();
  let approach = 0;
  let lunging = false;
  let raf = 0;
  const frame = (now: number) => {
    const t = (now - t0) / 1000;
    drawFigure(c, w, h, t, strands, approach);
    drawStatic(c, w, h, 0.05 + approach * 0.12 + (lunging ? 0.4 : 0));
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  blood.classList.add("drain");
  await wait(2600);

  // 4. She does not run. She just gets closer between each blink of the screen.
  const steps = [0.1, 0.18, 0.3, 0.32, 0.5, 0.52];
  for (const s of steps) {
    approach = s;
    canvas.style.opacity = "1";
    await wait(900 + Math.random() * 900);
    if (Math.random() < 0.6) { canvas.style.opacity = "0"; await wait(110); canvas.style.opacity = "1"; }
  }
  // a long still moment
  await wait(2800);

  // 5. Lunge.
  lunging = true;
  audio.stopDrone();
  audio.lunge();
  approach = 1.6;
  root.classList.add("shake");
  flash.style.opacity = "1";
  await wait(70);
  flash.style.transition = "opacity .5s";
  flash.style.opacity = "0";
  await wait(900);
  root.classList.remove("shake");

  // 6. Black. Nothing is explained.
  canvas.style.opacity = "0";
  cancelAnimationFrame(raf);
  void t0;
  t0 = 0;
  await wait(1400);
  text.style.opacity = "1";
  await wait(4200);
  await fadeOut(root);
}

async function fadeOut(root: HTMLElement) {
  root.style.transition = "opacity 2.2s";
  root.style.opacity = "0";
  await wait(2300);
  root.hidden = true;
  root.style.opacity = "1";
  root.innerHTML = "";
}
