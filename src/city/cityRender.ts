import { Rng } from '../core/rng';
import { MATERIALS, type Palette } from '../game/content';
import { landmarkById, type Prim } from '../meta/landmarks';

/**
 * Isometric diorama of the player's city. Everything is procedural:
 * houses grow with lifetime tesserae, landmarks are built with them.
 */

const N = 11; // tiles per side
const BLOCK = 4; // 3 tiles + 1 street

interface Placed {
  x: number;
  y: number;
  shape: Prim[];
  order: number;
  kind: 'house' | 'landmark' | 'tree';
  id?: string;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shade(hex: string, f: number): string {
  const [r, g, b] = hexToRgb(hex);
  const k = (v: number) => Math.round(Math.max(0, Math.min(255, f >= 0 ? v + (255 - v) * f : v * (1 + f))));
  return `rgb(${k(r)},${k(g)},${k(b)})`;
}

export function isStreet(x: number, y: number): boolean {
  return x % BLOCK === 3 || y % BLOCK === 3;
}

/** Deterministic tile order from the centre outwards. */
function tilesByDistance(): { x: number; y: number }[] {
  const tiles: { x: number; y: number }[] = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!isStreet(x, y)) tiles.push({ x, y });
  const c = (N - 1) / 2;
  const rng = new Rng(77);
  const jitter = tiles.map(() => rng.next() * 0.6);
  return tiles
    .map((t, i) => ({ t, d: Math.hypot(t.x - c, t.y - c) + jitter[i] }))
    .sort((a, b) => a.d - b.d)
    .map((e) => e.t);
}

const ORDER = tilesByDistance();

/** Layout of the city given lifetime tesserae and built landmarks. */
export function layoutCity(lifetime: number, built: string[]): Placed[] {
  const used = new Set<string>();
  const key = (x: number, y: number) => `${x},${y}`;
  const placed: Placed[] = [];

  // Landmarks claim the 2x2 corner of a block (size 2) or a single tile.
  for (const id of built) {
    const l = landmarkById(id);
    if (!l) continue;
    for (const t of ORDER) {
      const fits: { x: number; y: number }[] = [];
      for (let dy = 0; dy < l.size; dy++) for (let dx = 0; dx < l.size; dx++) fits.push({ x: t.x + dx, y: t.y + dy });
      if (fits.every((f) => f.x < N && f.y < N && !isStreet(f.x, f.y) && !used.has(key(f.x, f.y)))) {
        fits.forEach((f) => used.add(key(f.x, f.y)));
        placed.push({ x: t.x, y: t.y, shape: l.shape, order: t.x + t.y + l.size * 2 - 1, kind: 'landmark', id });
        break;
      }
    }
  }

  const houses = Math.min(ORDER.length, Math.floor(lifetime / 12));
  let n = 0;
  for (const t of ORDER) {
    if (used.has(key(t.x, t.y))) continue;
    const rng = new Rng(t.x * 131 + t.y * 977 + 5);
    if (n < houses) {
      n++;
      const h = 0.35 + rng.next() * 0.55 + (n > 40 ? 0.3 : 0);
      const roofColor = rng.int(0, 5);
      const wide = rng.next() < 0.5;
      const w = wide ? 0.7 : 0.55, d = wide ? 0.55 : 0.7;
      const ox = (1 - w) / 2, oy = (1 - d) / 2;
      const flat = rng.next() < 0.3;
      const shape: Prim[] = [{ k: 'box', x: t.x + ox, y: t.y + oy, w, d, h, c: 6 }];
      if (flat) shape.push({ k: 'box', x: t.x + ox - 0.03, y: t.y + oy - 0.03, w: w + 0.06, d: d + 0.06, h: 0.06, z: h, c: roofColor });
      else shape.push({ k: 'roof', x: t.x + ox - 0.04, y: t.y + oy - 0.04, w: w + 0.08, d: d + 0.08, h: 0.28, z: h, c: roofColor });
      placed.push({ x: t.x, y: t.y, shape, order: t.x + t.y + 1, kind: 'house' });
    } else if (rng.next() < 0.45) {
      const r = 0.14 + rng.next() * 0.1;
      const cx = t.x + 0.3 + rng.next() * 0.4, cy = t.y + 0.3 + rng.next() * 0.4;
      placed.push({
        x: t.x, y: t.y, order: t.x + t.y + 1, kind: 'tree',
        shape: [
          { k: 'cyl', x: cx, y: cy, r: 0.04, h: 0.12, c: 7 },
          { k: 'cone', x: cx, y: cy, r, h: r * 3, z: 0.1, c: 8 },
        ],
      });
    }
  }
  return placed.sort((a, b) => a.order - b.order);
}

function materialColor(c: number, night: number): string {
  let hex: string;
  if (c < 5) hex = MATERIALS[c].color;
  else if (c === 5) hex = '#CFC5B4';
  else if (c === 6) hex = '#F6F1E8';
  else if (c === 7) hex = '#57505A';
  else hex = '#7DB08C';
  return night > 0 ? shade(hex, -0.3 * night) : hex;
}

