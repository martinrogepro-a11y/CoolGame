import { Rng } from '../core/rng';

/**
 * Monumental backdrop around the puzzle, in the spirit of the best contemplative puzzle
 * games: a short analogous palette per place (each volume shaded light / mid / dark by
 * face), geometric architecture in true isometric projection, a gradient sky with a large
 * sun, layers of haze, and small signs of life (flags, birds, drifting light motes).
 *
 * The board stays flat and top-down for readability: it becomes the top terrace of a
 * monument whose arched pillar sinks into the mist. Static architecture is cached; only
 * the living details are redrawn each frame.
 */

export type ThemeId = 'garden' | 'harbour' | 'market' | 'night' | 'deep';

interface Theme {
  sky: [string, string, string];
  sun: string | null;
  /** Light (top faces), mid (left faces), dark (right faces), accent (domes, flags). */
  light: string;
  mid: string;
  dark: string;
  accent: string;
  haze: string;
  /** Board terrace: cell colour and slab colour. */
  cell: string;
  slab: string;
  ink: string;
  roof: 'dome' | 'crenel' | 'spire' | 'ruin';
  stars: boolean;
  birds: boolean;
  water: string | null;
  underwater: boolean;
  boat: string;
}

const THEMES: Record<ThemeId, Theme> = {
  garden: {
    sky: ['#FBEBDD', '#F3E4D3', '#DDEBDA'], sun: '#F8C9A9',
    light: '#EEF4E6', mid: '#BCD8B9', dark: '#8FBA9B', accent: '#F2A98E', haze: 'rgba(250,244,234,',
    cell: '#FBF8F1', slab: '#BCD8B9', ink: '#2F3B33', roof: 'dome', stars: false, birds: true, water: null, underwater: false, boat: '#FFF8EE',
  },
  harbour: {
    sky: ['#FFE6D6', '#F9D9CC', '#C6E7E6'], sun: '#FFB79E',
    light: '#E3F4F1', mid: '#93D0CB', dark: '#5FA9AB', accent: '#F28E78', haze: 'rgba(255,240,232,',
    cell: '#FBF9F5', slab: '#93D0CB', ink: '#24393C', roof: 'spire', stars: false, birds: true, water: '#7FC4C6', underwater: false, boat: '#FFF8EE',
  },
  market: {
    sky: ['#FBD9CB', '#F7C1AE', '#F2A792'], sun: '#FDE6D2',
    light: '#F8C2B1', mid: '#EB8C79', dark: '#CC6662', accent: '#FFF4EA', haze: 'rgba(253,228,214,',
    cell: '#FDF6F1', slab: '#EB8C79', ink: '#4A2A28', roof: 'crenel', stars: false, birds: true, water: null, underwater: false, boat: '#FFF4EA',
  },
  night: {
    sky: ['#F6BCCB', '#C79BD8', '#8467BE'], sun: '#F4A1AE',
    light: '#BFA3E6', mid: '#8F70CB', dark: '#614CA1', accent: '#F7B5C7', haze: 'rgba(240,200,225,',
    cell: '#F7F3FB', slab: '#8F70CB', ink: '#2E2344', roof: 'dome', stars: true, birds: false, water: null, underwater: false, boat: '#F7EEF6',
  },
  deep: {
    sky: ['#3A9AA4', '#1D6A7E', '#0B3A52'], sun: null,
    light: '#86D5CB', mid: '#46A1A0', dark: '#27717C', accent: '#F2D99E', haze: 'rgba(150,230,225,',
    cell: '#F2F8F6', slab: '#46A1A0', ink: '#10343F', roof: 'ruin', stars: false, birds: false, water: null, underwater: true, boat: '#F2D99E',
  },
};

export function boatColor(theme: ThemeId): string {
  return THEMES[theme].boat;
}

export function isUnderwater(theme: ThemeId): boolean {
  return THEMES[theme].underwater;
}

