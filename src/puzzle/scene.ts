import { Rng } from '../core/rng';

/**
 * Tessera's world: a Mediterranean canal village in mosaic. Low, human-scale houses in
 * warm mixed colours (Townscaper's cosy rooftops, Venice's canals, Lisbon's azulejos),
 * built in small isometric volumes, each face shaded by the same light.
 *
 * The board is the village square: a mosaic inlaid in the paving, with the houses of the
 * place along its back edge and a quay and water in front of it. Every chapter is a real
 * place that reads at a glance: the garden (cottages, greenhouse, flower beds, a pond with
 * ducks), the harbour (lighthouse, fishermen's houses, crates, sailboats), the market
 * (striped stalls, fruit, string lights, a laden gondola), the village at night (lit
 * windows, lamps, moon, reflections, fireflies) and the sunken city (ruins, seaweed, fish).
 *
 * Static architecture is drawn once into cached layers; only living details move.
 */

export type ThemeId = 'garden' | 'harbour' | 'market' | 'night' | 'deep';

interface Theme {
  /** Sky gradient, top to horizon. */
  sky: [string, string];
  walls: string[];
  roofs: string[];
  shutters: string[];
  greens: string[];
  ground: string;
  /** Water, surface then depth. */
  water: [string, string];
  quay: string;
  /** Board: paving stone (slab), marble cells, title ink, mosaic border tesserae. */
  slab: string;
  cell: string;
  ink: string;
  tess: string[];
  night: boolean;
  underwater: boolean;
  boat: string;
}

const THEMES: Record<ThemeId, Theme> = {
  garden: {
    sky: ['#BFE1EA', '#F7EEDD'],
    walls: ['#F6E6C6', '#F2C9B6', '#E1EBD2', '#FBF4E8', '#F4D9A0'],
    roofs: ['#D9785F', '#C8664E', '#E0956B'],
    shutters: ['#6E9E7A', '#5F8FB0', '#9A7BB5'],
    greens: ['#5E9466', '#7FB07A', '#A9CC8C'],
    ground: '#E7DCC5', water: ['#8FCBBF', '#5FA59D'], quay: '#CDBEA2',
    slab: '#D8CAB0', cell: '#FBF7EF', ink: '#2F3B33', tess: ['#6FA88A', '#E6A67E', '#F3E2B8', '#87B9C9'],
    night: false, underwater: false, boat: '#FFF8EE',
  },
  harbour: {
    sky: ['#A9D8EC', '#F6ECDF'],
    walls: ['#FBF6EE', '#BFDDEA', '#F3D79E', '#EBB4A4', '#CFE5D5'],
    roofs: ['#2F6F8F', '#D86F55', '#3F8A9A'],
    shutters: ['#2F6F8F', '#3E8E7E', '#D86F55'],
    greens: ['#5F9670', '#86B583', '#A9CC8C'],
    ground: '#E5DCCB', water: ['#56B3C8', '#2A7F9E'], quay: '#C8BAA4',
    slab: '#D5C8B4', cell: '#FBF9F5', ink: '#24393C', tess: ['#2F6F8F', '#FBF6EE', '#E07A5F', '#7CC3D2'],
    night: false, underwater: false, boat: '#FFF8EE',
  },
  market: {
    sky: ['#F5D3AE', '#FBEBD6'],
    walls: ['#F2B98F', '#EBA084', '#F6DFA9', '#F7E9D6', '#E7C3A4'],
    roofs: ['#C4553F', '#D97A4A', '#B9614A'],
    shutters: ['#3E7C8C', '#6F8F4E', '#7A5A9E'],
    greens: ['#5E8F5A', '#7FA86A', '#A8C47E'],
    ground: '#E9D3B2', water: ['#7BBAB3', '#4D908C'], quay: '#CFAE86',
    slab: '#DABE98', cell: '#FDF6EE', ink: '#4A2A28', tess: ['#C4553F', '#F2B23C', '#3E7C8C', '#F6E7C9'],
    night: false, underwater: false, boat: '#2E2A2E',
  },
  night: {
    sky: ['#1C2350', '#5E4D88'],
    walls: ['#6E6A9E', '#8A7CAB', '#5F6C9C', '#9B89AA', '#7C7AA8'],
    roofs: ['#3A3468', '#4B3F7A', '#5A4470'],
    shutters: ['#2B2852', '#3C3466'],
    greens: ['#2F4A5A', '#3D5C68', '#4E6E72'],
    ground: '#4E4977', water: ['#33407A', '#1A2150'], quay: '#423E6C',
    slab: '#5E5882', cell: '#F4F1FA', ink: '#2E2344', tess: ['#F2C46B', '#7E6FB0', '#E58FA0', '#4D5C9A'],
    night: true, underwater: false, boat: '#26223F',
  },
  deep: {
    sky: ['#2A93A0', '#0E4A60'],
    walls: ['#7DBDB2', '#62A3A0', '#93CBBC', '#5B9497'],
    roofs: ['#3C7F86'],
    shutters: ['#2D6670'],
    greens: ['#3E9A7E', '#5DB48F', '#2E7F6E'],
    ground: '#6FA195', water: ['#0F4A60', '#072638'], quay: '#4B8682',
    slab: '#3F8586', cell: '#EEF7F4', ink: '#10343F', tess: ['#E9C77B', '#3FA39B', '#9FD8CC', '#2D6F7A'],
    night: false, underwater: true, boat: '#F2D99E',
  },
};

export function boatColor(theme: ThemeId): string {
  return THEMES[theme].boat;
}

export function isUnderwater(theme: ThemeId): boolean {
  return THEMES[theme].underwater;
}

/** Colours the board uses so it reads as the mosaic of the village square. */
export function boardStyle(theme: ThemeId): { cell: string; slab: string; ink: string; titleOnDark: boolean; tess: string[] } {
  const t = THEMES[theme];
  return { cell: t.cell, slab: t.slab, ink: t.ink, titleOnDark: t.night || t.underwater, tess: t.tess };
}

type Pt = [number, number];

const COS = 0.866;
const SIN = 0.5;
const GLOW = '#FFD98A';
const FRUIT = ['#E8553F', '#F2A93B', '#F4D35E', '#8DBF55', '#C0436B'];
const FLOWERS = ['#E9788A', '#F4C04E', '#FBF4E8', '#B78BD6', '#F09A6B'];

/** Lightens (k > 0) or darkens (k < 0) a #rrggbb colour. */
function shade(col: string, k: number): string {
  let c: number[];
  if (col.startsWith('#')) {
    const n = parseInt(col.slice(1), 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  } else c = col.slice(col.indexOf('(') + 1, col.indexOf(')')).split(',').map(Number);
  const f = (v: number) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k));
  return `rgb(${f(c[0])},${f(c[1])},${f(c[2])})`;
}

function poly(g: CanvasRenderingContext2D, pts: Pt[], fill: string) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
}

function lerp(a: Pt, b: Pt, u: number): Pt {
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
}

interface Box {
  F: Pt;
  L: Pt;
  R: Pt;
  Ft: Pt;
  Lt: Pt;
  Rt: Pt;
  Bt: Pt;
}