function drawPrim(g: CanvasRenderingContext2D, pr: Prim, P: (x: number, y: number, z?: number) => [number, number], tw: number, th: number, tz: number, night: number, lift: number) {
  const base = materialColor(pr.c, night);
  const top = shade(base, 0.12);
  const right = shade(base, -0.18);
  const left = shade(base, -0.05);
  const z0 = (pr.z ?? 0) + lift;
  const poly = (pts: [number, number][], fill: string) => {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  };
  switch (pr.k) {
    case 'box': {
      const { x, y, w, d, h } = pr;
      const z1 = z0 + h;
      poly([P(x, y + d, z0), P(x + w, y + d, z0), P(x + w, y + d, z1), P(x, y + d, z1)], left);
      poly([P(x + w, y, z0), P(x + w, y + d, z0), P(x + w, y + d, z1), P(x + w, y, z1)], right);
      poly([P(x, y, z1), P(x + w, y, z1), P(x + w, y + d, z1), P(x, y + d, z1)], top);
      break;
    }
    case 'roof': {
      const { x, y, w, d, h } = pr;
      const r = z0 + h;
      poly([P(x, y, z0), P(x + w, y, z0), P(x + w, y + d / 2, r), P(x, y + d / 2, r)], top);
      poly([P(x + w, y, z0), P(x + w, y + d, z0), P(x + w, y + d / 2, r)], right);
      poly([P(x, y + d, z0), P(x + w, y + d, z0), P(x + w, y + d / 2, r), P(x, y + d / 2, r)], left);
      break;
    }
    case 'cyl':
    case 'cone':
    case 'dome': {
      const { x, y, r } = pr;
      const rx = (r * tw) / Math.SQRT2;
      const ry = (r * th) / Math.SQRT2;
      const [cx, cyBottom] = P(x, y, z0);
      const grad = g.createLinearGradient(cx - rx, 0, cx + rx, 0);
      grad.addColorStop(0, left);
      grad.addColorStop(1, right);
      if (pr.k === 'cyl') {
        const hh = pr.h * tz;
        g.beginPath();
        g.ellipse(cx, cyBottom, rx, ry, 0, 0, Math.PI);
        g.lineTo(cx - rx, cyBottom - hh);
        g.ellipse(cx, cyBottom - hh, rx, ry, 0, Math.PI, 0, true);
        g.closePath();
        g.fillStyle = grad;
        g.fill();
        g.beginPath();
        g.ellipse(cx, cyBottom - hh, rx, ry, 0, 0, Math.PI * 2);
        g.fillStyle = top;
        g.fill();
      } else if (pr.k === 'cone') {
        const hh = pr.h * tz;
        g.beginPath();
        g.ellipse(cx, cyBottom, rx, ry, 0, 0, Math.PI);
        g.lineTo(cx, cyBottom - hh);
        g.closePath();
        g.fillStyle = grad;
        g.fill();
      } else {
        g.beginPath();
        g.ellipse(cx, cyBottom, rx, ry, 0, 0, Math.PI);
        g.ellipse(cx, cyBottom, rx, rx * 0.95, 0, Math.PI, 0);
        g.closePath();
        const rg = g.createRadialGradient(cx - rx * 0.35, cyBottom - rx * 0.6, rx * 0.1, cx, cyBottom - rx * 0.3, rx * 1.2);
        rg.addColorStop(0, top);
        rg.addColorStop(1, right);
        g.fillStyle = rg;
        g.fill();
      }
      break;
    }
  }
}

/** 0 during the day, up to 1 in the middle of the night (local time). */
export function nightFactor(d = new Date()): number {
  const hour = d.getHours() + d.getMinutes() / 60;
  return Math.max(0, Math.min(1, (Math.cos(((hour - 1) / 24) * Math.PI * 2) + 0.15) * 0.9));
}

export class CityRenderer {
  private g: CanvasRenderingContext2D;
  private dpr = 1;
  private cw = 0;
  private ch = 0;
  pal: Palette;
  zoom = 1;
  panX = 0;
  panY = 0;
  private t = 0;
  private layout: Placed[] = [];
  private walkers: { a: number; s: number; lane: number; vertical: boolean }[] = [];
  /** Landmark to celebrate (bounces once). */
  highlight: string | null = null;
  private highlightT = 0;

