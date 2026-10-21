import { audioCore } from './audio';

/**
 * Soundscape of each place, fully synthesised (no files, no licences), like the ambient
 * beds of Alto's Odyssey or Monument Valley: a continuous bed (breeze, swell, murmur, the
 * deep's rumble) plus sparse, randomly timed events (birds, gulls, bells, crickets,
 * bubbles), so it never loops audibly. Kept well under the music and the game sounds.
 */

export type Place = 'garden' | 'harbour' | 'market' | 'night' | 'deep';

let current: Place | null = null;
let bus: GainNode | null = null;
let timers: ReturnType<typeof setTimeout>[] = [];
let sources: AudioScheduledSourceNode[] = [];
let noise: AudioBuffer | null = null;
let volume = 1;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noise) return noise;
  noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
  const d = noise.getChannelData(0);
  // Pinkish noise (Paul Kellet's economy filter): softer than white noise.
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
  }
  return noise;
}

/** A continuous filtered-noise bed whose loudness drifts with a slow LFO (wind, swell, crowd). */
function bed(ctx: AudioContext, out: AudioNode, type: BiquadFilterType, freq: number, q: number, level: number, lfoHz: number, depth: number) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  src.loopStart = rand(0, 1);
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = level;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = lfoHz;
  const lg = ctx.createGain();
  lg.gain.value = level * depth;
  lfo.connect(lg).connect(g.gain);
  src.connect(f).connect(g).connect(out);
  src.start(ctx.currentTime, rand(0, 2));
  lfo.start();
  sources.push(src, lfo);
}

