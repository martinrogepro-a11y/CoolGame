/**
 * Generative, quantised audio. Every delivery plays a note of a pentatonic scale
 * snapped to an eighth-note grid, so a busy factory turns into a little melody.
 * Everything is synthesised: no audio files to ship or license.
 */

const PENTA = [0, 2, 4, 7, 9];
const BPM = 96;
const EIGHTH = 60 / BPM / 2;
const BASE_HZ = 261.63; // C4

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let wet: GainNode | null = null;
let enabled = true;
let noiseBuf: AudioBuffer | null = null;
const lastSlot = new Map<string, number>();

function ensure(): AudioContext | null {
  if (!enabled) return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    // Cheap stereo-free "room": a filtered feedback delay.
    const delay = ctx.createDelay(1);
    delay.delayTime.value = EIGHTH * 1.5;
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2200;
    wet = ctx.createGain();
    wet.gain.value = 0.35;
    wet.connect(delay);
    delay.connect(lp);
    lp.connect(fb);
    fb.connect(delay);
    lp.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function noteHz(degree: number, octave = 0): number {
  const oct = Math.floor(degree / PENTA.length) + octave;
  const semi = PENTA[((degree % PENTA.length) + PENTA.length) % PENTA.length] + 12 * oct;
  return BASE_HZ * Math.pow(2, semi / 12);
}

function pluck(freq: number, when: number, vel = 0.3, decay = 0.9, type: OscillatorType = 'sine') {
  if (!ctx || !master || !wet) return;
  const o = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  o2.type = 'triangle';
  o2.frequency.value = freq * 2.001;
  const g2 = ctx.createGain();
  g2.gain.value = 0.18;
  o.connect(g);
  o2.connect(g2).connect(g);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(vel, when + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, when + decay);
  g.connect(master);
  g.connect(wet);
  o.start(when);
  o2.start(when);
  o.stop(when + decay + 0.05);
  o2.stop(when + decay + 0.05);
}

function click(when: number, freq: number, vel: number) {
  if (!ctx || !master || !noiseBuf) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = 6;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vel, when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
  src.connect(bp).connect(g).connect(master);
  src.start(when);
  src.stop(when + 0.08);
}

/** Next grid slot time, avoiding piling several identical notes on one slot. */
function quantised(key: string): number | null {
  if (!ctx) return null;
  const now = ctx.currentTime;
  const slot = Math.ceil((now + 0.01) / EIGHTH);
  if (lastSlot.get(key) === slot) return null;
  lastSlot.set(key, slot);
  return slot * EIGHTH;
}

// ------------------------------------------------------------------ ambient music

/** Slow generative pad (Imaj7 - vi7 - IVmaj7 - V6 in C) with sparse pentatonic bells, very quiet. */
const CHORDS = [
  [0, 4, 7, 11],
  [-3, 0, 4, 7],
  [-7, -3, 0, 4],
  [-5, -1, 2, 7],
];
let musicOn = false;
let musicTimer: ReturnType<typeof setTimeout> | null = null;
let musicGain: GainNode | null = null;
let chordIdx = 0;

function semi(n: number, base = BASE_HZ / 2): number {
  return base * Math.pow(2, n / 12);
}

function padChord() {
  if (!ctx || !musicGain || !musicOn) return;
  const t = ctx.currentTime + 0.05;
  const dur = 8;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  lp.connect(musicGain);
  for (const n of CHORDS[chordIdx % CHORDS.length]) {
    for (const det of [-4, 4]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = semi(n);
      o.detune.value = det;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 2.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.5);
      o.connect(g).connect(lp);
      o.start(t);
      o.stop(t + dur + 1.6);
    }
  }
  // Two or three soft bells over the chord.
  for (let k = 0; k < 3; k++) {
    if (Math.random() < 0.35) continue;
    const when = t + 1 + Math.random() * (dur - 2);
    const deg = PENTA[Math.floor(Math.random() * PENTA.length)] + 12;
    pluck(semi(deg + 12), when, 0.035, 2.4);
  }
  chordIdx++;
  musicTimer = setTimeout(padChord, dur * 1000 - 400);
}