/** Colours the board should use so it reads as part of the monument. */
export function boardStyle(theme: ThemeId): { cell: string; slab: string; ink: string; titleOnDark: boolean } {
  const t = THEMES[theme];
  return { cell: t.cell, slab: t.slab, ink: t.ink, titleOnDark: theme === 'deep' };
}

type Pt = [number, number];

const COS = 0.866;
const SIN = 0.5;

function poly(g: CanvasRenderingContext2D, pts: Pt[], fill: string) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
}

interface Prism {
  /** Bottom front corner. */
  F: Pt;
  L: Pt;
  R: Pt;
  Ft: Pt;
  Lt: Pt;
  Rt: Pt;
  Bt: Pt;
}

/** An isometric box: front corner at (cx, by), extents l (to the left) and r (to the right), height h. */
function prism(g: CanvasRenderingContext2D, t: Theme, cx: number, by: number, l: number, r: number, h: number): Prism {
  const F: Pt = [cx, by];
  const L: Pt = [cx - l * COS, by - l * SIN];
  const R: Pt = [cx + r * COS, by - r * SIN];
  const up = (p: Pt): Pt => [p[0], p[1] - h];
  const Ft = up(F), Lt = up(L), Rt = up(R);
  const Bt: Pt = [Lt[0] + Rt[0] - Ft[0], Lt[1] + Rt[1] - Ft[1]];
  poly(g, [L, F, Ft, Lt], t.mid);
  poly(g, [F, R, Rt, Ft], t.dark);
  poly(g, [Lt, Ft, Rt, Bt], t.light);
  return { F, L, R, Ft, Lt, Rt, Bt };
}

/** Point on the left face: u from back (0) to front (1), v from bottom (0) to top (1). */
function onLeft(p: Prism, u: number, v: number): Pt {
  const x = p.L[0] + (p.F[0] - p.L[0]) * u;
  const yb = p.L[1] + (p.F[1] - p.L[1]) * u;
  const yt = p.Lt[1] + (p.Ft[1] - p.Lt[1]) * u;
  return [x, yb + (yt - yb) * v];
}

function onRight(p: Prism, u: number, v: number): Pt {
  const x = p.F[0] + (p.R[0] - p.F[0]) * u;
  const yb = p.F[1] + (p.R[1] - p.F[1]) * u;
  const yt = p.Ft[1] + (p.Rt[1] - p.Ft[1]) * u;
  return [x, yb + (yt - yb) * v];
}

/** A slim arched window cut into a face. */
function windowOn(g: CanvasRenderingContext2D, face: (u: number, v: number) => Pt, u: number, v: number, w: number, h: number, color: string) {
  const a = face(u - w / 2, v);
  const b = face(u + w / 2, v);
  const c = face(u + w / 2, v + h);
  const d = face(u - w / 2, v + h);
  const top = face(u, v + h + w * 0.9);
  g.beginPath();
  g.moveTo(a[0], a[1]);
  g.lineTo(b[0], b[1]);
  g.lineTo(c[0], c[1]);
  g.quadraticCurveTo(top[0] + (c[0] - d[0]) * 0.1, top[1], d[0], d[1]);
  g.closePath();
  g.fillStyle = color;
  g.fill();
}

export class Scene {
  theme: ThemeId = 'harbour';
  seed = 1;
  /** Tower height multiplier (lower on menus, so titles stay readable). */
  scale = 1;
  private far: HTMLCanvasElement | null = null;
  private near: HTMLCanvasElement | null = null;
  private key = '';
  private flags: { x: number; y: number; len: number; dir: number }[] = [];
  private motes: { x: number; y: number; r: number; v: number; ph: number }[] = [];
  private bubbles: { x: number; y: number; r: number; v: number }[] = [];
  private fish: { x: number; y: number; v: number; s: number }[] = [];
  /** Lantern of the harbour lighthouse (for its sweeping beam). */
  private lighthouse: { x: number; y: number } | null = null;
  /** Sea level at the foot of the harbour monument. */
  private seaY = 0;