/** An isometric box: front corner at (cx, by), extents l (left) and r (right), height h; faces auto-shaded. */
function box(g: CanvasRenderingContext2D, cx: number, by: number, l: number, r: number, h: number, col: string, top = true): Box {
  const F: Pt = [cx, by];
  const L: Pt = [cx - l * COS, by - l * SIN];
  const R: Pt = [cx + r * COS, by - r * SIN];
  const up = (p: Pt): Pt => [p[0], p[1] - h];
  const Ft = up(F), Lt = up(L), Rt = up(R);
  const Bt: Pt = [Lt[0] + Rt[0] - Ft[0], Lt[1] + Rt[1] - Ft[1]];
  poly(g, [L, F, Ft, Lt], col);
  poly(g, [F, R, Rt, Ft], shade(col, -0.2));
  if (top) poly(g, [Lt, Ft, Rt, Bt], shade(col, 0.18));
  return { F, L, R, Ft, Lt, Rt, Bt };
}

type Face = (u: number, v: number) => Pt;

/** Point on the left face: u from back (0) to front (1), v from bottom (0) to top (1). */
const onLeft = (p: Box): Face => (u, v) => {
  const b = lerp(p.L, p.F, u), t = lerp(p.Lt, p.Ft, u);
  return lerp(b, t, v);
};

/** Point on the right face: u from front (0) to back (1). */
const onRight = (p: Box): Face => (u, v) => {
  const b = lerp(p.F, p.R, u), t = lerp(p.Ft, p.Rt, u);
  return lerp(b, t, v);
};

function quadOn(g: CanvasRenderingContext2D, f: Face, u0: number, u1: number, v0: number, v1: number, col: string) {
  poly(g, [f(u0, v0), f(u1, v0), f(u1, v1), f(u0, v1)], col);
}

/** A cylinder standing at (x, by). */
function cylinder(g: CanvasRenderingContext2D, x: number, by: number, r: number, h: number, col: string) {
  const grad = g.createLinearGradient(x - r, 0, x + r, 0);
  grad.addColorStop(0, shade(col, 0.1));
  grad.addColorStop(0.6, col);
  grad.addColorStop(1, shade(col, -0.25));
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(x, by, r, r * 0.4, 0, 0, Math.PI);
  g.lineTo(x - r, by - h);
  g.lineTo(x + r, by - h);
  g.closePath();
  g.fill();
  g.fillStyle = shade(col, 0.2);
  g.beginPath();
  g.ellipse(x, by - h, r, r * 0.4, 0, 0, Math.PI * 2);
  g.fill();
}

interface Place {
  rng: Rng;
  t: Theme;
  w: number;
  /** Line where the front row of buildings stands. */
  ground: number;
  scale: number;
}

export class Scene {
  theme: ThemeId = 'harbour';
  seed = 1;
  /** Building height multiplier (lower on menus, so titles stay readable). */
  scale = 1;
  private far: HTMLCanvasElement | null = null;
  private near: HTMLCanvasElement | null = null;
  private key = '';
  private fountains: Pt[] = [];
  private lamps: Pt[] = [];
  private bulbs: { x: number; y: number; c: string }[] = [];
  private weeds: { x: number; y: number; h: number; c: string }[] = [];
  private lit: number[] = [];
  private beacon: Pt | null = null;
  private bubbles: { x: number; y: number; r: number; v: number }[] = [];
  private fish: { x: number; y: number; v: number; s: number }[] = [];
  private flies: { x: number; y: number; ph: number }[] = [];
  /** Top of the water, in front of the quay. */
  private waterY = 0;
  private skyY = 0;

  draw(g: CanvasRenderingContext2D, w: number, h: number, dpr: number, board: { x: number; y: number; size: number }, time: number) {
    const t = THEMES[this.theme];
    const key = `${this.theme}|${this.scale}|${w}|${h}|${Math.round(board.x)}|${Math.round(board.y)}|${Math.round(board.size)}|${this.seed}|${dpr}`;
    if (key !== this.key) {
      this.key = key;
      this.build(t, w, h, dpr, board);
    }
    const sky = g.createLinearGradient(0, 0, 0, this.skyY);
    sky.addColorStop(0, t.sky[0]);
    sky.addColorStop(1, t.sky[1]);
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    if (t.night) this.drawNightSky(g, w, time);
    else if (t.underwater) this.drawRays(g, w, h, time);
    else this.drawClouds(g, w, time);
    if (this.far) g.drawImage(this.far, 0, 0, w, h);
    if (this.near) g.drawImage(this.near, 0, 0, w, h);
    this.drawLife(g, t, w, h, time);
  }

  // ---------------------------------------------------------------- static layers

  private build(t: Theme, w: number, h: number, dpr: number, board: { x: number; y: number; size: number }) {
    const mk = () => {
      const c = document.createElement('canvas');
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      const g = c.getContext('2d')!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { c, g };
    };
    this.fountains = [];
    this.lamps = [];
    this.bulbs = [];
    this.weeds = [];
    this.lit = [];
    this.beacon = null;
    this.bubbles = [];
    this.fish = [];
    this.flies = [];
    const menu = board.size === 0;
    const ground = menu ? board.y : board.y - 20;
    const quayY = menu ? ground + (h - ground) * 0.42 : board.y + board.size + 30;
    this.skyY = ground - 16;
    this.waterY = quayY + 9;
    const P: Place = { rng: new Rng(this.seed * 977 + 13), t, w, ground, scale: this.scale };

    const far = mk();
    this.farLayer(far.g, P);
    this.far = far.c;

    const near = mk();
    const g = near.g;
    this.paving(g, t, w, ground - 16, quayY);
    switch (this.theme) {
      case 'garden': this.garden(g, P); break;
      case 'harbour': this.harbour(g, P); break;
      case 'market': this.market(g, P); break;
      case 'night': this.village(g, P); break;
      case 'deep': this.ruins(g, P); break;
    }
    this.quayAndWater(g, t, w, h, quayY);
    this.near = near.c;

    const r2 = new Rng(this.seed + 5);
    if (t.underwater) {
      for (let k = 0; k < 18; k++) this.bubbles.push({ x: r2.next() * w, y: r2.next() * h, r: 1.5 + r2.next() * 3, v: 10 + r2.next() * 20 });
      for (let k = 0; k < 4; k++) this.fish.push({ x: r2.next() * w, y: 50 + r2.next() * Math.max(40, ground - 120), v: (r2.next() < 0.5 ? -1 : 1) * (8 + r2.next() * 10), s: 6 + r2.next() * 5 });
    }
    if (t.night) for (let k = 0; k < 14; k++) this.flies.push({ x: r2.next() * w, y: ground - 90 + r2.next() * 100, ph: r2.next() * 6 });
  }

