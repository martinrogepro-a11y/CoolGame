import { MATERIALS, type Palette } from '../game/content';
import { type Fresco, frescoCells } from '../meta/frescoes';

export interface FrescoDrawOptions {
  /** Tiles laid per material before this draw (already in place). */
  filled: number[];
  /** Extra tiles per material laid "just now", animated in. */
  fresh?: number[];
  /** 0..1 progress of the fresh-tile animation. */
  anim?: number;
  /** Draw every tile as an unlaid hint (locked fresco). */
  hidden?: boolean;
}

function hash(n: number): number {
  n = Math.imul(n ^ 0x5bd1e995, 0x27d4eb2d);
  return ((n ^ (n >>> 15)) >>> 0) / 4294967296;
}

function easeOutBack(t: number): number {
  const u = t - 1;
  return 1 + 2.7 * u * u * u + 1.7 * u * u;
}

/**
 * Draws a fresco as a hand-set mosaic: each tessera slightly offset and rotated,
 * grout showing between them, unlaid cells as faint paint-by-number hints.
 */
export function drawFresco(canvas: HTMLCanvasElement, f: Fresco, pal: Palette, o: FrescoDrawOptions) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const size = canvas.clientWidth || 64;
  if (canvas.width !== Math.round(size * dpr)) {
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
  }
  const g = canvas.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, size, size);
  const n = f.rows.length;
  const pad = size * 0.04;
  const cell = (size - pad * 2) / n;
  // Frame and grout.
  g.fillStyle = pal.canalEdge;
  g.beginPath();
  g.roundRect(0, 0, size, size, size * 0.06);
  g.fill();
  g.fillStyle = pal.dark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.35)';
  g.fillRect(pad, pad, size - pad * 2, size - pad * 2);

  const laid = [0, 0, 0, 0, 0];
  const fresh = o.fresh ?? [0, 0, 0, 0, 0];
  const total = fresh.reduce((a, b) => a + b, 0) || 1;
  let freshIndex = 0;
  for (const c of frescoCells(f)) {
    const k = c.x * 31 + c.y * 977 + n;
    const jx = (hash(k) - 0.5) * cell * 0.1;
    const jy = (hash(k + 1) - 0.5) * cell * 0.1;
    const rot = (hash(k + 2) - 0.5) * 0.18;
    const cx = pad + (c.x + 0.5) * cell + jx;
    const cy = pad + (c.y + 0.5) * cell + jy;
    let scale = 1;
    let color: string;
    let alpha = 1;
    if (c.c < 0) {
      color = pal.dark ? '#3a3f52' : '#efe7da';
      if (o.hidden) alpha = 0.5;
    } else {
      const m = MATERIALS[c.c];
      const already = !o.hidden && laid[c.c] < o.filled[c.c];
      const isFresh = !o.hidden && !already && laid[c.c] < o.filled[c.c] + fresh[c.c];
      laid[c.c]++;
      if (already) color = m.color;
      else if (isFresh) {
        // Staggered pop-in across all fresh tiles.
        const start = (freshIndex++ / total) * 0.7;
        const t = Math.max(0, Math.min(1, ((o.anim ?? 1) - start) / 0.3));
        if (t <= 0) {
          color = m.color;
          alpha = 0.16;
        } else {
          color = m.color;
          scale = easeOutBack(t);
        }
      } else {
        color = o.hidden ? (pal.dark ? '#4a5068' : '#d9cfbf') : m.color;
        alpha = o.hidden ? 0.8 : 0.16;
      }
    }
    const s = cell * 0.86 * scale;
    g.save();
    g.translate(cx, cy);
    g.rotate(rot);
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.beginPath();
    g.roundRect(-s / 2, -s / 2, s, s, s * 0.18);
    g.fill();
    if (alpha === 1 && c.c >= 0 && s > 6) {
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(-s / 2 + s * 0.14, -s / 2 + s * 0.14, s * 0.4, s * 0.16);
    }
    g.restore();
  }
}