  draw(g: CanvasRenderingContext2D, w: number, h: number, dpr: number, board: { x: number; y: number; size: number }, time: number) {
    const t = THEMES[this.theme];
    const key = `${this.theme}|${this.scale}|${w}|${h}|${Math.round(board.x)}|${Math.round(board.y)}|${Math.round(board.size)}|${this.seed}|${dpr}`;
    if (key !== this.key) {
      this.key = key;
      this.build(t, w, h, dpr, board);
    }
    // Sky.
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, t.sky[0]);
    sky.addColorStop(0.55, t.sky[1]);
    sky.addColorStop(1, t.sky[2]);
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    if (t.stars) this.drawStars(g, w, board.y, time);
    if (t.underwater) this.drawRays(g, w, h, time);
    // Big sun, breathing slowly.
    if (t.sun) {
      const r = Math.min(w * 0.36, 150) * (1 + Math.sin(time * 0.4) * 0.01);
      const sy = Math.max(r * 0.6 + 60, board.y - r * 0.9);
      g.fillStyle = t.sun;
      g.globalAlpha = 0.85;
      g.beginPath();
      g.arc(w * 0.62, sy, r, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }
    // Far and near architecture with a slight parallax drift: the scene breathes.
    const dx = Math.sin(time * 0.15) * 3;
    if (this.far) g.drawImage(this.far, dx * 0.5, 0, w, h);
    this.drawHaze(g, t, w, board.y, time);
    if (this.near) g.drawImage(this.near, dx, 0, w, h);
    for (const f of this.flags) this.drawFlag(g, t, f.x + dx, f.y, f.len, f.dir, time);
    if (this.theme === 'harbour') this.drawHarbourLife(g, t, w, h, time);
    if (t.birds) this.drawBirds(g, t, w, board.y, time);
    if (t.underwater) this.drawDeepLife(g, w, h, time);
    this.drawMotes(g, t, w, h, time);
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
    const rng = new Rng(this.seed * 977 + 13);
    this.flags = [];
    this.motes = [];
    this.bubbles = [];
    this.fish = [];

    // Far layer: pale silhouettes melting into the sky.
    const far = mk();
    far.g.globalAlpha = 0.35;
    for (let k = 0; k < 4; k++) {
      const cx = rng.range(-20, w + 20);
      this.tower(far.g, t, cx, board.y + 30, rng.range(26, 46), rng.range(26, 46), rng.range(board.y * 0.35, board.y * 0.75) * this.scale, rng, false);
    }
    far.g.globalAlpha = 1;
    this.far = far.c;

    // Near layer: the place's architecture rising behind the terrace, then the pillar under it.
    const near = mk();
    const g = near.g;
    this.lighthouse = null;
    this.seaY = 0;
    const slots = [rng.range(0.06, 0.18), rng.range(0.3, 0.42), rng.range(0.58, 0.7), rng.range(0.82, 0.95)];
    const base = board.y + 10;
    const tall = (k: number) => rng.range(board.y * 0.3, board.y * 0.62) * this.scale * k;
    if (this.theme === 'harbour') {
      // A striped lighthouse on one side, harbour houses with tiled roofs on the others.
      const lhSlot = rng.next() < 0.5 ? 0 : 3;
      slots.forEach((sx, k) => {
        if (k === lhSlot) return;
        this.harbourHouse(g, t, sx * w, base, rng.range(24, 34), rng.range(24, 34), tall(0.55), rng);
      });
      this.drawLighthouse(g, t, slots[lhSlot] * w, base, tall(1.15));
    } else {
      for (const sx of slots) {
        if (rng.next() < 0.2) continue;
        this.tower(g, t, sx * w, base, rng.range(22, 40), rng.range(22, 40), tall(1), rng, true);
      }
      if (this.theme === 'garden')
        for (let k = 0; k < 5; k++) this.tree(g, t, ((k + rng.range(0.2, 0.8)) / 5) * w, board.y + 4, rng.range(16, 26));
    }
    if (board.size > 0) this.pillar(g, t, w, h, board);
    else {
      // Menu backdrop: no terrace, the towers simply sink into the mist.
      const fog = g.createLinearGradient(0, board.y - 120, 0, h);
      fog.addColorStop(0, t.haze + '0)');
      fog.addColorStop(1, t.haze + '1)');
      g.fillStyle = fog;
      g.fillRect(0, board.y - 120, w, h - board.y + 120);
    }
    this.near = near.c;

    // Light motes and sea life.
    const r2 = new Rng(this.seed + 5);
    for (let k = 0; k < 22; k++) this.motes.push({ x: r2.next() * w, y: r2.next() * h, r: 0.8 + r2.next() * 1.8, v: 3 + r2.next() * 8, ph: r2.next() * 6 });
    if (t.underwater) {
      for (let k = 0; k < 18; k++) this.bubbles.push({ x: r2.next() * w, y: r2.next() * h, r: 1.5 + r2.next() * 3, v: 10 + r2.next() * 20 });
      for (let k = 0; k < 4; k++) this.fish.push({ x: r2.next() * w, y: 60 + r2.next() * Math.max(40, board.y - 120), v: (r2.next() < 0.5 ? -1 : 1) * (8 + r2.next() * 10), s: 6 + r2.next() * 5 });
    }
  }