  /** Distant layer: hills, the open sea, far rooftops or drowned silhouettes, softened by the air. */
  private farLayer(g: CanvasRenderingContext2D, P: Place) {
    const { t, w, ground, rng } = P;
    const base = ground - 22;
    g.globalAlpha = t.night ? 0.55 : 0.45;
    if (this.theme === 'garden') {
      for (let k = 0; k < 3; k++) {
        g.fillStyle = t.greens[k % t.greens.length];
        g.beginPath();
        g.ellipse(w * (0.15 + k * 0.38), base + 6, w * 0.4, 34 + k * 8, 0, Math.PI, 0);
        g.fill();
      }
    } else if (this.theme === 'harbour') {
      g.fillStyle = t.water[0];
      g.fillRect(0, base - 26, w, 40);
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.fillRect(0, base - 26, w, 1.5);
      g.fillStyle = shade(t.greens[0], 0.2);
      g.beginPath();
      g.ellipse(w * 0.78, base - 26, 46, 12, 0, Math.PI, 0);
      g.fill();
    } else {
      // A far row of rooftops (a bell tower and a dome for the town, broken columns underwater).
      let x = -10;
      while (x < w + 20) {
        const bw = rng.range(18, 34), bh = rng.range(14, 34) * P.scale;
        g.fillStyle = t.underwater ? shade(t.sky[1], 0.25) : shade(t.sky[1], t.night ? -0.35 : -0.12);
        g.fillRect(x, base - bh, bw, bh + 10);
        if (!t.underwater) poly(g, [[x - 2, base - bh], [x + bw / 2, base - bh - 8], [x + bw + 2, base - bh]], g.fillStyle as string);
        if (t.night && rng.next() < 0.5) {
          g.fillStyle = GLOW;
          g.fillRect(x + bw * 0.4, base - bh * 0.6, 3, 4);
        }
        x += bw + rng.range(-4, 6);
      }
      if (this.theme === 'market') {
        // The bell tower of the market square.
        const bx = w * rng.range(0.2, 0.8);
        g.fillStyle = shade(t.sky[1], -0.16);
        g.fillRect(bx, base - 70 * P.scale, 16, 70 * P.scale);
        poly(g, [[bx - 2, base - 70 * P.scale], [bx + 8, base - 86 * P.scale], [bx + 18, base - 70 * P.scale]], g.fillStyle as string);
      }
    }
    g.globalAlpha = 1;
  }

  /** The village square: warm flagstones in staggered rows. */
  private paving(g: CanvasRenderingContext2D, t: Theme, w: number, top: number, bottom: number) {
    g.fillStyle = t.ground;
    g.fillRect(0, top, w, bottom - top);
    g.strokeStyle = shade(t.ground, -0.08);
    g.lineWidth = 1;
    g.beginPath();
    const rh = 8;
    for (let y = top + rh, row = 0; y < bottom; y += rh, row++) {
      g.moveTo(0, y);
      g.lineTo(w, y);
      for (let x = (row % 2) * 9; x < w; x += 18) {
        g.moveTo(x, y - rh);
        g.lineTo(x, y);
      }
    }
    g.stroke();
  }

