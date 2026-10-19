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

export const audio = {
  setEnabled(v: boolean) {
    enabled = v;
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
  place() {
    if (!ensure() || !ctx) return;
    click(ctx.currentTime, 1800 + Math.random() * 300, 0.12);
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
  reward() {
    if (!ensure() || !ctx) return;
    const t = ctx.currentTime + 0.02;
    [0, 4, 7, 9, 12].forEach((d, k) => pluck(noteHz(d), t + k * 0.07, 0.16, 1.2));
  },
};