  /** A tower: stacked prisms with windows, crowned by the theme's roof. */
  private tower(g: CanvasRenderingContext2D, t: Theme, cx: number, base: number, l: number, r: number, height: number, rng: Rng, details: boolean) {
    const tiers = 1 + rng.int(0, 3);
    let by = base;
    let ll = l, rr = r;
    let p: Prism | null = null;
    for (let k = 0; k < tiers; k++) {
      const hh = (height / tiers) * (k === 0 ? 1.2 : 0.9);
      p = prism(g, t, cx, by, ll, rr, hh);
      if (details) {
        const rows = Math.max(1, Math.floor(hh / 40));
        for (let row = 0; row < rows; row++) {
          const v = (row + 0.35) / rows;
          const lit = this.theme === 'night' && rng.next() < 0.6;
          windowOn(g, (u, vv) => onLeft(p!, u, vv), 0.5, v, 0.22, 0.16 / rows * 1.6, lit ? '#FFE2A3' : t.dark);
          windowOn(g, (u, vv) => onRight(p!, u, vv), 0.5, v, 0.2, 0.16 / rows * 1.6, lit && rng.next() < 0.7 ? '#F6CB84' : 'rgba(0,0,0,0.22)');
        }
        // Market stalls: striped awnings around the ground floor.
        if (k === 0 && this.theme === 'market') {
          const n = 6;
          for (let sI = 0; sI < n; sI++) {
            const col = sI % 2 ? t.accent : t.dark;
            const q = (face: (u: number, v: number) => Pt): Pt[] => [face(sI / n, 0.16), face((sI + 1) / n, 0.16), face((sI + 1) / n, 0.24), face(sI / n, 0.24)];
            poly(g, q((u, vv) => onLeft(p!, u, vv)), col);
            poly(g, q((u, vv) => onRight(p!, u, vv)), sI % 2 ? '#E9D6C8' : t.dark);
          }
        }
        // Cornice between tiers.
        poly(g, [p.Lt, p.Ft, [p.Ft[0], p.Ft[1] + 3], [p.Lt[0], p.Lt[1] + 3]], t.light);
      }
      by -= hh;
      ll *= 0.78;
      rr *= 0.78;
    }
    if (!p) return;
    const top: Pt = [(p.Lt[0] + p.Rt[0]) / 2, (p.Lt[1] + p.Rt[1]) / 2];
    const rad = Math.min(ll, rr) * 0.9;
    switch (t.roof) {
      case 'dome': {
        prism(g, t, top[0], top[1] + rad * 0.45, rad * 0.8, rad * 0.8, rad * 0.5);
        const cy = top[1] - rad * 0.2;
        const grad = g.createLinearGradient(top[0] - rad, 0, top[0] + rad, 0);
        grad.addColorStop(0, t.accent);
        grad.addColorStop(1, t.dark);
        g.fillStyle = grad;
        g.beginPath();
        g.ellipse(top[0], cy, rad, rad * 1.05, 0, Math.PI, 0);
        g.fill();
        g.fillStyle = t.dark;
        g.fillRect(top[0] - 1, cy - rad * 1.05 - 12, 2, 12);
        if (details) this.flags.push({ x: top[0] + 1, y: cy - rad * 1.05 - 12, len: rad * 1.6, dir: 1 });
        break;
      }
      case 'spire': {
        g.fillStyle = t.accent;
        g.beginPath();
        g.moveTo(p.Lt[0], p.Lt[1]);
        g.lineTo(top[0], top[1] - rad * 2.4);
        g.lineTo(p.Ft[0], p.Ft[1]);
        g.closePath();
        g.fill();
        g.fillStyle = t.dark;
        g.beginPath();
        g.moveTo(p.Ft[0], p.Ft[1]);
        g.lineTo(top[0], top[1] - rad * 2.4);
        g.lineTo(p.Rt[0], p.Rt[1]);
        g.closePath();
        g.fill();
        if (details) this.flags.push({ x: top[0], y: top[1] - rad * 2.4, len: rad * 1.4, dir: 1 });
        break;
      }
      case 'crenel': {
        const n = 4;
        for (let k = 0; k < n; k++) {
          const a = onLeft({ ...p, F: p.Ft, L: p.Lt, R: p.Rt, Ft: p.Ft, Lt: p.Lt, Rt: p.Rt, Bt: p.Bt }, (k + 0.5) / n, 0);
          prism(g, t, a[0], a[1], 4, 4, 8);
          const b = onRight({ ...p, F: p.Ft, L: p.Lt, R: p.Rt, Ft: p.Ft, Lt: p.Lt, Rt: p.Rt, Bt: p.Bt }, (k + 0.5) / n, 0);
          prism(g, t, b[0], b[1], 4, 4, 8);
        }
        if (details && rng.next() < 0.6) this.flags.push({ x: top[0], y: top[1] - 26, len: 22, dir: 1 });
        if (details) {
          g.fillStyle = t.dark;
          g.fillRect(top[0] - 1, top[1] - 26, 2, 26);
        }
        break;
      }
      case 'ruin': {
        // Broken top: a jagged cut and a fallen block.
        g.fillStyle = t.sky[2];
        g.globalAlpha = 0.5;
        g.beginPath();
        g.moveTo(p.Lt[0], p.Lt[1]);
        g.lineTo(top[0] - 4, top[1] + 10);
        g.lineTo(top[0] + 6, top[1] - 2);
        g.lineTo(p.Rt[0], p.Rt[1] + 6);
        g.lineTo(p.Bt[0], p.Bt[1] - 4);
        g.closePath();
        g.fill();
        g.globalAlpha = 1;
        break;
      }
    }
  }