  /** The quay wall in front of the square, then the canal, pond or sea (the abyss under the sea). */
  private quayAndWater(g: CanvasRenderingContext2D, t: Theme, w: number, h: number, y: number) {
    g.fillStyle = shade(t.quay, 0.15);
    g.fillRect(0, y - 3, w, 3);
    g.fillStyle = shade(t.quay, -0.12);
    g.fillRect(0, y, w, 9);
    g.strokeStyle = shade(t.quay, -0.25);
    g.beginPath();
    for (let x = 0; x < w; x += 22) {
      g.moveTo(x, y);
      g.lineTo(x, y + 9);
    }
    g.stroke();
    const wy = y + 9;
    const water = g.createLinearGradient(0, wy, 0, h);
    water.addColorStop(0, t.water[0]);
    water.addColorStop(1, t.water[1]);
    g.fillStyle = water;
    g.fillRect(0, wy, w, h - wy);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(0, wy, w, 5);
    if (this.theme === 'garden') {
      // Lily pads and their flowers on the pond.
      const rng = new Rng(this.seed * 13 + 1);
      for (let k = 0; k < 9; k++) {
        const x = rng.next() * w, yy = wy + 16 + rng.next() * Math.min(110, h - wy - 20);
        g.fillStyle = rng.next() < 0.5 ? '#6FA86E' : '#86BA7A';
        g.beginPath();
        g.ellipse(x, yy, 9, 4, 0, 0.3, Math.PI * 2);
        g.lineTo(x, yy);
        g.fill();
        if (rng.next() < 0.4) {
          g.fillStyle = '#F6B8C4';
          g.beginPath();
          g.arc(x + 2, yy - 2, 2.5, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  }

  // ---------------------------------------------------------------- places

  /** Positions across the width, with a little jitter, for a row of `n` items. */
  private slots(P: Place, n: number): number[] {
    return Array.from({ length: n }, (_, k) => ((k + 0.5) / n) * P.w + P.rng.range(-8, 8));
  }

  private garden(g: CanvasRenderingContext2D, P: Place) {
    const { rng, ground, scale } = P;
    const back = this.slots(P, Math.ceil(P.w / 75));
    back.forEach((x, k) => (k % 2 ? this.tree(g, P, x, ground - 12, rng.range(13, 18)) : this.house(g, P, x, ground - 12, rng.range(36, 54) * scale)));
    const front = this.slots(P, Math.ceil(P.w / 90));
    const gh = rng.int(0, front.length);
    front.forEach((x, k) => {
      if (k === gh) this.greenhouse(g, P, x, ground);
      else if (k % 2) this.cypress(g, P, x + 10, ground, 34 * scale);
      else this.house(g, P, x, ground, rng.range(30, 42) * scale);
    });
    for (let k = 0; k < 4; k++) this.flowerBed(g, P, P.w * (0.12 + k * 0.26) + rng.range(-10, 10), ground + 8);
    this.fountain(g, P, P.w * (rng.next() < 0.5 ? 0.3 : 0.7), ground + 4, 14);
  }

  private harbour(g: CanvasRenderingContext2D, P: Place) {
    const { rng, ground, scale, w } = P;
    // Tall narrow fishermen's houses in a colourful row, the lighthouse at the end of the jetty.
    const left = rng.next() < 0.5;
    const lhX = left ? w * 0.1 : w * 0.9;
    const xs = this.slots(P, Math.ceil(w / 44)).filter((x) => Math.abs(x - lhX) > 34);
    for (const x of xs) this.house(g, P, x, ground - 4, rng.range(40, 54) * scale, 15, 17);
    this.lighthouse(g, P, lhX, ground + 2, 92 * scale);
    // Crates, barrels and mooring bollards along the quay.
    for (let k = 0; k < 3; k++) {
      const x = w * (0.22 + k * 0.28) + rng.range(-12, 12);
      this.crate(g, x, ground + 10, 7, null);
      this.crate(g, x + 13, ground + 12, 6, null);
      if (rng.next() < 0.6) this.crate(g, x + 4, ground + 3, 6, null);
      this.barrel(g, x - 14, ground + 12, 5);
    }
  }

  private market(g: CanvasRenderingContext2D, P: Place) {
    const { rng, ground, scale, w } = P;
    const roofs: Pt[] = [];
    for (const x of this.slots(P, Math.ceil(w / 52))) roofs.push(this.house(g, P, x, ground - 12, rng.range(46, 62) * scale, 18, 18));
    this.stringLights(roofs, 3);
    // Stalls with striped awnings, crates of fruit between them.
    const stripes: [string, string][] = [['#C4553F', '#FBF1E1'], ['#3E7C8C', '#FBF1E1'], ['#F2B23C', '#FBF1E1'], ['#6F8F4E', '#F6E7C9']];
    const xs = this.slots(P, Math.ceil(w / 95));
    xs.forEach((x, k) => {
      this.stall(g, x, ground + 6, 22, 12, stripes[(k + this.seed) % stripes.length]);
      this.crate(g, x + 34, ground + 12, 6, rng.pick(FRUIT));
      this.crate(g, x + 46, ground + 13, 6, rng.pick(FRUIT));
    });
  }

  private village(g: CanvasRenderingContext2D, P: Place) {
    const { rng, ground, scale, w } = P;
    const roofs: Pt[] = [];
    for (const x of this.slots(P, Math.ceil(w / 60))) this.house(g, P, x, ground - 14, rng.range(48, 66) * scale, 18, 16);
    for (const x of this.slots(P, Math.ceil(w / 70))) roofs.push(this.house(g, P, x, ground, rng.range(32, 44) * scale, 16, 18));
    this.stringLights(roofs, 4);
    for (let k = 0; k < 3; k++) this.lamp(g, w * (0.18 + k * 0.32) + rng.range(-10, 10), ground + 12, 30);
  }

  private ruins(g: CanvasRenderingContext2D, P: Place) {
    const { rng, ground, scale, w } = P;
    for (const x of this.slots(P, Math.ceil(w / 70))) {
      if (rng.next() < 0.45) this.column(g, P, x, ground - 10, rng.range(40, 70) * scale);
      else this.ruinHouse(g, P, x, ground - 10, rng.range(30, 52) * scale);
    }
    // A fallen arch, coral and swaying seaweed in front.
    for (const x of this.slots(P, Math.ceil(w / 60))) {
      if (rng.next() < 0.5) this.coral(g, x, ground + 8, rng.pick(['#F09A86', '#F2C46B', '#E58FA0']));
      for (let k = 0; k < 3; k++) this.weeds.push({ x: x + rng.range(-20, 20), y: ground + 10 + rng.range(-4, 6), h: rng.range(16, 34), c: rng.pick(P.t.greens) });
    }
    for (let k = 0; k < 3; k++) {
      const x = w * (0.2 + k * 0.3) + rng.range(-10, 10);
      box(g, x, ground + 12, 8, 12, 5, shade(P.t.walls[0], -0.1));
    }
  }

  // ---------------------------------------------------------------- props

  /** A house with a gabled tile roof, shuttered windows and a door. Returns its gable peak. */
  private house(g: CanvasRenderingContext2D, P: Place, x: number, by: number, h: number, l = 0, r = 0): Pt {
    const { rng, t } = P;
    l = l || rng.range(15, 24);
    r = r || rng.range(15, 22);
    const wall = rng.pick(t.walls);
    const shutter = rng.pick(t.shutters);
    const p = box(g, x, by, l, r, h, wall, false);
    const L = onLeft(p), R = onRight(p);
    const floors = Math.max(1, Math.round(h / 22));
    const dark = t.night ? '#2B2747' : 'rgba(45,55,66,0.62)';
    for (let f = 0; f < floors; f++) {
      const v0 = (f + 0.3) / floors, v1 = v0 + 0.42 / floors;
      const us = f === 0 ? [0.2] : l > 18 ? [0.3, 0.7] : [0.5];
      for (const u of us) {
        const lit = t.night && rng.next() < 0.6;
        quadOn(g, L, u - 0.07, u + 0.07, v0, v1, lit ? GLOW : dark);
        if (lit) this.lit.push(L(u, v0)[0]);
        if (!t.night) {
          quadOn(g, L, u - 0.13, u - 0.07, v0, v1, shutter);
          quadOn(g, L, u + 0.07, u + 0.13, v0, v1, shutter);
        }
        if (f === 1 && !t.night && rng.next() < 0.45) {
          // Flower box under the window.
          quadOn(g, L, u - 0.12, u + 0.12, v0 - 0.06 / floors, v0, t.greens[0]);
          const c = L(u, v0);
          g.fillStyle = rng.pick(FLOWERS);
          g.fillRect(c[0] - 2, c[1] - 2, 2, 2);
          g.fillRect(c[0] + 2, c[1] - 1, 2, 2);
        }
      }
      if (r > 12) {
        const lit = t.night && rng.next() < 0.5;
        quadOn(g, R, 0.42, 0.58, v0, v1, lit ? shade(GLOW, -0.08) : 'rgba(30,36,48,0.4)');
        if (lit) this.lit.push(R(0.5, v0)[0]);
      }
    }
    // Door.
    quadOn(g, L, 0.55, 0.75, 0, 0.62 / floors, shade(shutter, -0.15));
    if (t.night) {
      const d = L(0.65, 0.3 / floors);
      const glow = g.createRadialGradient(d[0], d[1], 1, d[0], d[1], 14);
      glow.addColorStop(0, 'rgba(255,217,138,0.35)');
      glow.addColorStop(1, 'rgba(255,217,138,0)');
      g.fillStyle = glow;
      g.fillRect(d[0] - 14, d[1] - 14, 28, 28);
    }
    return this.roof(g, P, p, rng.pick(t.roofs), Math.min(l, r) * 0.75, wall);
  }

  /** A gabled roof whose ridge runs along the left face; the gable end faces right. */
  private roof(g: CanvasRenderingContext2D, P: Place, p: Box, col: string, rh: number, wall: string): Pt {
    const eave = 2;
    const Lt: Pt = [p.Lt[0] - eave, p.Lt[1] + 1], Ft: Pt = [p.Ft[0], p.Ft[1] + eave];
    const rF: Pt = [(p.Ft[0] + p.Rt[0]) / 2, (p.Ft[1] + p.Rt[1]) / 2 - rh];
    const rB: Pt = [(p.Lt[0] + p.Bt[0]) / 2, (p.Lt[1] + p.Bt[1]) / 2 - rh];
    const wallR = shade(wall, -0.2);
    poly(g, [rB, rF, p.Rt, p.Bt], shade(col, -0.3));
    // Gable end (wall), then the front roof slope with rows of tiles.
    poly(g, [p.Ft, p.Rt, rF], wallR);
    poly(g, [Lt, Ft, rF, rB], col);
    g.strokeStyle = shade(col, -0.18);
    g.lineWidth = 1;
    g.beginPath();
    for (let k = 1; k < 4; k++) {
      const a = lerp(Lt, rB, k / 4), b = lerp(Ft, rF, k / 4);
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
    }
    g.stroke();
    g.strokeStyle = shade(col, 0.25);
    g.beginPath();
    g.moveTo(rB[0], rB[1]);
    g.lineTo(rF[0], rF[1]);
    g.stroke();
    if (P.rng.next() < 0.45) {
      const c = lerp(rB, rF, 0.3);
      box(g, c[0], c[1] + 6, 3, 3, 9, shade(P.t.walls[1 % P.t.walls.length], -0.1));
    }
    return rF;
  }

  private tree(g: CanvasRenderingContext2D, P: Place, x: number, by: number, r: number) {
    const [a, b, c] = P.t.greens;
    g.fillStyle = 'rgba(0,0,0,0.1)';
    g.beginPath();
    g.ellipse(x + 3, by, r * 0.9, r * 0.3, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#8C6E58';
    g.fillRect(x - 1.5, by - r, 3, r);
    for (const [dx, dy, rr, col] of [[r * 0.2, -1.3, 1, a], [-r * 0.15, -1.45, 0.8, b], [-r * 0.35, -1.7, 0.38, c]] as [number, number, number, string][]) {
      g.fillStyle = col;
      g.beginPath();
      g.arc(x + dx, by + r * dy, r * rr, 0, Math.PI * 2);
      g.fill();
    }
  }

  /** A slim Mediterranean cypress. */
  private cypress(g: CanvasRenderingContext2D, P: Place, x: number, by: number, h: number) {
    g.fillStyle = 'rgba(0,0,0,0.1)';
    g.beginPath();
    g.ellipse(x + 3, by, 7, 2.5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = P.t.greens[0];
    g.beginPath();
    g.ellipse(x, by - h / 2, 6, h / 2, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = P.t.greens[1];
    g.beginPath();
    g.ellipse(x - 2, by - h * 0.55, 3, h * 0.38, 0, 0, Math.PI * 2);
    g.fill();
  }

  private greenhouse(g: CanvasRenderingContext2D, P: Place, x: number, by: number) {
    const h = 18 * P.scale + 6;
    const p = box(g, x, by, 26, 14, h, '#D3ECE6', false);
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 1;
    const L = onLeft(p), R = onRight(p);
    g.beginPath();
    for (let k = 1; k < 5; k++) {
      const a = L(k / 5, 0), b = L(k / 5, 1);
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
    }
    const a = R(0.5, 0), b = R(0.5, 1);
    g.moveTo(a[0], a[1]);
    g.lineTo(b[0], b[1]);
    g.stroke();
    // Plants seen through the glass.
    for (let k = 0; k < 4; k++) {
      const c = L((k + 0.5) / 4, 0.25);
      g.fillStyle = P.t.greens[k % 3];
      g.beginPath();
      g.arc(c[0], c[1], 3, 0, Math.PI * 2);
      g.fill();
    }
    this.roof(g, P, p, '#E6F5F1', 9, '#D3ECE6');
  }

  private flowerBed(g: CanvasRenderingContext2D, P: Place, x: number, by: number) {
    const p = box(g, x, by, 16, 7, 4, '#B9A285');
    poly(g, [p.Lt, p.Ft, p.Rt, p.Bt], P.t.greens[1]);
    for (let k = 0; k < 10; k++) {
      const c = lerp(lerp(p.Lt, p.Ft, P.rng.next()), lerp(p.Bt, p.Rt, P.rng.next()), P.rng.next());
      g.fillStyle = P.rng.pick(FLOWERS);
      g.beginPath();
      g.arc(c[0], c[1] - 1, 1.6, 0, Math.PI * 2);
      g.fill();
    }
  }

  private fountain(g: CanvasRenderingContext2D, P: Place, x: number, by: number, r: number) {
    g.fillStyle = shade(P.t.quay, -0.15);
    g.beginPath();
    g.ellipse(x, by, r, r * 0.45, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(x - r, by - 5, r * 2, 5);
    g.fillStyle = shade(P.t.quay, 0.15);
    g.beginPath();
    g.ellipse(x, by - 5, r, r * 0.45, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = P.t.water[0];
    g.beginPath();
    g.ellipse(x, by - 5, r - 2.5, r * 0.45 - 2, 0, 0, Math.PI * 2);
    g.fill();
    cylinder(g, x, by - 5, 2.5, 10, shade(P.t.quay, 0.1));
    this.fountains.push([x, by - 15]);
  }

  private crate(g: CanvasRenderingContext2D, x: number, by: number, s: number, fruit: string | null) {
    const p = box(g, x, by, s, s, s * 0.9, '#C89A64');
    g.strokeStyle = 'rgba(90,60,30,0.35)';
    g.lineWidth = 1;
    g.beginPath();
    const a = lerp(p.L, p.Lt, 0.5), b = lerp(p.F, p.Ft, 0.5), c = lerp(p.R, p.Rt, 0.5);
    g.moveTo(a[0], a[1]);
    g.lineTo(b[0], b[1]);
    g.lineTo(c[0], c[1]);
    g.stroke();
    if (!fruit) return;
    for (let k = 0; k < 5; k++) {
      const q = lerp(lerp(p.Lt, p.Ft, (k % 3) / 2.5 + 0.1), lerp(p.Bt, p.Rt, (k % 3) / 2.5 + 0.1), k < 3 ? 0.3 : 0.7);
      g.fillStyle = fruit;
      g.beginPath();
      g.arc(q[0], q[1] - 1.5, 2.2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.45)';
      g.fillRect(q[0] - 1, q[1] - 2.6, 1, 1);
    }
  }

  private barrel(g: CanvasRenderingContext2D, x: number, by: number, r: number) {
    cylinder(g, x, by, r, r * 2, '#A8754A');
    g.fillStyle = 'rgba(60,40,25,0.45)';
    g.fillRect(x - r, by - r * 0.6, r * 2, 1.2);
    g.fillRect(x - r, by - r * 1.5, r * 2, 1.2);
  }

  /** A market stall: a wooden counter heaped with fruit under a striped awning. */
  private stall(g: CanvasRenderingContext2D, x: number, by: number, w: number, d: number, stripe: [string, string]) {
    const p = box(g, x, by, d, w, 9, '#B98A5A');
    for (let k = 0; k < 12; k++) {
      const q = lerp(lerp(p.Lt, p.Ft, ((k * 7) % 10) / 10 + 0.05), lerp(p.Bt, p.Rt, ((k * 7) % 10) / 10 + 0.05), (k % 6) / 6 + 0.08);
      g.fillStyle = FRUIT[k % FRUIT.length];
      g.beginPath();
      g.arc(q[0], q[1] - 1.5, 2.3, 0, Math.PI * 2);
      g.fill();
    }
    const lift = (q: Pt, k: number): Pt => [q[0], q[1] - k];
    const A1 = lift(p.Lt, 16), A2 = lift(p.Ft, 16), A3 = lift(p.Rt, 22), A4 = lift(p.Bt, 22);
    g.strokeStyle = '#6E5440';
    g.lineWidth = 1.5;
    g.beginPath();
    for (const [a, b] of [[p.Ft, A2], [p.Lt, A1], [p.Rt, A3]] as [Pt, Pt][]) {
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
    }
    g.stroke();
    const n = 6;
    for (let k = 0; k < n; k++) {
      const s0 = k / n, s1 = (k + 1) / n;
      const col = stripe[k % 2];
      poly(g, [lerp(A1, A4, s0), lerp(A2, A3, s0), lerp(A2, A3, s1), lerp(A1, A4, s1)], col);
      // Valance along the front-right edge.
      const a = lerp(A2, A3, s0), b = lerp(A2, A3, s1);
      poly(g, [a, b, [b[0], b[1] + 4], [a[0], a[1] + 4]], shade(col, -0.12));
    }
    poly(g, [A1, A2, [A2[0], A2[1] + 4], [A1[0], A1[1] + 4]], shade(stripe[0], -0.2));
  }

  private lamp(g: CanvasRenderingContext2D, x: number, by: number, h: number) {
    g.fillStyle = '#2A2440';
    g.fillRect(x - 1, by - h, 2, h);
    g.fillRect(x - 3, by - 2, 6, 2);
    poly(g, [[x - 4, by - h], [x + 4, by - h], [x + 3, by - h - 7], [x - 3, by - h - 7]], GLOW);
    poly(g, [[x - 5, by - h - 7], [x + 5, by - h - 7], [x, by - h - 11]], '#2A2440');
    this.lamps.push([x, by - h - 3]);
  }

  private lighthouse(g: CanvasRenderingContext2D, P: Place, x: number, by: number, h: number) {
    // The jetty rocks it stands on.
    g.fillStyle = shade(P.t.quay, -0.2);
    g.beginPath();
    g.ellipse(x, by, 24, 8, 0, 0, Math.PI * 2);
    g.fill();
    const bands = 5;
    for (let k = 0; k < bands; k++) {
      const y0 = by - (h * k) / bands;
      const r = 11 - (k / bands) * 3;
      cylinder(g, x, y0, r, h / bands + 0.5, k % 2 ? '#E0705C' : '#FBF4EA');
    }
    const top = by - h;
    g.fillStyle = '#2F4A55';
    g.beginPath();
    g.ellipse(x, top, 12, 4, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#FFE9B4';
    g.fillRect(x - 6, top - 12, 12, 12);
    g.fillStyle = '#2F4A55';
    g.fillRect(x - 0.5, top - 12, 1, 12);
    g.beginPath();
    g.ellipse(x, top - 12, 8, 7, 0, Math.PI, 0);
    g.fill();
    this.beacon = [x, top - 6];
  }

  private column(g: CanvasRenderingContext2D, P: Place, x: number, by: number, h: number) {
    const col = P.rng.pick(P.t.walls);
    box(g, x, by, 9, 9, 5, shade(col, -0.1));
    cylinder(g, x + 0.5, by - 6, 6, h, col);
    g.strokeStyle = 'rgba(0,0,0,0.12)';
    g.lineWidth = 1;
    g.beginPath();
    for (const dx of [-3, 0, 3]) {
      g.moveTo(x + dx, by - 6);
      g.lineTo(x + dx, by - 6 - h);
    }
    g.stroke();
    if (P.rng.next() < 0.5) box(g, x, by - 6 - h + 2, 9, 9, 5, shade(col, 0.05));
    else {
      // Broken drum lying beside it.
      g.fillStyle = shade(col, -0.1);
      g.beginPath();
      g.ellipse(x + 16, by + 2, 8, 4, 0.3, 0, Math.PI * 2);
      g.fill();
    }
    for (let k = 0; k < 2; k++) this.weeds.push({ x: x + P.rng.range(-10, 10), y: by + 2, h: P.rng.range(12, 22), c: P.rng.pick(P.t.greens) });
  }

  /** A drowned house: no roof, a jagged broken top, dark empty windows. */
  private ruinHouse(g: CanvasRenderingContext2D, P: Place, x: number, by: number, h: number) {
    const col = P.rng.pick(P.t.walls);
    const p = box(g, x, by, P.rng.range(16, 22), P.rng.range(14, 20), h, col, false);
    const L = onLeft(p), R = onRight(p);
    for (const u of [0.3, 0.7]) quadOn(g, L, u - 0.08, u + 0.08, 0.45, 0.75, 'rgba(8,40,52,0.55)');
    quadOn(g, R, 0.4, 0.6, 0.45, 0.75, 'rgba(8,40,52,0.45)');
    quadOn(g, L, 0.45, 0.6, 0, 0.35, 'rgba(8,40,52,0.6)');
    // Broken top: a bite out of the walls.
    poly(g, [L(0.2, 1.02), L(0.5, 0.78), L(0.75, 0.92), L(1, 1.02)], P.t.sky[1]);
    poly(g, [R(0.1, 1.02), R(0.4, 0.85), R(0.7, 0.95), R(0.95, 1.02)], P.t.sky[1]);
    // Moss along the base.
    quadOn(g, L, 0, 1, 0, 0.08, shade(P.t.greens[0], -0.1));
  }

  private coral(g: CanvasRenderingContext2D, x: number, by: number, col: string) {
    g.strokeStyle = col;
    g.lineCap = 'round';
    g.lineWidth = 3;
    g.beginPath();
    for (const [dx, hh] of [[-5, 12], [0, 18], [5, 10]]) {
      g.moveTo(x, by);
      g.quadraticCurveTo(x + dx * 0.4, by - hh * 0.5, x + dx, by - hh);
    }
    g.stroke();
  }

  /** A garland of bulbs hanging between consecutive roof peaks. */
  private stringLights(peaks: Pt[], every: number) {
    const cols = ['#FFE3A1', '#FFD27A', '#FFF1CF'];
    for (let k = 0; k + 1 < peaks.length; k++) {
      const [a, b] = [peaks[k], peaks[k + 1]];
      const sag = 14;
      const n = Math.max(3, Math.round(Math.abs(b[0] - a[0]) / (every * 3)));
      for (let j = 1; j < n; j++) {
        const u = j / n;
        this.bulbs.push({ x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u + Math.sin(u * Math.PI) * sag + 4, c: cols[j % 3] });
      }
      this.bulbs.push({ x: NaN, y: NaN, c: '' });
    }
  }

  // ---------------------------------------------------------------- living details

  private drawLife(g: CanvasRenderingContext2D, t: Theme, w: number, h: number, time: number) {
    // Fountain jets.
    for (const [x, y] of this.fountains) {
      g.fillStyle = 'rgba(255,255,255,0.75)';
      for (let k = 0; k < 10; k++) {
        const u = (time * 0.9 + k / 10) % 1;
        const side = k % 2 ? 1 : -1;
        g.beginPath();
        g.arc(x + side * u * 9, y - 8 * Math.sin(u * Math.PI) + u * 9, 1.2, 0, Math.PI * 2);
        g.fill();
      }
    }
    // Garland: wire, then bulbs twinkling.
    if (this.bulbs.length) {
      g.strokeStyle = t.night ? 'rgba(20,16,40,0.7)' : 'rgba(70,50,40,0.45)';
      g.lineWidth = 1;
      g.beginPath();
      let pen = false;
      for (const b of this.bulbs) {
        if (Number.isNaN(b.x)) {
          pen = false;
          continue;
        }
        if (pen) g.lineTo(b.x, b.y);
        else g.moveTo(b.x, b.y);
        pen = true;
      }
      g.stroke();
      this.bulbs.forEach((b, k) => {
        if (Number.isNaN(b.x)) return;
        const tw = 0.7 + 0.3 * Math.sin(time * 2 + k * 1.7);
        if (t.night) {
          g.fillStyle = `rgba(255,214,130,${0.22 * tw})`;
          g.beginPath();
          g.arc(b.x, b.y, 6, 0, Math.PI * 2);
          g.fill();
        }
        g.globalAlpha = tw;
        g.fillStyle = b.c;
        g.beginPath();
        g.arc(b.x, b.y + 1, 1.8, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
      });
    }
    for (const [x, y] of this.lamps) {
      const r = 26 + Math.sin(time * 3 + x) * 1.5;
      const glow = g.createRadialGradient(x, y, 1, x, y, r);
      glow.addColorStop(0, 'rgba(255,220,140,0.55)');
      glow.addColorStop(1, 'rgba(255,220,140,0)');
      g.fillStyle = glow;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    if (this.beacon) this.drawBeam(g, this.beacon, time);
    if (t.night) {
      for (const f of this.flies) {
        const a = 0.5 + 0.5 * Math.sin(time * 2.3 + f.ph);
        g.fillStyle = `rgba(230,255,150,${a * 0.8})`;
        g.beginPath();
        g.arc(f.x + Math.sin(time * 0.7 + f.ph) * 14, f.y + Math.cos(time * 0.5 + f.ph) * 8, 1.6, 0, Math.PI * 2);
        g.fill();
      }
    }
    for (const s of this.weeds) {
      const sway = Math.sin(time * 1.3 + s.x * 0.1) * 5;
      g.strokeStyle = s.c;
      g.lineWidth = 2.5;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.quadraticCurveTo(s.x - sway, s.y - s.h * 0.5, s.x + sway, s.y - s.h);
      g.stroke();
    }
    this.drawWater(g, t, w, h, time);
    if (t.underwater) this.drawDeepLife(g, w, h, time);
    else if (!t.night) this.drawBirds(g, w, time);
  }

  private drawWater(g: CanvasRenderingContext2D, t: Theme, w: number, h: number, time: number) {
    const wy = this.waterY;
    if (wy >= h - 4) return;
    // Night: the lit windows shimmer on the water.
    if (t.night) {
      for (const x of this.lit) {
        for (let k = 0; k < 4; k++) {
          const y = wy + 8 + k * 7;
          const off = Math.sin(time * 2 + x + k) * 3;
          g.fillStyle = `rgba(255,217,138,${0.35 - k * 0.07})`;
          g.fillRect(x - 3 + off, y, 6 - k, 1.5);
        }
      }
    }
    if (!t.underwater) {
      g.strokeStyle = t.night ? 'rgba(200,210,255,0.3)' : 'rgba(255,255,255,0.5)';
      g.lineWidth = 1.2;
      g.lineCap = 'round';
      const rng = new Rng(this.seed * 31 + 7);
      g.beginPath();
      for (let k = 0; k < 16; k++) {
        const y = wy + 10 + rng.next() * (h - wy - 14);
        const x = ((rng.next() * w + time * (4 + rng.next() * 6)) % (w + 40)) - 20;
        const len = 5 + rng.next() * 10;
        g.moveTo(x, y);
        g.quadraticCurveTo(x + len / 2, y - 2, x + len, y);
      }
      g.stroke();
    }
    const bob = (k: number) => Math.sin(time * 1.6 + k) * 1.2;
    switch (this.theme) {
      case 'harbour':
        for (let k = 0; k < 2; k++) {
          const x = ((time * (8 + k * 5) + k * w * 0.55) % (w + 80)) - 40;
          const y = wy + 26 + k * 30 + bob(k);
          if (y < h - 6) sailboat(g, x, y, 24 + k * 4, t.boat, k ? '#E07A5F' : '#2F6F8F', Math.sin(time * 1.6 + k) * 0.05);
        }
        break;
      case 'garden':
        for (let k = 0; k < 3; k++) {
          const x = ((time * 5 + k * 26 + 40) % (w + 60)) - 30;
          duck(g, x, wy + 30 + (k % 2) * 5 + bob(k) * 0.5, k === 0 ? 1.15 : 0.8);
        }
        break;
      case 'market':
        gondola(g, ((time * 9) % (w + 120)) - 60, wy + 28 + bob(0), t.boat, true, false);
        break;
      case 'night':
        gondola(g, w - (((time * 7) % (w + 120)) - 60), wy + 30 + bob(0), t.boat, false, true);
        break;
    }
  }

  /** The lighthouse beam sweeping slowly over the harbour. */
  private drawBeam(g: CanvasRenderingContext2D, [x, y]: Pt, time: number) {
    const phase = Math.sin(time * 0.9);
    const dir = phase >= 0 ? 1 : -1;
    const len = 150 * Math.abs(phase);
    const grad = g.createLinearGradient(x, y, x + dir * len, y);
    grad.addColorStop(0, 'rgba(255,240,200,0.55)');
    grad.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(x, y - 3);
    g.lineTo(x + dir * len, y - 18);
    g.lineTo(x + dir * len, y + 14);
    g.lineTo(x, y + 3);
    g.closePath();
    g.fill();
  }

  private drawClouds(g: CanvasRenderingContext2D, w: number, time: number) {
    // A soft sun glow, then a few puffy clouds drifting.
    const sx = w * 0.78, sy = Math.min(70, this.skyY * 0.3);
    const sun = g.createRadialGradient(sx, sy, 4, sx, sy, 90);
    sun.addColorStop(0, 'rgba(255,248,225,0.9)');
    sun.addColorStop(0.2, 'rgba(255,240,210,0.5)');
    sun.addColorStop(1, 'rgba(255,240,210,0)');
    g.fillStyle = sun;
    g.fillRect(sx - 90, sy - 90, 180, 180);
    g.fillStyle = 'rgba(255,255,255,0.75)';
    for (let k = 0; k < 3; k++) {
      const x = ((time * (3 + k) + k * 170) % (w + 160)) - 80;
      const y = this.skyY * (0.22 + k * 0.17);
      g.beginPath();
      g.ellipse(x, y, 28, 7, 0, 0, Math.PI * 2);
      g.arc(x - 9, y - 4, 9, 0, Math.PI * 2);
      g.arc(x + 6, y - 6, 11, 0, Math.PI * 2);
      g.fill();
    }
  }

  private drawNightSky(g: CanvasRenderingContext2D, w: number, time: number) {
    const rng = new Rng(this.seed * 7 + 3);
    for (let k = 0; k < 40; k++) {
      const x = rng.next() * w, y = rng.next() * this.skyY * 0.85;
      g.fillStyle = `rgba(255,250,240,${0.35 + 0.35 * Math.sin(time * (0.7 + rng.next()) + k)})`;
      g.fillRect(x, y, 1.5, 1.5);
    }
    // A small crescent moon with a halo.
    const mx = w * 0.26, my = Math.max(110, this.skyY * 0.5);
    const halo = g.createRadialGradient(mx, my, 6, mx, my, 50);
    halo.addColorStop(0, 'rgba(255,240,210,0.35)');
    halo.addColorStop(1, 'rgba(255,240,210,0)');
    g.fillStyle = halo;
    g.fillRect(mx - 50, my - 50, 100, 100);
    // Crescent: the moon's disc minus a second disc, traced along their intersections.
    const r1 = 13, r2 = 11, cx = mx + 6, cy = my - 4;
    const d = Math.hypot(cx - mx, cy - my);
    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const base = Math.atan2(cy - my, cx - mx);
    const half = Math.acos(a / r1);
    const p1 = base - half, p2 = base + half;
    const q = (px: number, py: number) => Math.atan2(py - cy, px - cx);
    g.fillStyle = '#FFF1CF';
    g.beginPath();
    g.arc(mx, my, r1, p2, p1 + Math.PI * 2);
    g.arc(cx, cy, r2, q(mx + r1 * Math.cos(p1), my + r1 * Math.sin(p1)), q(mx + r1 * Math.cos(p2), my + r1 * Math.sin(p2)), true);
    g.fill();
  }

  private drawBirds(g: CanvasRenderingContext2D, w: number, time: number) {
    g.strokeStyle = 'rgba(60,70,80,0.5)';
    g.lineWidth = 1.4;
    for (let k = 0; k < 3; k++) {
      const x = ((time * (12 + k * 4) + k * 140) % (w + 160)) - 80;
      const y = this.skyY * 0.3 + k * 16 + Math.sin(time * 0.8 + k) * 6;
      const flap = Math.sin(time * 7 + k * 2) * 3;
      g.beginPath();
      g.moveTo(x - 5, y - flap);
      g.lineTo(x, y);
      g.lineTo(x + 5, y - flap);
      g.stroke();
    }
  }

  private drawRays(g: CanvasRenderingContext2D, w: number, h: number, time: number) {
    for (let k = 0; k < 4; k++) {
      const x = (k / 4) * w + Math.sin(time * 0.3 + k) * 20;
      const grad = g.createLinearGradient(0, 0, 0, h * 0.8);
      grad.addColorStop(0, 'rgba(210,255,248,0.16)');
      grad.addColorStop(1, 'rgba(210,255,248,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + 50, 0);
      g.lineTo(x + 150, h * 0.8);
      g.lineTo(x + 70, h * 0.8);
      g.closePath();
      g.fill();
    }
  }

  private drawDeepLife(g: CanvasRenderingContext2D, w: number, h: number, time: number) {
    for (const f of this.fish) {
      f.x += f.v / 60;
      if (f.x < -30) f.x = w + 30;
      if (f.x > w + 30) f.x = -30;
      const dir = Math.sign(f.v);
      const y = f.y + Math.sin(time + f.y) * 3;
      g.fillStyle = 'rgba(200,250,240,0.45)';
      g.beginPath();
      g.ellipse(f.x, y, f.s, f.s * 0.45, 0, 0, Math.PI * 2);
      g.moveTo(f.x - dir * f.s, y);
      g.lineTo(f.x - dir * f.s * 1.7, y - f.s * 0.5);
      g.lineTo(f.x - dir * f.s * 1.7, y + f.s * 0.5);
      g.fill();
    }
    g.strokeStyle = 'rgba(220,255,250,0.5)';
    g.lineWidth = 1;
    for (const b of this.bubbles) {
      b.y -= b.v / 60;
      if (b.y < -10) {
        b.y = h + 10;
        b.x = Math.random() * w;
      }
      g.beginPath();
      g.arc(b.x + Math.sin(time * 2 + b.v) * 3, b.y, b.r, 0, Math.PI * 2);
      g.stroke();
    }
  }
}

/** A small sailboat seen from the side, rocking by `tilt` radians. */
function sailboat(g: CanvasRenderingContext2D, x: number, y: number, len: number, hull: string, sail: string, tilt: number) {
  g.save();
  g.translate(x, y);
  g.rotate(tilt);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.beginPath();
  g.ellipse(0, 5, len * 0.6, 2.5, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = hull;
  g.beginPath();
  g.moveTo(-len / 2, -4);
  g.lineTo(len / 2, -4);
  g.lineTo(len / 2 - 6, 3);
  g.lineTo(-len / 2 + 6, 3);
  g.closePath();
  g.fill();
  g.fillStyle = '#6D5B45';
  g.fillRect(-1, -24, 2, 20);
  g.fillStyle = sail;
  g.beginPath();
  g.moveTo(1, -24);
  g.lineTo(13, -6);
  g.lineTo(1, -6);
  g.closePath();
  g.fill();
  g.fillStyle = '#FFF6EE';
  g.beginPath();
  g.moveTo(-1, -20);
  g.lineTo(-10, -6);
  g.lineTo(-1, -6);
  g.closePath();
  g.fill();
  g.restore();
}

function duck(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.fillStyle = 'rgba(0,0,0,0.1)';
  g.beginPath();
  g.ellipse(x, y + 3 * s, 8 * s, 2 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#FBF6EC';
  g.beginPath();
  g.ellipse(x, y, 7 * s, 4 * s, 0, 0, Math.PI * 2);
  g.arc(x + 5 * s, y - 5 * s, 3 * s, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#F2A93B';
  g.beginPath();
  g.moveTo(x + 7.5 * s, y - 5.5 * s);
  g.lineTo(x + 10.5 * s, y - 4.5 * s);
  g.lineTo(x + 7.5 * s, y - 3.8 * s);
  g.fill();
}

/** A gondola seen from the side: laden with crates for the market, carrying a lantern at night. */
function gondola(g: CanvasRenderingContext2D, x: number, y: number, hull: string, cargo: boolean, lantern: boolean) {
  g.fillStyle = 'rgba(0,0,0,0.15)';
  g.beginPath();
  g.ellipse(x, y + 4, 30, 2.5, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = hull;
  g.beginPath();
  g.moveTo(x - 32, y - 8);
  g.quadraticCurveTo(x - 24, y + 3, x, y + 3);
  g.quadraticCurveTo(x + 24, y + 3, x + 32, y - 10);
  g.lineTo(x + 26, y - 3);
  g.lineTo(x - 26, y - 3);
  g.closePath();
  g.fill();
  if (cargo) {
    const cols = ['#E8553F', '#F2A93B', '#8DBF55'];
    for (let k = 0; k < 3; k++) {
      g.fillStyle = '#C89A64';
      g.fillRect(x - 16 + k * 9, y - 9, 8, 6);
      g.fillStyle = cols[k];
      g.beginPath();
      g.arc(x - 12 + k * 9, y - 9.5, 2.5, Math.PI, 0);
      g.fill();
    }
  }
  // The gondolier and the oar.
  g.fillStyle = hull === '#2E2A2E' ? '#3A3440' : '#1A1730';
  g.fillRect(x + 15, y - 17, 4, 14);
  g.fillStyle = '#F1D2B8';
  g.beginPath();
  g.arc(x + 17, y - 20, 2.6, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#F6E7C9';
  g.fillRect(x + 14.5, y - 23.5, 5, 1.5);
  g.strokeStyle = '#6E5440';
  g.lineWidth = 1.3;
  g.beginPath();
  g.moveTo(x + 21, y - 15);
  g.lineTo(x + 28, y + 6);
  g.stroke();
  if (lantern) {
    const glow = g.createRadialGradient(x - 26, y - 14, 1, x - 26, y - 14, 16);
    glow.addColorStop(0, 'rgba(255,220,140,0.7)');
    glow.addColorStop(1, 'rgba(255,220,140,0)');
    g.fillStyle = glow;
    g.fillRect(x - 42, y - 30, 32, 32);
    g.fillStyle = GLOW;
    g.fillRect(x - 28, y - 17, 4, 5);
  }
}