export const music = {
  start() {
    if (musicOn || !enabled) return;
    if (!ensure() || !ctx || !master) return;
    musicOn = true;
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.9;
    musicGain.connect(master);
    padChord();
  },
  stop() {
    musicOn = false;
    if (musicTimer) clearTimeout(musicTimer);
    musicTimer = null;
    if (musicGain && ctx) {
      const g = musicGain;
      g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.6);
      setTimeout(() => g.disconnect(), 3000);
    }
    musicGain = null;
  },
  get playing() {
    return musicOn;
  },
};

export const audio = {
  setEnabled(v: boolean) {
    enabled = v;
    if (!v) music.stop();
    if (!v && ctx) void ctx.suspend();
    if (v && ctx) void ctx.resume();
  },
  /** Must be called from a user gesture once (iOS/Android autoplay policy). */
  unlock() {
    ensure();
  },
  deliver(color: number, combo: number) {
    if (!ensure()) return;
    const degree = [0, 2, 4, 1, 3][color] + Math.min(combo - 1, 9);
    const t = quantised(`d${degree}`);
    if (t !== null) pluck(noteHz(degree), t, 0.22 + Math.min(combo, 8) * 0.01, 1.1);
  },
  /** Digging a canal section: a soft water "bloop" (sine with a quick downward glide). */
  place() {
    if (!ensure() || !ctx || !master) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f = 420 + Math.random() * 160;
    o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 1.9, t + 0.05);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.14);
  },
  erase() {
    if (!ensure() || !ctx) return;
    click(ctx.currentTime, 700, 0.14);
  },
  denied() {
    if (!ensure() || !ctx) return;
    pluck(noteHz(-5), ctx.currentTime, 0.12, 0.25, 'triangle');
  },
  spawn(color: number) {
    if (!ensure()) return;
    const t = quantised('spawn');
    if (t !== null) pluck(noteHz([0, 2, 4, 1, 3][color], -1), t, 0.12, 1.6);
  },
  week() {
    if (!ensure() || !ctx) return;
    const t = ctx.currentTime + 0.02;
    [0, 2, 4, 5, 7].forEach((d, k) => pluck(noteHz(d), t + k * EIGHTH * 0.5, 0.18, 1.6));
  },
  warn() {
    if (!ensure() || !ctx) return;
    const t = ctx.currentTime;
    pluck(noteHz(-3), t, 0.2, 0.5, 'triangle');
    pluck(noteHz(-4), t + 0.18, 0.2, 0.7, 'triangle');
  },
  over() {
    if (!ensure() || !ctx) return;
    const t = ctx.currentTime + 0.05;
    [4, 2, 1, 0, -1].forEach((d, k) => pluck(noteHz(d), t + k * 0.16, 0.18, 1.8));
  },
  tap() {
    if (!ensure() || !ctx) return;
    click(ctx.currentTime, 2600, 0.08);
  },
  /** Water rushing into a finished canal: a filtered noise swell under the note. */
  flow(color: number, index: number) {
    if (!ensure() || !ctx || !master || !noiseBuf) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = 0.6;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(400, t);
    bp.frequency.exponentialRampToValueAtTime(1600, t + 0.35);
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    src.connect(bp).connect(g).connect(master);
    src.start(t);
    src.stop(t + 0.5);
    const deg = [0, 2, 4, 1, 3][color % 5] + index;
    pluck(noteHz(deg), t + 0.12, 0.2, 1.4);
  },
  /** The mosaic appearing: a rising pentatonic run, then a chord. */
  reveal(duration = 1.4) {
    if (!ensure() || !ctx) return;
    const t = ctx.currentTime + 0.05;
    const steps = 10;
    for (let k = 0; k < steps; k++) pluck(noteHz(k + 2), t + (k / steps) * duration, 0.12 + k * 0.006, 1.2);
    [0, 4, 7, 12].forEach((d) => pluck(BASE_HZ * Math.pow(2, d / 12), t + duration + 0.05, 0.12, 2.6));
  },
  reward() {
    if (!ensure() || !ctx) return;
    const t = ctx.currentTime + 0.02;
    [0, 4, 7, 9, 12].forEach((d, k) => pluck(noteHz(d), t + k * 0.07, 0.16, 1.2));
  },
};