  /** The board's pedestal: a thick terrace with an arcaded pillar sinking into the haze. */
  private pillar(g: CanvasRenderingContext2D, t: Theme, w: number, h: number, b: { x: number; y: number; size: number }) {
    const depth = 16;
    const thick = 22;
    const bottom = b.y + b.size;
    // Right side of the terrace (gives the slab volume).
    poly(g, [[b.x + b.size, b.y + 4], [b.x + b.size + depth * COS, b.y + 4 - depth * SIN], [b.x + b.size + depth * COS, bottom + thick - depth * SIN], [b.x + b.size, bottom + thick]], t.dark);
    // Front face of the terrace.
    g.fillStyle = t.mid;
    g.fillRect(b.x, bottom - 6, b.size, thick + 6);
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(b.x, bottom + thick - 4, b.size, 2);
    // The pillar: slightly narrower, with tall arches, down to the bottom of the screen.
    const inset = b.size * 0.08;
    const px = b.x + inset, pw = b.size - inset * 2;
    const top = bottom + thick;
    g.fillStyle = t.mid;
    g.fillRect(px, top, pw, h - top);
    poly(g, [[px + pw, top], [px + pw + depth * COS, top - depth * SIN], [px + pw + depth * COS, h], [px + pw, h]], t.dark);
    const arches = Math.max(2, Math.round(pw / 70));
    const aw = pw / arches;
    for (let k = 0; k < arches; k++) {
      const ax = px + k * aw + aw * 0.22;
      const awi = aw * 0.56;
      const ay = top + 26;
      g.fillStyle = t.dark;
      g.beginPath();
      g.moveTo(ax, h);
      g.lineTo(ax, ay + awi / 2);
      g.arc(ax + awi / 2, ay + awi / 2, awi / 2, Math.PI, 0);
      g.lineTo(ax + awi, h);
      g.closePath();
      g.fill();
    }
    // The harbour monument stands in the sea; elsewhere it sinks into haze.
    if (t.water) {
      const seaY = top + 70;
      this.seaY = seaY;
      const sea = g.createLinearGradient(0, seaY, 0, h);
      sea.addColorStop(0, t.water);
      sea.addColorStop(1, t.dark);
      g.fillStyle = sea;
      g.fillRect(0, seaY, w, h - seaY);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(0, seaY, w, 2);
      // Foam ring where the pillar meets the water.
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.beginPath();
      g.ellipse(px + pw / 2 + 6, seaY + 3, pw / 2 + 18, 5, 0, 0, Math.PI * 2);
      g.fill();
      return;
    }
    // Haze swallowing the pillar.
    const fog = g.createLinearGradient(0, top + 40, 0, h);
    fog.addColorStop(0, t.haze + '0)');
    fog.addColorStop(1, t.haze + '0.95)');
    g.fillStyle = fog;
    g.fillRect(0, top + 40, w, h - top - 40);
  }

