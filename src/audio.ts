// All sound is synthesized with Web Audio. No audio assets.
let ctx: AudioContext | null = null;
let master: GainNode;
let noiseBuf: AudioBuffer;
let muted = false;
let droneNodes: { stop: () => void } | null = null;

export function initAudio(): void {
  if (ctx) {
    void ctx.resume();
    return;
  }
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.7;
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  startRoomTone();
}

export function setMuted(m: boolean): void {
  muted = m;
  if (ctx) master.gain.setTargetAtTime(m ? 0 : 0.7, ctx.currentTime, 0.05);
}

function noise(dur: number, type: BiquadFilterType, freq: number, q: number, vol: number, attack = 0.01) {
  if (!ctx) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
}

function startRoomTone() {
  if (!ctx) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 160;
  const g = ctx.createGain();
  g.gain.value = 0.05;
  src.connect(f).connect(g).connect(master);
  src.start();
}

/** Paper / cloth rustle. intensity 0..1 */
export function rustle(intensity = 0.5): void {
  const v = 0.05 + intensity * 0.25;
  noise(0.12 + Math.random() * 0.12, "bandpass", 2500 + Math.random() * 3000, 0.9, v, 0.015);
}

export function whisper(): void {
  if (!ctx) return;
  const dur = 2.2 + Math.random();
  noise(dur, "bandpass", 1800 + Math.random() * 800, 6, 0.09, dur * 0.45);
  noise(dur, "bandpass", 3100 + Math.random() * 500, 8, 0.05, dur * 0.5);
}

export function candleOut(): void {
  noise(0.7, "highpass", 3500, 0.5, 0.18, 0.02);
}

export function thud(vol = 0.6): void {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const t = ctx.currentTime;
  o.frequency.setValueAtTime(90, t);
  o.frequency.exponentialRampToValueAtTime(30, t + 0.4);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.55);
}

export function heartbeat(times: number, bpm = 60): void {
  for (let i = 0; i < times; i++) {
    setTimeout(() => thud(0.35), (i * 60000) / bpm);
    setTimeout(() => thud(0.2), (i * 60000) / bpm + 180);
  }
}

export function bloodSound(): void {
  noise(4, "lowpass", 500, 1, 0.35, 1.5);
}

/** Low unsettling drone that rises. Returns nothing; call stopDrone(). */
export function startDrone(): void {
  if (!ctx || droneNodes) return;
  const t = ctx.currentTime;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.25, t + 8);
  g.connect(master);
  const oscs = [55, 58.3, 82.4, 233].map((f, i) => {
    const o = ctx!.createOscillator();
    o.type = i === 3 ? "sine" : "sawtooth";
    o.frequency.value = f;
    const og = ctx!.createGain();
    og.gain.value = i === 3 ? 0.04 : 0.12;
    const lp = ctx!.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(120, t);
    lp.frequency.exponentialRampToValueAtTime(900, t + 8);
    o.connect(og).connect(lp).connect(g);
    o.start(t);
    return o;
  });
  droneNodes = {
    stop: () => {
      const n = ctx!.currentTime;
      g.gain.cancelScheduledValues(n);
      g.gain.setValueAtTime(g.gain.value, n);
      g.gain.exponentialRampToValueAtTime(0.0001, n + 0.15);
      oscs.forEach((o) => o.stop(n + 0.2));
    },
  };
}

export function stopDrone(): void {
  droneNodes?.stop();
  droneNodes = null;
}

/** The sudden hit when she lunges. */
export function lunge(): void {
  if (!ctx) return;
  const t = ctx.currentTime;
  noise(0.9, "bandpass", 1800, 0.6, 0.9, 0.005);
  thud(1);
  const o = ctx.createOscillator();
  o.type = "sawtooth";
  const g = ctx.createGain();
  o.frequency.setValueAtTime(1400, t);
  o.frequency.exponentialRampToValueAtTime(180, t + 0.9);
  g.gain.setValueAtTime(0.35, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 1.05);
}

/** Paper catching fire: a soft whoosh and a few crackles. Used when a task is burned (deleted). */
export function burn(): void {
  if (!ctx) return;
  noise(1.1, "lowpass", 900, 0.7, 0.16, 0.25);
  for (let i = 0; i < 6; i++) {
    setTimeout(() => noise(0.04, "bandpass", 2500 + Math.random() * 2500, 2, 0.12 + Math.random() * 0.1, 0.003), 120 + Math.random() * 900);
  }
}