/** A tone with a pitch contour (Hz points over `dur` s) and a soft envelope. */
function tone(ctx: AudioContext, out: AudioNode, when: number, dur: number, pts: number[], vel: number, type: OscillatorType = 'sine', vib = 0) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(pts[0], when);
  pts.slice(1).forEach((p, k) => o.frequency.exponentialRampToValueAtTime(p, when + (dur * (k + 1)) / (pts.length - 1)));
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(vel, when + Math.min(0.03, dur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  if (vib) {
    const l = ctx.createOscillator();
    l.frequency.value = vib;
    const lg = ctx.createGain();
    lg.gain.value = pts[0] * 0.03;
    l.connect(lg).connect(o.frequency);
    l.start(when);
    l.stop(when + dur);
  }
  o.connect(g).connect(out);
  o.start(when);
  o.stop(when + dur + 0.05);
}

/** A struck bell: a few inharmonic partials with long decays. */
function bell(ctx: AudioContext, out: AudioNode, when: number, hz: number, vel: number) {
  [1, 2.01, 2.76, 5.4].forEach((m, k) => tone(ctx, out, when, 3.5 / (k + 1), [hz * m, hz * m * 0.999], vel / (k + 1.5)));
}

/** Calls `fn` again and again at random intervals while the place is playing. */
function every(min: number, max: number, fn: (ctx: AudioContext, out: AudioNode, t: number) => void) {
  const place = current;
  const loop = () => {
    const core = audioCore();
    if (!core || !bus || current !== place) return;
    fn(core.ctx, bus, core.ctx.currentTime + 0.05);
    timers.push(setTimeout(loop, rand(min, max) * 1000));
  };
  timers.push(setTimeout(loop, rand(min, max) * 500));
}

const PLACES: Record<Place, (ctx: AudioContext, out: AudioNode) => void> = {
  garden(ctx, out) {
    bed(ctx, out, 'lowpass', 600, 0.5, 0.05, 0.08, 0.6); // breeze in the leaves
    bed(ctx, out, 'bandpass', 3200, 1.5, 0.012, 0.9, 0.5); // the fountain trickling
    every(1.2, 4.5, (c, o, t) => {
      // A little bird: two to five quick chirps.
      const base = rand(2600, 3800);
      const n = 2 + Math.floor(Math.random() * 4);
      for (let k = 0; k < n; k++) tone(c, o, t + k * rand(0.08, 0.14), 0.07, [base, base * rand(1.1, 1.35), base * 0.95], 0.03);
    });
  },
  harbour(ctx, out) {
    bed(ctx, out, 'lowpass', 700, 0.6, 0.09, 0.13, 0.85); // the swell breaking on the quay
    bed(ctx, out, 'lowpass', 260, 0.7, 0.05, 0.07, 0.5);
    every(4, 11, (c, o, t) => {
      // A gull: a few falling, slightly rough cries.
      const n = 2 + Math.floor(Math.random() * 3);
      const f = rand(1100, 1500);
      for (let k = 0; k < n; k++) tone(c, o, t + k * 0.32, 0.26, [f, f * 1.15, f * 0.7], 0.02, 'sawtooth', 18);
    });
    every(14, 30, (c, o, t) => bell(c, o, t, 520, 0.02)); // a mooring bell
  },
  market(ctx, out) {
    // The murmur of a busy square: several bands of voices rising and falling.
    bed(ctx, out, 'bandpass', 420, 1.2, 0.05, 0.21, 0.7);
    bed(ctx, out, 'bandpass', 900, 1.4, 0.03, 0.33, 0.8);
    bed(ctx, out, 'bandpass', 1700, 2, 0.012, 0.47, 0.8);
    every(0.8, 3, (c, o, t) => {
      // Crates, cups and coins: a short wooden or glassy knock.
      const glass = Math.random() < 0.3;
      tone(c, o, t, glass ? 0.25 : 0.06, [glass ? rand(2400, 3200) : rand(300, 500)], glass ? 0.012 : 0.03, glass ? 'sine' : 'triangle');
    });
    every(18, 35, (c, o, t) => [0, 0.9, 1.8].forEach((d, k) => bell(c, o, t + d, [392, 330, 262][k], 0.02))); // the bell tower
  },
  night(ctx, out) {
    bed(ctx, out, 'lowpass', 380, 0.5, 0.035, 0.05, 0.6); // a warm night breeze
    every(0.6, 1.6, (c, o, t) => {
      // Crickets: a train of very short pulses.
      const f = rand(4200, 4800);
      for (let k = 0; k < 3; k++) tone(c, o, t + k * 0.045, 0.03, [f], 0.008);
    });
    every(16, 34, (c, o, t) => {
      // A distant owl.
      tone(c, o, t, 0.45, [420, 400], 0.03);
      tone(c, o, t + 0.6, 0.7, [400, 380, 360], 0.025);
    });
  },
  deep(ctx, out) {
    bed(ctx, out, 'lowpass', 180, 0.8, 0.12, 0.06, 0.6); // the muffled rumble of the sea
    bed(ctx, out, 'lowpass', 420, 0.5, 0.03, 0.11, 0.7);
    every(0.7, 2.8, (c, o, t) => {
      // Bubbles: quick rising blips, in small bursts.
      const n = 1 + Math.floor(Math.random() * 4);
      for (let k = 0; k < n; k++) {
        const f = rand(300, 700);
        tone(c, o, t + k * rand(0.05, 0.15), 0.08, [f, f * 2.4], 0.025);
      }
    });
    every(20, 40, (c, o, t) => tone(c, o, t, 3.5, [220, 260, 200], 0.012, 'sine', 3)); // a far-away whale song
  },
};

export const ambience = {
  /** Fades in the soundscape of `place` (no-op if it is already playing). */
  play(place: Place) {
    if (current === place) return;
    this.stop();
    const core = audioCore();
    if (!core) return;
    const { ctx, master } = core;
    current = place;
    bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    bus.gain.exponentialRampToValueAtTime(0.9 * volume + 0.0001, ctx.currentTime + 2.5);
    bus.connect(master);
    PLACES[place](ctx, bus);
  },
  stop() {
    timers.forEach(clearTimeout);
    timers = [];
    current = null;
    const core = audioCore();
    const g = bus, src = sources;
    bus = null;
    sources = [];
    if (!g || !core) return;
    g.gain.setTargetAtTime(0.0001, core.ctx.currentTime, 0.5);
    setTimeout(() => {
      src.forEach((s) => {
        try {
          s.stop();
        } catch {
          /* already stopped */
        }
      });
      g.disconnect();
    }, 2500);
  },
  /** Quieter on menus, full in a level. */
  setVolume(v: number) {
    if (v === volume) return;
    volume = v;
    const core = audioCore();
    if (bus && core) bus.gain.setTargetAtTime(0.9 * v + 0.0001, core.ctx.currentTime, 0.4);
  },
  get place() {
    return current;
  },
};