  /** A harbour house: an iso block with a pitched, tiled roof and shuttered windows. */
  private harbourHouse(g: CanvasRenderingContext2D, t: Theme, cx: number, by: number, l: number, r: number, h: number, rng: Rng) {
    const p = prism(g, t, cx, by, l, r, h);
    const rows = Math.max(1, Math.floor(h / 34));
    for (let row = 0; row < rows; row++) {
      const v = (row + 0.4) / rows;
      windowOn(g, (u, vv) => onLeft(p, u, vv), 0.35, v, 0.2, 0.12, t.dark);
      windowOn(g, (u, vv) => onLeft(p, u, vv), 0.72, v, 0.2, 0.12, t.dark);
      windowOn(g, (u, vv) => onRight(p, u, vv), 0.5, v, 0.22, 0.12, 'rgba(0,0,0,0.22)');
    }
    // Door on the left face.
    poly(g, [onLeft(p, 0.45, 0), onLeft(p, 0.62, 0), onLeft(p, 0.62, 0.22 / rows), onLeft(p, 0.45, 0.22 / rows)], t.dark);
    // Pitched roof: ridge parallel to the right face.
    const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const rh = Math.min(l, r) * 0.7;
    const m1 = mid(p.Lt, p.Ft), m2 = mid(p.Bt, p.Rt);
    const r1: Pt = [m1[0], m1[1] - rh], r2: Pt = [m2[0], m2[1] - rh];
    const roofLight = rng.next() < 0.5 ? t.accent : '#E8A48F';
    poly(g, [p.Lt, r1, r2, p.Bt], roofLight);
    poly(g, [p.Lt, p.Ft, r1], t.mid);
    poly(g, [r1, p.Ft, p.Rt, r2], '#C8705E');
  }