  constructor(private canvas: HTMLCanvasElement, pal: Palette) {
    this.g = canvas.getContext('2d')!;
    this.pal = pal;
    const rng = new Rng(9);
    for (let k = 0; k < 14; k++) this.walkers.push({ a: rng.next() * N, s: 0.15 + rng.next() * 0.25, lane: 3 + 4 * rng.int(0, 2), vertical: rng.next() < 0.5 });
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.cw = this.canvas.clientWidth;
    this.ch = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.cw * this.dpr);
    this.canvas.height = Math.round(this.ch * this.dpr);
  }

  setCity(lifetime: number, built: string[]) {
    this.layout = layoutCity(lifetime, built);
  }

  celebrate(id: string) {
    this.highlight = id;
    this.highlightT = 0;
  }

  draw(dt: number) {
    this.t += dt;
    this.highlightT += dt;
    const g = this.g;
    const p = this.pal;
    const night = nightFactor();
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const sky = g.createLinearGradient(0, 0, 0, this.ch);
    sky.addColorStop(0, night > 0.5 ? '#1B2034' : p.bg);
    sky.addColorStop(1, night > 0.5 ? '#2A2F48' : shade(p.dark ? p.bg : p.bg, p.dark ? 0.06 : -0.05));
    g.fillStyle = sky;
    g.fillRect(0, 0, this.cw, this.ch);

    const tw = Math.min(this.cw / (N + 1.5), 64) * this.zoom;
    const th = tw / 2;
    const tz = th * 1.15;
    const ox = this.cw / 2 + this.panX;
    const oy = this.ch * 0.36 - (N * th) / 2 + this.panY;
    const P = (x: number, y: number, z = 0): [number, number] => [ox + ((x - y) * tw) / 2, oy + ((x + y) * th) / 2 - z * tz];

    // Floating island slab.
    const slabH = 0.9;
    const poly = (pts: [number, number][], fill: string) => {
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]);
      g.closePath();
      g.fillStyle = fill;
      g.fill();
    };
    const ground = night > 0.5 ? '#3A3F52' : p.dark ? shade(p.card, 0.08) : '#E9E1D2';
    const side = night > 0.5 ? '#2A2E3E' : p.dark ? shade(p.card, -0.2) : '#CDBFA8';
    poly([P(0, N, 0), P(N, N, 0), P(N, N, -slabH), P(0, N, -slabH)], side);
    poly([P(N, 0, 0), P(N, N, 0), P(N, N, -slabH), P(N, 0, -slabH)], shade(side, -0.12));
    poly([P(0, 0), P(N, 0), P(N, N), P(0, N)], ground);

    // Streets.
    const street = night > 0.5 ? '#454B60' : p.dark ? shade(p.card, -0.06) : '#DCD1BE';
    for (let k = 3; k < N; k += BLOCK) {
      poly([P(k, 0), P(k + 1, 0), P(k + 1, N), P(k, N)], street);
      poly([P(0, k), P(N, k), P(N, k + 1), P(0, k + 1)], street);
    }

    // Walkers (little coloured dots) along the streets.
    for (const w of this.walkers) {
      w.a = (w.a + w.s * dt) % N;
      const [sx, sy] = w.vertical ? P(w.lane + 0.5, w.a) : P(w.a, w.lane + 0.5);
      g.fillStyle = night > 0.5 ? '#F3D98B' : materialColor(Math.floor(w.s * 20) % 5, 0);
      g.beginPath();
      g.arc(sx, sy - 2, Math.max(1.5, tw * 0.03), 0, Math.PI * 2);
      g.fill();
    }

    for (const obj of this.layout) {
      let lift = 0;
      if (obj.kind === 'landmark' && obj.id === this.highlight && this.highlightT < 1.2) {
        lift = Math.max(0, Math.sin(this.highlightT * Math.PI * 2.5) * (1.2 - this.highlightT) * 0.5);
      }
      for (const prim of obj.shape) drawPrim(g, prim, P, tw, th, tz, night, lift);
      if (obj.kind === 'house' && night > 0.4) {
        // Lit windows.
        const s = obj.shape[0];
        if (s.k === 'box') {
          const [wx, wy] = P(s.x + s.w, s.y + s.d * 0.5, s.h * 0.5);
          g.fillStyle = `rgba(255,214,120,${0.4 + 0.5 * night})`;
          g.fillRect(wx - tw * 0.04, wy - tw * 0.03, tw * 0.06, tw * 0.06);
        }
      }
    }
  }

}

/** Renders a single landmark centred in a small canvas (collection thumbnails). */
export function drawLandmarkThumb(canvas: HTMLCanvasElement, id: string, locked: boolean, pal: Palette) {
  const l = landmarkById(id);
  if (!l) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = canvas.clientWidth || 96;
  const h = canvas.clientHeight || 96;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const g = canvas.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const tw = (w / (l.size + 0.8)) * 0.9;
  const th = tw / 2;
  const tz = th * 1.15;
  const ox = w / 2;
  const oy = h * 0.72 - (l.size * th) / 1;
  const P = (x: number, y: number, z = 0): [number, number] => [ox + ((x - y) * tw) / 2, oy + ((x + y) * th) / 2 - z * tz];
  // Footprint shadow.
  g.fillStyle = pal.dark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.07)';
  g.beginPath();
  const fp: [number, number][] = [P(0, 0), P(l.size, 0), P(l.size, l.size), P(0, l.size)];
  g.moveTo(fp[0][0], fp[0][1]);
  fp.slice(1).forEach((q) => g.lineTo(q[0], q[1]));
  g.closePath();
  g.fill();
  for (const prim of l.shape) drawPrim(g, prim, P, tw, th, tz, 0, 0);
  if (locked) {
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = pal.dark ? '#3A4058' : '#CFC6B8';
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
  }
}