  /** A tapered, red-and-white striped lighthouse with a glowing lantern room. */
  private drawLighthouse(g: CanvasRenderingContext2D, t: Theme, cx: number, by: number, h: number) {
    const r0 = 20, r1 = 14;
    const bands = 6;
    for (let k = 0; k < bands; k++) {
      const y0 = by - (h * k) / bands, y1 = by - (h * (k + 1)) / bands;
      const ra = r0 + (r1 - r0) * (k / bands), rb = r0 + (r1 - r0) * ((k + 1) / bands);
      const grad = g.createLinearGradient(cx - ra, 0, cx + ra, 0);
      const red = k % 2 === 1;
      grad.addColorStop(0, red ? '#F49A86' : '#FFF6EE');
      grad.addColorStop(0.55, red ? '#E0705C' : '#F2E3D6');
      grad.addColorStop(1, red ? '#B4524A' : '#C9B8AE');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(cx - ra, y0);
      g.ellipse(cx, y0, ra, ra * 0.35, 0, Math.PI, 0, true);
      g.lineTo(cx + rb, y1);
      g.ellipse(cx, y1, rb, rb * 0.35, 0, 0, Math.PI, true);
      g.closePath();
      g.fill();
    }
    const top = by - h;
    // Gallery, lantern room and cap.
    g.fillStyle = t.dark;
    g.beginPath();
    g.ellipse(cx, top, r1 + 6, (r1 + 6) * 0.35, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#FFE9B4';
    g.fillRect(cx - 9, top - 18, 18, 18);
    g.fillStyle = t.dark;
    g.fillRect(cx - 1, top - 18, 2, 18);
    g.beginPath();
    g.ellipse(cx, top - 18, 12, 10, 0, Math.PI, 0);
    g.fill();
    g.fillRect(cx - 1, top - 34, 2, 8);
    this.lighthouse = { x: cx, y: top - 9 };
  }

  /** A round garden tree with three-tone foliage. */
  private tree(g: CanvasRenderingContext2D, t: Theme, x: number, by: number, r: number) {
    g.fillStyle = 'rgba(0,0,0,0.08)';
    g.beginPath();
    g.ellipse(x + 3, by, r * 0.9, r * 0.3, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#8C6E58';
    g.fillRect(x - 2, by - r * 0.9, 4, r * 0.9);
    g.fillStyle = t.dark;
    g.beginPath();
    g.arc(x + r * 0.15, by - r * 1.25, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = t.mid;
    g.beginPath();
    g.arc(x - r * 0.1, by - r * 1.35, r * 0.85, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = t.light;
    g.beginPath();
    g.arc(x - r * 0.35, by - r * 1.6, r * 0.38, 0, Math.PI * 2);
    g.fill();
  }

  // ---------------------------------------------------------------- living details

  /** Harbour life: the lighthouse beam sweeping, waves, sailboats and buoys on the sea. */
  private drawHarbourLife(g: CanvasRenderingContext2D, t: Theme, w: number, h: number, time: number) {
    if (this.lighthouse) {
      const { x, y } = this.lighthouse;
      const phase = Math.sin(time * 0.9);
      const dir = phase >= 0 ? 1 : -1;
      const len = 170 * Math.abs(phase);
      const grad = g.createLinearGradient(x, y, x + dir * len, y);
      grad.addColorStop(0, 'rgba(255,240,200,0.55)');
      grad.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(x, y - 3);
      g.lineTo(x + dir * len, y - 22);
      g.lineTo(x + dir * len, y + 18);
      g.lineTo(x, y + 3);
      g.closePath();
      g.fill();
    }
    if (!this.seaY) return;
    const sea = this.seaY;
    // Waves: short white strokes drifting.
    g.strokeStyle = 'rgba(255,255,255,0.45)';
    g.lineWidth = 1.5;
    g.lineCap = 'round';
    const rng = new Rng(this.seed * 31 + 7);
    g.beginPath();
    for (let k = 0; k < 18; k++) {
      const y = sea + 10 + rng.next() * (h - sea - 14);
      const x = ((rng.next() * w + time * (6 + rng.next() * 8)) % (w + 40)) - 20;
      const len = 6 + rng.next() * 12;
      g.moveTo(x, y);
      g.quadraticCurveTo(x + len / 2, y - 3, x + len, y);
    }
    g.stroke();
    // Two sailboats crossing slowly, bobbing on the swell.
    for (let k = 0; k < 2; k++) {
      const speed = 9 + k * 5;
      const x = ((time * speed + k * w * 0.55) % (w + 80)) - 40;
      const y = sea + 22 + k * 30 + Math.sin(time * 1.6 + k) * 1.5;
      if (y < h - 10) sailboat(g, x, y, 24 + k * 4, t.boat, k ? t.accent : t.dark, Math.sin(time * 1.6 + k) * 0.05);
    }
    // Buoys.
    for (let k = 0; k < 2; k++) {
      const x = w * (0.2 + k * 0.62);
      const y = sea + 16 + k * 10 + Math.sin(time * 2 + k * 2) * 2;
      g.fillStyle = '#E0705C';
      g.beginPath();
      g.arc(x, y, 4, Math.PI, 0);
      g.fill();
      g.fillStyle = '#FFF6EE';
      g.fillRect(x - 4, y, 8, 2.5);
    }
  }


  private drawHaze(g: CanvasRenderingContext2D, t: Theme, w: number, boardY: number, time: number) {
    for (let k = 0; k < 3; k++) {
      const y = boardY * (0.55 + k * 0.17);
      const x = ((time * (6 + k * 3) + k * 200) % (w + 400)) - 200;
      // A soft elliptical bank of mist (a squashed radial gradient, so it has no edges).
      g.save();
      g.translate(x, y);
      g.scale(1, 0.32);
      const grad = g.createRadialGradient(0, 0, 10, 0, 0, 230);
      grad.addColorStop(0, t.haze + '0.5)');
      grad.addColorStop(1, t.haze + '0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(0, 0, 230, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }

  private drawFlag(g: CanvasRenderingContext2D, t: Theme, x: number, y: number, len: number, dir: number, time: number) {
    g.fillStyle = t.accent;
    g.beginPath();
    g.moveTo(x, y);
    const seg = 8;
    for (let k = 1; k <= seg; k++) {
      const u = k / seg;
      g.lineTo(x + dir * len * u, y + Math.sin(time * 3 + u * 4) * 2.5 * u + u * 3);
    }
    for (let k = seg; k >= 0; k--) {
      const u = k / seg;
      g.lineTo(x + dir * len * u, y + 7 * (1 - u * 0.7) + Math.sin(time * 3 + u * 4) * 2.5 * u + u * 3);
    }
    g.closePath();
    g.fill();
  }

  private drawBirds(g: CanvasRenderingContext2D, t: Theme, w: number, boardY: number, time: number) {
    g.strokeStyle = t.dark;
    g.globalAlpha = 0.55;
    g.lineWidth = 1.5;
    for (let k = 0; k < 3; k++) {
      const x = ((time * (14 + k * 4) + k * 140) % (w + 160)) - 80;
      const y = boardY * 0.25 + k * 18 + Math.sin(time * 0.8 + k) * 6;
      const flap = Math.sin(time * 7 + k * 2) * 3;
      g.beginPath();
      g.moveTo(x - 6, y - flap);
      g.lineTo(x, y);
      g.lineTo(x + 6, y - flap);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  private drawMotes(g: CanvasRenderingContext2D, t: Theme, w: number, h: number, time: number) {
    g.fillStyle = t.underwater ? 'rgba(220,255,250,0.6)' : 'rgba(255,255,255,0.7)';
    for (const m of this.motes) {
      const y = (((m.y - time * m.v) % h) + h) % h;
      const x = m.x + Math.sin(time * 0.6 + m.ph) * 8;
      g.globalAlpha = 0.25 + 0.35 * Math.sin(time + m.ph) ** 2;
      g.beginPath();
      g.arc(x % w, y, m.r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  private drawStars(g: CanvasRenderingContext2D, w: number, boardY: number, time: number) {
    const rng = new Rng(this.seed * 7 + 3);
    for (let k = 0; k < 36; k++) {
      const x = rng.next() * w, y = rng.next() * boardY * 0.6;
      g.fillStyle = `rgba(255,250,240,${0.35 + 0.35 * Math.sin(time * (0.7 + rng.next()) + k)})`;
      g.fillRect(x, y, 1.6, 1.6);
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
      g.fillStyle = 'rgba(200,250,240,0.4)';
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
