import { Rng } from '../core/rng';

/**
 * Canalia's world: a Mediterranean canal village in mosaic. Low, human-scale houses in
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
  /** Title ink and the mosaic border's tesserae. */
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
    ink: '#2F3B33', tess: ['#6FA88A', '#E6A67E', '#F3E2B8', '#87B9C9'],
    night: false, underwater: false, boat: '#FFF8EE',
  },
  harbour: {
    sky: ['#A9D8EC', '#F6ECDF'],
    walls: ['#FBF6EE', '#BFDDEA', '#F3D79E', '#EBB4A4', '#CFE5D5'],
    roofs: ['#2F6F8F', '#D86F55', '#3F8A9A'],
    shutters: ['#2F6F8F', '#3E8E7E', '#D86F55'],
    greens: ['#5F9670', '#86B583', '#A9CC8C'],
    ground: '#E5DCCB', water: ['#56B3C8', '#2A7F9E'], quay: '#C8BAA4',
    ink: '#24393C', tess: ['#2F6F8F', '#FBF6EE', '#E07A5F', '#7CC3D2'],
    night: false, underwater: false, boat: '#FFF8EE',
  },
  market: {
    sky: ['#F5D3AE', '#FBEBD6'],
    walls: ['#F2B98F', '#EBA084', '#F6DFA9', '#F7E9D6', '#E7C3A4'],
    roofs: ['#C4553F', '#D97A4A', '#B9614A'],
    shutters: ['#3E7C8C', '#6F8F4E', '#7A5A9E'],
    greens: ['#5E8F5A', '#7FA86A', '#A8C47E'],
    ground: '#E9D3B2', water: ['#7BBAB3', '#4D908C'], quay: '#CFAE86',
    ink: '#4A2A28', tess: ['#C4553F', '#F2B23C', '#3E7C8C', '#F6E7C9'],
    night: false, underwater: false, boat: '#2E2A2E',
  },
  night: {
    sky: ['#1C2350', '#5E4D88'],
    walls: ['#6E6A9E', '#8A7CAB', '#5F6C9C', '#9B89AA', '#7C7AA8'],
    roofs: ['#3A3468', '#4B3F7A', '#5A4470'],
    shutters: ['#2B2852', '#3C3466'],
    greens: ['#2F4A5A', '#3D5C68', '#4E6E72'],
    ground: '#4E4977', water: ['#33407A', '#1A2150'], quay: '#423E6C',
    ink: '#2E2344', tess: ['#F2C46B', '#7E6FB0', '#E58FA0', '#4D5C9A'],
    night: true, underwater: false, boat: '#26223F',
  },
  deep: {
    sky: ['#2A93A0', '#0E4A60'],
    walls: ['#7DBDB2', '#62A3A0', '#93CBBC', '#5B9497'],
    roofs: ['#3C7F86'],
    shutters: ['#2D6670'],
    greens: ['#3E9A7E', '#5DB48F', '#2E7F6E'],
    ground: '#6FA195', water: ['#0F4A60', '#072638'], quay: '#4B8682',
    ink: '#10343F', tess: ['#E9C77B', '#3FA39B', '#9FD8CC', '#2D6F7A'],
    night: false, underwater: true, boat: '#F2D99E',
  },
};

/** Ground of each place: stone size (half-width), colours, gaps between stones. */
const PAVING: Record<ThemeId, { kind: 'stone' | 'sand'; size: number; stone: string; alt?: string; joint: string; inset: number; vary: number; moss?: string }> = {
  garden: { kind: 'stone', size: 11, stone: '#E3D7BF', joint: '#C3C09C', inset: 0.9, vary: 0.06, moss: '#9DBB86' },
  harbour: { kind: 'stone', size: 14, stone: '#DCD3C4', joint: '#B5AA97', inset: 0.93, vary: 0.05 },
  market: { kind: 'stone', size: 8, stone: '#E9B994', alt: '#F2DCC0', joint: '#C99A76', inset: 0.9, vary: 0.05 },
  night: { kind: 'stone', size: 7, stone: '#5D5888', joint: '#3E3A66', inset: 0.84, vary: 0.08 },
  deep: { kind: 'sand', size: 10, stone: '#7FAE9F', joint: '#6B998B', inset: 1, vary: 0 },
};

/** Light of each place: where it comes from (fraction of the screen), its tint and strength. */
const LIGHT: Record<ThemeId, { x: number; y: number; rgb: string; a: number; vignette: number }> = {
  garden: { x: 0.8, y: 0.02, rgb: '255,214,160', a: 0.55, vignette: 0.08 },
  harbour: { x: 0.85, y: 0.0, rgb: '255,222,176', a: 0.5, vignette: 0.08 },
  market: { x: 0.75, y: 0.05, rgb: '255,186,120', a: 0.6, vignette: 0.1 },
  night: { x: 0.26, y: 0.12, rgb: '150,160,255', a: 0.45, vignette: 0.22 },
  deep: { x: 0.5, y: -0.1, rgb: '170,255,240', a: 0.45, vignette: 0.25 },
};

/**
 * The board seen from above, as a piece of the place itself (like Mini Motorways' map):
 * grass beds in the garden, a wooden pier over the sea at the harbour, glazed tiles on the
 * market square, cobbles at night, pale sand in the sunken city. Cells stay light and
 * calm so the canals always read first.
 */
const BOARD: Record<ThemeId, { grout: string; cell: string; cell2: string; bank: string; stone: string }> = {
  garden: { grout: '#C3C09C', cell: '#E4EFD0', cell2: '#DCE9C5', bank: '#B49C78', stone: '#DDD2BC' },
  harbour: { grout: '#6FB8C9', cell: '#F0E3CC', cell2: '#E9D9BE', bank: '#A88B67', stone: '#D3C8B6' },
  market: { grout: '#C99A76', cell: '#FAEBD8', cell2: '#F4DDC5', bank: '#C49F77', stone: '#E6D6BF' },
  night: { grout: '#3E3A66', cell: '#E4E0EF', cell2: '#DAD5E8', bank: '#7C76A6', stone: '#BDB7D6' },
  deep: { grout: '#2F7778', cell: '#E2F0EA', cell2: '#D7EAE2', bank: '#4F938F', stone: '#C3DED5' },
};

export interface BoardStyle {
  kind: ThemeId;
  /** Joints between cells (gravel, sea, mortar…). */
  slab: string;
  cell: string;
  cell2: string;
  /** Stone edging of the canals, and of the fountains. */
  bank: string;
  stone: string;
  ink: string;
  titleOnDark: boolean;
  tess: string[];
}

/** Colours and materials the board uses so it reads as part of the place. */
export function boardStyle(theme: ThemeId): BoardStyle {
  const t = THEMES[theme], b = BOARD[theme];
  return { kind: theme, slab: b.grout, cell: b.cell, cell2: b.cell2, bank: b.bank, stone: b.stone, ink: t.ink, titleOnDark: t.night || t.underwater, tess: t.tess };
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

/** Blends two #rrggbb colours (k = share of b). */
function mix(a: string, b: string, k: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(',')})`;
}

function poly(g: CanvasRenderingContext2D, pts: Pt[], fill: string | CanvasGradient) {
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

type RoofStyle = 'gable' | 'gableX' | 'hip' | 'flat';

/** How often each roof shape appears in each place (they add up to 1). */
const ROOFS: Record<ThemeId, Partial<Record<RoofStyle, number>>> = {
  garden: { gable: 0.55, gableX: 0.3, hip: 0.15 },
  harbour: { gable: 0.4, gableX: 0.35, flat: 0.25 },
  market: { gable: 0.3, gableX: 0.25, flat: 0.35, hip: 0.1 },
  night: { gable: 0.45, gableX: 0.3, flat: 0.25 },
  deep: { gable: 1 },
};

/** An arched opening on a face (door, arcade). */
function arch(g: CanvasRenderingContext2D, f: Face, u0: number, u1: number, v0: number, v1: number, col: string) {
  const a = f(u0, v0), b = f(u1, v0), c = f(u1, v1), d = f(u0, v1);
  const top = f((u0 + u1) / 2, v1 + (v1 - v0) * 0.28);
  g.beginPath();
  g.moveTo(a[0], a[1]);
  g.lineTo(b[0], b[1]);
  g.lineTo(c[0], c[1]);
  g.quadraticCurveTo(top[0], top[1], d[0], d[1]);
  g.closePath();
  g.fillStyle = col;
  g.fill();
}

/** Side of a building lot on the isometric grid. */
const LOT = 17;

interface Lot {
  x: number;
  by: number;
  k: number;
  /** Highest a landmark on this lot may rise (keeps it below the top bar). */
  cap?: number;
}

/** A house as built: its box, its gable peak (for garlands) and its door (for pots). */
interface Built {
  p: Box;
  peak: Pt;
  door: Pt;
}

/** A terracotta pot with a round shrub, sometimes in flower. */
function pot(g: CanvasRenderingContext2D, x: number, by: number, rng: Rng, greens: string[]) {
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.beginPath();
  g.ellipse(x + 1, by, 4, 1.4, 0, 0, Math.PI * 2);
  g.fill();
  poly(g, [[x - 3, by - 5], [x + 3, by - 5], [x + 2.2, by], [x - 2.2, by]], '#C9724F');
  g.fillStyle = '#A85B3D';
  g.fillRect(x - 3, by - 5, 6, 1.2);
  g.fillStyle = rng.pick(greens);
  g.beginPath();
  g.arc(x, by - 8, 3.6, 0, Math.PI * 2);
  g.fill();
  if (rng.next() < 0.5) {
    g.fillStyle = rng.pick(FLOWERS);
    g.fillRect(x - 1.5, by - 10, 1.6, 1.6);
    g.fillRect(x + 1, by - 8, 1.6, 1.6);
  }
}

/** A small pennant flying from a pole. */
function flag(g: CanvasRenderingContext2D, x: number, y: number, col: string) {
  g.fillStyle = '#4E4A46';
  g.fillRect(x - 0.5, y - 14, 1, 14);
  poly(g, [[x + 0.5, y - 14], [x + 9, y - 11.5], [x + 0.5, y - 9]], col);
}

/** A terracotta amphora, standing or lying at an angle. */
function amphora(g: CanvasRenderingContext2D, x: number, by: number, tilt: number) {
  g.save();
  g.translate(x, by);
  g.fillStyle = 'rgba(0,30,40,0.18)';
  g.beginPath();
  g.ellipse(1, 0, 5, 1.6, 0, 0, Math.PI * 2);
  g.fill();
  g.rotate(tilt);
  g.fillStyle = '#C9825F';
  g.beginPath();
  g.moveTo(-1, 0);
  g.quadraticCurveTo(-5.5, -5, -2, -11);
  g.lineTo(-1.2, -14);
  g.lineTo(1.2, -14);
  g.lineTo(2, -11);
  g.quadraticCurveTo(5.5, -5, 1, 0);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.fillRect(-3, -9, 1.2, 5);
  g.strokeStyle = '#A9643F';
  g.lineWidth = 0.8;
  g.beginPath();
  g.arc(-2.6, -11.5, 1.6, Math.PI * 0.5, Math.PI * 1.4);
  g.arc(2.6, -11.5, 1.6, -Math.PI * 0.4, Math.PI * 0.5);
  g.stroke();
  g.restore();
}

/** A wooden bench on the sidewalk. */
function bench(g: CanvasRenderingContext2D, x: number, by: number) {
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.beginPath();
  g.ellipse(x, by + 1, 8, 2, 0, 0, Math.PI * 2);
  g.fill();
  box(g, x, by - 2, 8, 2.5, 1.5, '#A87A52');
  box(g, x - 1.2, by - 4.5, 8, 0.8, 4, '#946A47');
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
  /** Village elements restored by the player (see meta/village.ts); the rest sleeps. */
  restored = new Set<string>();
  /** While true, props draw into a throwaway canvas and leave no living details behind. */
  private mute = false;
  private sinkCtx: CanvasRenderingContext2D | null = null;
  /** Sky, scenery, light and grain, composed once per layout. */
  private stat: HTMLCanvasElement | null = null;
  private key = '';
  private fountains: Pt[] = [];
  /** Chimney tops, for their wisps of smoke. */
  private smokes: Pt[] = [];
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
  /** The buildings alone (for their reflection in the water), and the line they stand on. */
  private bld: HTMLCanvasElement | null = null;
  private groundY = 0;
  private grain: CanvasPattern | null = null;
  private skyY = 0;

  draw(g: CanvasRenderingContext2D, w: number, h: number, dpr: number, board: { x: number; y: number; size: number }, time: number) {
    const t = THEMES[this.theme];
    const key = `${this.theme}|${[...this.restored].join()}|${this.scale}|${w}|${h}|${Math.round(board.x)}|${Math.round(board.y)}|${Math.round(board.size)}|${this.seed}|${dpr}`;
    if (key !== this.key) {
      this.key = key;
      this.build(t, w, h, dpr, board);
    }
    // Everything that never moves (sky, moon or sun, scenery, light, grain) is one cached
    // image: a single copy per frame, then only the living details on top.
    if (this.stat) g.drawImage(this.stat, 0, 0, w, h);
    if (t.night) this.drawStars(g, w, time);
    else if (t.underwater) this.drawRays(g, w, h, time);
    else this.drawClouds(g, w, time);
    this.drawLife(g, t, w, h, time);
  }

  /**
   * The light of the place, like Alto's skies: a soft-light wash from the sun (or moon),
   * a gentle vignette, and a fine paper grain so the flat colours feel printed, not digital.
   */
  private drawLight(g: CanvasRenderingContext2D, w: number, h: number) {
    const L = LIGHT[this.theme];
    g.save();
    g.globalCompositeOperation = 'soft-light';
    const lx = w * L.x, ly = h * L.y, r = Math.max(w, h) * 1.1;
    const wash = g.createRadialGradient(lx, ly, 0, lx, ly, r);
    wash.addColorStop(0, `rgba(${L.rgb},${L.a})`);
    wash.addColorStop(1, `rgba(${L.rgb},0)`);
    g.fillStyle = wash;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
    const vig = g.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.45, w / 2, h * 0.45, Math.max(w, h) * 0.85);
    vig.addColorStop(0, 'rgba(20,16,30,0)');
    vig.addColorStop(1, `rgba(20,16,30,${L.vignette})`);
    g.fillStyle = vig;
    g.fillRect(0, 0, w, h);
    if (!this.grain) {
      const c = document.createElement('canvas');
      c.width = c.height = 160;
      const cg = c.getContext('2d')!;
      const img = cg.createImageData(160, 160);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() < 0.5 ? 0 : 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = Math.random() * 38;
      }
      cg.putImageData(img, 0, 0);
      this.grain = g.createPattern(c, 'repeat');
    }
    if (this.grain) {
      g.globalCompositeOperation = 'overlay';
      g.globalAlpha = 0.5;
      g.fillStyle = this.grain;
      g.fillRect(0, 0, w, h);
    }
    g.restore();
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
    this.smokes = [];
    const menu = board.size === 0;
    // In levels the houses stand back from the board, leaving a sidewalk for the props.
    const ground = menu ? board.y : board.y - 42;
    const quayY = menu ? ground + Math.min(80, (h - ground) * 0.42) : board.y + board.size + 30;
    this.skyY = ground - 16;
    this.waterY = quayY + 9;
    const P: Place = { rng: new Rng(this.seed * 977 + 13), t, w, ground, scale: this.scale };

    const far = mk();
    this.farLayer(far.g, P);

    const near = mk();
    const g = near.g;
    this.paving(g, t, w, ground - 20, quayY);
    // The place is drawn on its own layer, kept for its reflection in the water.
    const bld = mk();
    switch (this.theme) {
      case 'garden': this.garden(bld.g, P); break;
      case 'harbour': this.harbour(bld.g, P); break;
      case 'market': this.market(bld.g, P); break;
      case 'night': this.village(bld.g, P); break;
      case 'deep': this.ruins(bld.g, P); break;
    }
    g.drawImage(bld.c, 0, 0, w, h);
    this.bld = bld.c;
    this.groundY = ground;
    this.quayAndWater(g, t, w, h, quayY);

    const stat = mk();
    const sg = stat.g;
    const sky = sg.createLinearGradient(0, 0, 0, this.skyY);
    sky.addColorStop(0, t.sky[0]);
    sky.addColorStop(1, t.sky[1]);
    sg.fillStyle = sky;
    sg.fillRect(0, 0, w, h);
    if (t.night) this.drawMoon(sg, w);
    else if (!t.underwater) this.drawSun(sg, w);
    sg.drawImage(far.c, 0, 0, w, h);
    sg.drawImage(near.c, 0, 0, w, h);
    this.drawLight(sg, w, h);
    this.stat = stat.c;

    const r2 = new Rng(this.seed + 5);
    if (t.underwater) {
      for (let k = 0; k < 18; k++) this.bubbles.push({ x: r2.next() * w, y: r2.next() * h, r: 1.5 + r2.next() * 3, v: 10 + r2.next() * 20 });
      for (let k = 0; k < (this.has('fish') ? 4 : 0); k++) this.fish.push({ x: r2.next() * w, y: 50 + r2.next() * Math.max(40, ground - 120), v: (r2.next() < 0.5 ? -1 : 1) * (8 + r2.next() * 10), s: 6 + r2.next() * 5 });
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
      if (t.underwater) {
        // A sunken sailing ship resting on its side in the distance.
        const sx = w * rng.range(0.15, 0.85), sy = base - 4;
        g.fillStyle = shade(t.sky[1], 0.18);
        g.beginPath();
        g.moveTo(sx - 40, sy - 6);
        g.quadraticCurveTo(sx - 30, sy + 6, sx + 30, sy + 2);
        g.lineTo(sx + 42, sy - 14);
        g.quadraticCurveTo(sx, sy - 8, sx - 40, sy - 6);
        g.fill();
        g.fillRect(sx - 6, sy - 52, 2.5, 46);
        poly(g, [[sx - 4, sy - 50], [sx + 14, sy - 44], [sx - 4, sy - 30]], shade(t.sky[1], 0.3));
      }
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
    }
    g.globalAlpha = 1;
  }

  /**
   * The village square, lying flat: stones laid on the same isometric axes as the houses
   * (diamonds, not bricks), each one a shade apart and lit on its upper edges, in the
   * material of the place. Further back, a little haze, so the ground recedes.
   */
  private paving(g: CanvasRenderingContext2D, t: Theme, w: number, top: number, bottom: number) {
    const m = PAVING[this.theme];
    const rng = new Rng(this.seed * 53 + 7);
    g.save();
    g.beginPath();
    g.rect(0, top, w, bottom - top);
    g.clip();
    g.fillStyle = m.joint;
    g.fillRect(0, top, w, bottom - top);
    const hw = m.size, hh = hw * (SIN / COS);
    if (m.kind === 'sand') {
      g.fillStyle = m.stone;
      g.fillRect(0, top, w, bottom - top);
      // Ripples along one isometric axis, and a few pebbles and shells.
      g.strokeStyle = shade(m.stone, -0.07);
      g.lineWidth = 1;
      g.beginPath();
      for (let y = top - w * 0.6; y < bottom; y += 7) {
        g.moveTo(0, y);
        for (let x = 0; x <= w; x += 12) g.lineTo(x, y + x * (SIN / COS) + Math.sin(x * 0.15 + y) * 1.2);
      }
      g.stroke();
      for (let k = 0; k < 40; k++) {
        g.fillStyle = rng.next() < 0.7 ? shade(m.stone, -0.18) : '#F1D9C9';
        g.beginPath();
        g.ellipse(rng.next() * w, top + rng.next() * (bottom - top), 1.5 + rng.next() * 2, 1 + rng.next(), 0, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      for (let row = 0, y = top - hh; y < bottom + hh; row++, y += hh) {
        for (let x = (row % 2) * hw - hw; x < w + hw; x += hw * 2) {
          const k = m.inset;
          const base = m.alt && (Math.round(x / hw) + row) % 4 === 0 ? m.alt : m.stone;
          const col = shade(base, rng.range(-m.vary, m.vary * 0.6));
          poly(g, [[x, y - hh * k], [x + hw * k, y], [x, y + hh * k], [x - hw * k, y]], col);
          // Light on the two upper edges: the stone lies flat and catches the sun.
          g.strokeStyle = shade(col, 0.18);
          g.lineWidth = 0.8;
          g.beginPath();
          g.moveTo(x - hw * k, y);
          g.lineTo(x, y - hh * k);
          g.lineTo(x + hw * k, y);
          g.stroke();
          if (m.moss && rng.next() < 0.12) {
            g.fillStyle = m.moss;
            g.beginPath();
            g.ellipse(x + hw * 0.8, y + rng.range(-1, 1), 2.5, 1.2, 0, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
    }
    // Atmospheric depth: the far side of the square fades a little into the air.
    const haze = g.createLinearGradient(0, top, 0, top + 70);
    haze.addColorStop(0, `${t.sky[1]}66`);
    haze.addColorStop(1, `${t.sky[1]}00`);
    g.fillStyle = haze;
    g.fillRect(0, top, w, 70);
    g.restore();
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
    if (this.theme === 'garden' && this.has('ducks')) {
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

  private has(id: string): boolean {
    return this.restored.has(id);
  }

  /**
   * Draws a prop only if its village element is restored. Otherwise it is drawn into a
   * throwaway canvas, so the random layout of everything else stays exactly the same.
   */
  private gate(id: string, g: CanvasRenderingContext2D, draw: (g: CanvasRenderingContext2D) => void) {
    const ok = this.has(id);
    const prev = this.mute;
    this.mute = prev || !ok;
    if (!this.sinkCtx) {
      const c = document.createElement('canvas');
      c.width = c.height = 1;
      this.sinkCtx = c.getContext('2d')!;
    }
    draw(ok && !prev ? g : this.sinkCtx);
    this.mute = prev;
  }

  /**
   * Building lots: two rows of square footprints on the isometric grid, like a real
   * village block. Front-row houses touch corner to corner; the back row sits in the
   * notches between them, so the street reads as one continuous, coherent place.
   */
  private lots(P: Place): { back: Lot[]; front: Lot[] } {
    const dx = 2 * LOT * COS;
    const n = Math.ceil(P.w / dx) + 2;
    const x0 = P.rng.range(-dx / 2, 0);
    const back: Lot[] = [], front: Lot[] = [];
    for (let k = -1; k < n; k++) {
      back.push({ x: x0 + k * dx + LOT * COS, by: P.ground - LOT * SIN, k });
      front.push({ x: x0 + k * dx, by: P.ground, k });
    }
    return { back, front };
  }

  /** Sidewalk spots between the front-row houses (in front of each notch). */
  private notches(front: Lot[]): number[] {
    return front.map((l) => l.x + LOT * COS);
  }

  /**
   * The rhythm of the street, so it never reads as a row of identical houses: a lane or
   * two running back between the houses, one small square with its well, fountain or
   * tree, and one landmark rising above the roofs (a chapel, a bell tower, a dome).
   */
  private plan(P: Place, front: Lot[], rng: Rng): { lanes: Set<number>; square: number; landmark: number } {
    const ks = front.map((l) => l.k).filter((k) => k >= 1 && k < front.length - 3);
    const square = ks[Math.floor(ks.length * rng.range(0.3, 0.7))] ?? 2;
    const lanes = new Set<number>();
    for (const k of ks) if (Math.abs(k - square) > 2 && rng.next() < 0.14) lanes.add(k);
    // The landmark stands off-centre and away from the edges, clear of the level's title and buttons.
    const xOf = (k: number) => (front.find((l) => l.k === k)?.x ?? 0) + LOT * COS;
    const clear = (k: number) => {
      const u = xOf(k) / P.w;
      return (u > 0.12 && u < 0.32) || (u > 0.68 && u < 0.88);
    };
    const away = ks.filter((k) => Math.abs(k - square) > 2 && !lanes.has(k) && !lanes.has(k + 1) && clear(k));
    const landmark = away[Math.floor(away.length * rng.next())] ?? -99;
    return { lanes, square, landmark };
  }

  /** Back lots, front lots and the square, drawn in order; `house` builds an ordinary lot. */
  private street(P: Place, opts: {
    house: (l: Lot, front: boolean) => Built | null;
    landmark: (l: Lot) => void;
    square: (x: number, y: number) => void;
  }): { front: Lot[]; built: Built[]; plan: { lanes: Set<number>; square: number; landmark: number } } {
    const { back, front } = this.lots(P);
    const plan = this.plan(P, front, P.rng);
    for (const l of back) {
      if (plan.lanes.has(l.k)) continue;
      if (l.k === plan.landmark) opts.landmark({ ...l, cap: Math.max(40, l.by - 110) });
      else opts.house(l, false);
    }
    const built: Built[] = [];
    for (const l of front) {
      if (plan.lanes.has(l.k)) continue;
      if (l.k === plan.square) {
        opts.square(l.x, l.by - LOT * SIN);
        continue;
      }
      const b = opts.house(l, true);
      if (b) built.push(b);
    }
    return { front, built, plan };
  }

  private garden(g: CanvasRenderingContext2D, P: Place) {
    const { rng, ground, scale, w } = P;
    let gh = -1;
    const { front, built } = this.street(P, {
      house: (l, isFront) => {
        if (!isFront) return this.house(g, P, l.x, l.by, rng.range(42, 58) * scale);
        if (gh < 0 && l.k >= 2) {
          gh = l.k;
          this.gate('greenhouse', g, (gg) => this.greenhouse(gg, P, l.x, l.by));
          return null;
        }
        if (l.k % 3 === 1) {
          // A little garden lot: a round tree and a cypress.
          const r = rng.range(12, 15);
          this.gate('trees', g, (gg) => {
            this.tree(gg, P, l.x - 4, l.by - LOT * SIN - 2, r);
            this.cypress(gg, P, l.x + 9, l.by - 2, 30 * scale + 6);
          });
          return null;
        }
        return this.house(g, P, l.x, l.by, rng.range(28, 40) * scale);
      },
      landmark: (l) => this.chapel(g, P, l.x, l.by, Math.min(66 * scale + 10, (l.cap ?? 999) - 26)),
      square: (x, y) => this.well(g, P, x, y),
    });
    this.notches(front).forEach((x, k) => {
      if (k % 2 === 0) this.gate('flowers', g, (gg) => this.flowerBed(gg, P, x, ground + 12));
    });
    for (const hb of built) if (rng.next() < 0.5) this.gate('flowers', g, (gg) => pot(gg, hb.door[0] + 5, ground + 6, P.rng, P.t.greens));
    const fx = w * (rng.next() < 0.5 ? 0.38 : 0.62);
    this.gate('fountain', g, (gg) => this.fountain(gg, P, fx, ground + 14, 13));
    bench(g, fx + 30, ground + 17);
  }

  private harbour(g: CanvasRenderingContext2D, P: Place) {
    const { rng, ground, scale, w } = P;
    // Tall, narrow fishermen's houses; the lighthouse closes the quay at one end.
    let n = 0;
    const lhAt = rng.next() < 0.5 ? 2 : 11;
    const { front, built } = this.street(P, {
      house: (l, isFront) => {
        if (!isFront) return this.house(g, P, l.x, l.by, rng.range(48, 64) * scale);
        if (n++ === lhAt) {
          this.gate('lighthouse', g, (gg) => this.lighthouse(gg, P, l.x, l.by - 2, 86 * scale));
          return null;
        }
        return this.house(g, P, l.x, l.by, rng.range(34, 46) * scale);
      },
      // The harbour master's house: taller, a flat roof and a flag.
      landmark: (l) => {
        const b = this.house(g, P, l.x, l.by, Math.min(76 * scale + 8, (l.cap ?? 999) - 14), 'flat');
        flag(g, b.peak[0], b.peak[1] + 6, '#2F6F8F');
      },
      square: (x, y) => this.nets(g, x, y),
    });
    this.laundry(g, built, rng);
    this.notches(front).forEach((x, k) => {
      if (k % 3 === 1) {
        const third = rng.next() < 0.6;
        this.gate('crates', g, (gg) => {
          this.crate(gg, x - 6, ground + 12, 6, null);
          this.crate(gg, x + 6, ground + 13, 5, null);
          if (third) this.crate(gg, x - 2, ground + 6, 5, null);
          this.barrel(gg, x + 16, ground + 14, 4);
        });
      }
    });
    for (let x = 14; x < w; x += 46) cylinder(g, x, ground + 22, 2.4, 5, '#4E555C');
  }

  private market(g: CanvasRenderingContext2D, P: Place) {
    const { rng, ground, scale } = P;
    const { front, built } = this.street(P, {
      house: (l, isFront) => this.house(g, P, l.x, l.by, (isFront ? rng.range(34, 46) : rng.range(48, 62)) * scale),
      // The bell tower of the market square, once it is restored.
      landmark: (l) => {
        const h = Math.min(118 * scale + 10, l.cap ?? 999);
        if (this.has('belltower')) this.campanile(g, P, l.x, l.by, h);
        else this.house(g, P, l.x, l.by, 56 * scale);
      },
      square: (x, y) => this.fountain(g, P, x, y + 4, 11),
    });
    this.gate('garlands', g, () => this.stringLights(built.map((hb) => hb.peak), 3));
    this.laundry(g, built.filter((_, k) => k % 2 === 0), rng);
    const stripes: [string, string][] = [['#C4553F', '#FBF1E1'], ['#3E7C8C', '#FBF1E1'], ['#F2B23C', '#FBF1E1'], ['#6F8F4E', '#F6E7C9']];
    this.notches(front).forEach((x, k) => {
      if (k % 2 === 0) this.gate('stalls', g, (gg) => this.stall(gg, x - 8, ground + 14, 18, 9, stripes[(k / 2 + this.seed) % stripes.length]));
      else {
        const f1 = rng.pick(FRUIT), f2 = rng.pick(FRUIT);
        this.gate('fruit', g, (gg) => {
          this.crate(gg, x - 5, ground + 12, 5, f1);
          this.crate(gg, x + 6, ground + 13, 5, f2);
        });
      }
    });
    for (const hb of built) if (rng.next() < 0.35) this.gate('paint', g, (gg) => pot(gg, hb.door[0] + 5, ground + 6, P.rng, P.t.greens));
  }

  private village(g: CanvasRenderingContext2D, P: Place) {
    const { rng, ground, scale } = P;
    const { front, built } = this.street(P, {
      house: (l, isFront) => this.house(g, P, l.x, l.by, (isFront ? rng.range(32, 44) : rng.range(48, 64)) * scale),
      landmark: (l) => this.domeChurch(g, l.x, l.by, Math.min(58 * scale + 8, (l.cap ?? 999) - 30)),
      square: (x, y) => {
        this.gate('lamps', g, (gg) => this.lamp(gg, x, y + 4, 24));
        bench(g, x + 12, y + 6);
      },
    });
    this.gate('garlands', g, () => this.stringLights(built.map((hb) => hb.peak), 4));
    this.notches(front).forEach((x, k) => {
      if (k % 2 === 0) this.gate('lamps', g, (gg) => this.lamp(gg, x, ground + 16, 26));
      else if (k % 4 === 1) bench(g, x, ground + 15);
    });
  }

  private ruins(g: CanvasRenderingContext2D, P: Place) {
    const { rng, ground, scale } = P;
    const { front } = this.street(P, {
      house: (l, isFront) => {
        if (isFront && l.k % 2) {
          const h = rng.range(38, 62) * scale;
          this.gate('columns', g, (gg) => this.column(gg, P, l.x, l.by - LOT * SIN, h));
          return null;
        }
        this.ruinHouse(g, P, l.x, l.by, (isFront ? rng.range(26, 40) : rng.range(34, 52)) * scale);
        return null;
      },
      landmark: (l) => this.temple(g, P, l.x, l.by, Math.min(54 * scale + 10, (l.cap ?? 999) - 22)),
      square: (x, y) => this.statueHead(g, P, x, y),
    });
    // Coral, amphorae, swaying seaweed and fallen blocks along the drowned street.
    this.notches(front).forEach((x, k) => {
      if (k % 3 === 0) {
        const c = rng.pick(['#F09A86', '#F2C46B', '#E58FA0']);
        this.gate('coral', g, (gg) => this.coral(gg, x, ground + 14, c));
      } else if (k % 3 === 1) amphora(g, x, ground + 15, rng.range(-0.6, 0.6));
      else box(g, x, ground + 16, 6, 9, 4, shade(P.t.walls[0], -0.1));
      for (let j = 0; j < 2; j++) {
        const wd = { x: x + rng.range(-12, 12), y: ground + 12 + rng.range(-3, 6), h: rng.range(14, 28), c: rng.pick(P.t.greens) };
        if (this.has('seaweed')) this.weeds.push(wd);
      }
    });
  }

  /** The sunken temple: steps, a colonnade (standing once restored), a pediment. */
  private temple(g: CanvasRenderingContext2D, P: Place, x: number, by: number, h: number) {
    const stone = '#93CBBC';
    box(g, x, by + 2, LOT + 3, LOT + 3, 3, shade(stone, -0.12));
    box(g, x, by - 1, LOT + 1, LOT + 1, 3, shade(stone, -0.05));
    const base = box(g, x, by - 4, LOT, LOT, 0.1, stone);
    const L = onLeft(base), R = onRight(base);
    // The cella behind the columns.
    box(g, x, by - 4 - LOT * SIN * 0.5, LOT * 0.6, LOT * 0.6, h * 0.9, shade(stone, -0.18), false);
    const standing = this.has('columns');
    for (const f of [L, R])
      for (const u of [0.15, 0.5, 0.85]) {
        const q = f(u, 0);
        if (standing) cylinder(g, q[0], q[1], 2.6, h, stone);
        else {
          cylinder(g, q[0], q[1], 2.6, h * (0.25 + ((u * 7) % 1) * 0.3), stone);
        }
      }
    if (!standing) return;
    // Entablature and pediment.
    const top = box(g, x, by - 4 - h, LOT, LOT, 4, shade(stone, 0.06));
    this.roof(g, P, top, shade(stone, -0.05), LOT * 0.45, stone, 'gable');
  }

  /** A great stone head lying on the sand, half swallowed by it. */
  private statueHead(g: CanvasRenderingContext2D, P: Place, x: number, y: number) {
    const stone = '#A9D3C6';
    g.fillStyle = 'rgba(0,30,40,0.18)';
    g.beginPath();
    g.ellipse(x + 2, y + 6, 15, 4, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = stone;
    g.beginPath();
    g.ellipse(x, y, 13, 9, -0.25, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = shade(stone, -0.18);
    g.beginPath();
    g.ellipse(x + 4, y + 2, 9, 6, -0.25, 0, Math.PI);
    g.fill();
    // Brow, closed eye, nose and lips in profile.
    g.strokeStyle = shade(stone, -0.35);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x - 6, y - 3);
    g.quadraticCurveTo(x - 2, y - 5, x + 2, y - 3);
    g.moveTo(x - 5, y - 1);
    g.quadraticCurveTo(x - 2, y, x + 1, y - 1);
    g.moveTo(x + 4, y - 2);
    g.lineTo(x + 8, y + 1);
    g.lineTo(x + 5, y + 2);
    g.moveTo(x + 4, y + 4);
    g.lineTo(x + 7, y + 4.5);
    g.stroke();
    if (this.has('seaweed')) for (let k = 0; k < 2; k++) this.weeds.push({ x: x - 9 + k * 15, y: y + 4, h: 14 + k * 6, c: P.t.greens[k % P.t.greens.length] });
    amphora(g, x + 18, y + 6, 1.2);
  }

  /** The garden's chapel: whitewashed, a rose window, an arched door and a bell in its gable. */
  private chapel(g: CanvasRenderingContext2D, P: Place, x: number, by: number, h: number) {
    const wall = this.has('paint') ? '#F6EFE2' : '#DCD6CC';
    const p = box(g, x, by, LOT, LOT, h, wall, false);
    const L = onLeft(p), R = onRight(p);
    arch(g, L, 0.38, 0.62, 0, 0.3, '#7A5A48');
    const c = L(0.5, 0.62);
    g.fillStyle = '#5F8FB0';
    g.beginPath();
    g.ellipse(c[0], c[1], 3.4, 4.2, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#F6EFE2';
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(c[0] - 3.4, c[1]);
    g.lineTo(c[0] + 3.4, c[1]);
    g.moveTo(c[0], c[1] - 4.2);
    g.lineTo(c[0], c[1] + 4.2);
    g.stroke();
    for (const u of [0.3, 0.7]) arch(g, R, u - 0.08, u + 0.08, 0.45, 0.72, 'rgba(40,50,60,0.5)');
    const peak = this.roof(g, P, p, '#C8664E', LOT * 0.8, wall, 'gable');
    // The bell cote standing on the gable.
    const bx = peak[0], bb = peak[1] + 2;
    poly(g, [[bx - 4, bb], [bx + 4, bb], [bx + 4, bb - 10], [bx, bb - 14], [bx - 4, bb - 10]], wall);
    arch(g, (u, v) => [bx - 2.4 + u * 4.8, bb - 2 - v * 6], 0, 1, 0, 1, '#4A3E36');
    g.fillStyle = '#E0A332';
    g.beginPath();
    g.arc(bx, bb - 5, 1.6, 0, Math.PI * 2);
    g.fill();
  }

  /** The market's bell tower: brick, a clock, open arches for the bells, a pyramid roof. */
  private campanile(g: CanvasRenderingContext2D, P: Place, x: number, by: number, h: number) {
    const s = LOT * 0.78;
    const brick = '#E3A57E';
    const p = box(g, x, by, s, s, h, brick, false);
    const L = onLeft(p), R = onRight(p);
    // Brick courses and a stone band under the belfry.
    g.strokeStyle = 'rgba(120,60,40,0.18)';
    g.lineWidth = 0.6;
    g.beginPath();
    for (let v = 0.06; v < 0.78; v += 0.06)
      for (const f of [L, R]) {
        const a = f(0, v), b = f(1, v);
        g.moveTo(a[0], a[1]);
        g.lineTo(b[0], b[1]);
      }
    g.stroke();
    quadOn(g, L, 0, 1, 0.78, 0.81, '#F2DCC0');
    quadOn(g, R, 0, 1, 0.78, 0.81, shade('#F2DCC0', -0.2));
    for (const f of [L, R]) arch(g, f, 0.25, 0.75, 0.83, 0.95, 'rgba(50,30,25,0.75)');
    const c = L(0.5, 0.62);
    g.fillStyle = '#FBF4E8';
    g.beginPath();
    g.ellipse(c[0], c[1], 3.6, 4, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#3A2E2A';
    g.lineWidth = 0.7;
    g.beginPath();
    g.moveTo(c[0], c[1]);
    g.lineTo(c[0], c[1] - 2.6);
    g.moveTo(c[0], c[1]);
    g.lineTo(c[0] + 1.8, c[1] + 0.8);
    g.stroke();
    this.roof(g, P, p, '#C4553F', s * 1.3, brick, 'hip');
  }

  /** The night village's church: a block crowned by a drum and a dome with a lantern. */
  private domeChurch(g: CanvasRenderingContext2D, x: number, by: number, h: number) {
    const wall = '#8A7CAB';
    const p = box(g, x, by, LOT, LOT, h, wall, false);
    const L = onLeft(p), R = onRight(p);
    const lit = this.has('lights');
    for (const u of [0.3, 0.7]) arch(g, L, u - 0.1, u + 0.1, 0.35, 0.7, lit ? GLOW : '#2B2747');
    arch(g, R, 0.4, 0.6, 0.35, 0.7, lit ? shade(GLOW, -0.1) : '#2B2747');
    if (lit && !this.mute) this.lit.push(L(0.3, 0.35)[0], L(0.7, 0.35)[0]);
    poly(g, [p.Lt, p.Ft, p.Rt, p.Bt], shade(wall, 0.15));
    const c: Pt = [(p.Lt[0] + p.Rt[0]) / 2, (p.Lt[1] + p.Rt[1]) / 2];
    cylinder(g, c[0], c[1] + 3, 9, 8, shade(wall, 0.05));
    const top = c[1] - 5;
    const grad = g.createLinearGradient(c[0] - 9, 0, c[0] + 9, 0);
    grad.addColorStop(0, '#6F6AA8');
    grad.addColorStop(1, '#3B3468');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(c[0], top, 9, 10, 0, Math.PI, 0);
    g.fill();
    g.fillStyle = lit ? GLOW : '#8A7CAB';
    g.fillRect(c[0] - 1.5, top - 14, 3, 4);
    g.fillStyle = '#3B3468';
    g.fillRect(c[0] - 0.5, top - 18, 1, 4);
  }

  /** A stone well with a little tiled roof, on the garden's square. */
  private well(g: CanvasRenderingContext2D, P: Place, x: number, y: number) {
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.beginPath();
    g.ellipse(x + 2, y + 3, 11, 4, 0, 0, Math.PI * 2);
    g.fill();
    cylinder(g, x, y + 2, 7, 6, '#CFC3AE');
    g.fillStyle = P.t.water[1];
    g.beginPath();
    g.ellipse(x, y - 4, 5, 2, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#7A5E48';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(x - 6, y - 4);
    g.lineTo(x - 6, y - 16);
    g.moveTo(x + 6, y - 4);
    g.lineTo(x + 6, y - 16);
    g.stroke();
    poly(g, [[x - 9, y - 15], [x, y - 22], [x + 9, y - 15], [x, y - 13]], '#C8664E');
    g.fillStyle = '#8C6E58';
    g.fillRect(x - 0.5, y - 14, 1, 7);
  }

  /** Fishing nets drying on their poles, on the harbour's little square. */
  private nets(g: CanvasRenderingContext2D, x: number, y: number) {
    g.strokeStyle = '#7A5E48';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(x - 9, y + 4);
    g.lineTo(x - 9, y - 14);
    g.moveTo(x + 9, y);
    g.lineTo(x + 9, y - 18);
    g.stroke();
    g.fillStyle = 'rgba(70,110,120,0.35)';
    poly(g, [[x - 9, y - 13], [x + 9, y - 17], [x + 8, y - 4], [x - 8, y + 1]], 'rgba(70,110,120,0.3)');
    g.strokeStyle = 'rgba(50,80,90,0.5)';
    g.lineWidth = 0.5;
    g.beginPath();
    for (let k = 1; k < 5; k++) {
      g.moveTo(x - 9 + k * 3.6, y - 13 - k * 0.8);
      g.lineTo(x - 8 + k * 3.2, y + 1 - k);
      g.moveTo(x - 9, y - 13 + k * 3);
      g.lineTo(x + 9, y - 17 + k * 3);
    }
    g.stroke();
    // A float or two and a coil of rope at the foot.
    g.fillStyle = '#E07A5F';
    g.beginPath();
    g.arc(x - 3, y - 9, 1.4, 0, Math.PI * 2);
    g.arc(x + 4, y - 11, 1.4, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#B9935F';
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(x + 2, y + 5, 4, 1.6, 0, 0, Math.PI * 2);
    g.stroke();
  }

  /** Washing hung between neighbouring houses: the most Mediterranean of details. */
  private laundry(g: CanvasRenderingContext2D, houses: Built[], rng: Rng) {
    const cloth = ['#FBF6EE', '#E07A5F', '#78B4DC', '#F2C46B', '#E9A6B8', '#8FB98B'];
    for (let k = 0; k + 1 < houses.length; k++) {
      const a = houses[k], b = houses[k + 1];
      if (rng.next() < 0.45 || Math.abs(a.p.R[0] - b.p.L[0]) > 1) continue;
      const pa = onRight(a.p)(0.5, 0.62), pb = onLeft(b.p)(0.5, 0.62);
      const mid: Pt = [(pa[0] + pb[0]) / 2, Math.max(pa[1], pb[1]) + 5];
      g.strokeStyle = 'rgba(70,60,55,0.6)';
      g.lineWidth = 0.7;
      g.beginPath();
      g.moveTo(pa[0], pa[1]);
      g.quadraticCurveTo(mid[0], mid[1], pb[0], pb[1]);
      g.stroke();
      for (let j = 1; j < 4; j++) {
        const u = j / 4;
        const x = (1 - u) * (1 - u) * pa[0] + 2 * u * (1 - u) * mid[0] + u * u * pb[0];
        const y = (1 - u) * (1 - u) * pa[1] + 2 * u * (1 - u) * mid[1] + u * u * pb[1];
        g.fillStyle = rng.pick(cloth);
        g.fillRect(x - 2, y, 4, 4 + rng.range(0, 3));
      }
    }
  }

  // ---------------------------------------------------------------- props

  /** A house with a gabled tile roof, shuttered windows and a door, on a square lot. */
  private house(g: CanvasRenderingContext2D, P: Place, x: number, by: number, h: number, style?: RoofStyle): Built {
    const { rng, t } = P;
    const l = LOT, r = LOT;
    const roll = rng.next();
    const weights = ROOFS[this.theme];
    let acc = 0;
    const roofStyle = style ?? (Object.keys(weights) as RoofStyle[]).find((k) => (acc += weights[k]!) >= roll) ?? 'gable';
    // Until the village is repainted, the walls and shutters stay faded.
    const faded = !t.night && !t.underwater && !this.has('paint');
    const wall = faded ? mix(rng.pick(t.walls), '#D6D0C6', 0.6) : rng.pick(t.walls);
    const shutter = faded ? mix(rng.pick(t.shutters), '#A9A49C', 0.6) : rng.pick(t.shutters);
    const lights = this.has('lights');
    // Cast shadow on the paving, falling forward and to the left (the sun is high behind, on the right).
    const sx = -h * 0.22, sy = h * 0.18;
    poly(g, [[x - l * COS, by - l * SIN], [x, by], [x + sx, by + sy], [x - l * COS + sx, by - l * SIN + sy]], t.night ? 'rgba(10,8,30,0.2)' : 'rgba(60,40,20,0.12)');
    const p = box(g, x, by, l, r, h, wall, false);
    // Contact shading where the walls meet the ground.
    const ao = (f: Face) => {
      const a = f(0, 0), b = f(1, 0), c = f(1, 0.16), d = f(0, 0.16);
      const grad = g.createLinearGradient(0, a[1], 0, d[1]);
      grad.addColorStop(0, 'rgba(30,20,10,0.16)');
      grad.addColorStop(1, 'rgba(30,20,10,0)');
      poly(g, [a, b, c, d], grad);
    };
    ao(onLeft(p));
    ao(onRight(p));
    const L = onLeft(p), R = onRight(p);
    const floors = Math.max(1, Math.round(h / 22));
    const dark = t.night ? '#2B2747' : 'rgba(45,55,66,0.62)';
    for (let f = 0; f < floors; f++) {
      const v0 = (f + 0.3) / floors, v1 = v0 + 0.42 / floors;
      const us = f === 0 ? [0.25] : [0.5];
      const arcade = f === 0 && this.theme === 'market' && floors > 1;
      if (arcade) {
        // Market houses open onto the square through arches.
        for (const u of [0.25, 0.75]) arch(g, L, u - 0.17, u + 0.17, 0, 0.75 / floors, 'rgba(50,35,30,0.55)');
        continue;
      }
      for (const u of us) {
        const lit = t.night && rng.next() < 0.6 && lights;
        quadOn(g, L, u - 0.07, u + 0.07, v0, v1, lit ? GLOW : dark);
        if (lit && !this.mute) this.lit.push(L(u, v0)[0]);
        if (!t.night) {
          quadOn(g, L, u - 0.13, u - 0.07, v0, v1, shutter);
          quadOn(g, L, u + 0.07, u + 0.13, v0, v1, shutter);
        }
        if (f >= 1 && rng.next() < 0.22) {
          // A little balcony: a stone ledge and an iron railing.
          quadOn(g, L, u - 0.2, u + 0.2, v0 - 0.03 / floors, v0 + 0.01 / floors, shade(wall, -0.25));
          g.strokeStyle = t.night ? 'rgba(20,18,40,0.8)' : 'rgba(50,45,50,0.75)';
          g.lineWidth = 0.7;
          g.beginPath();
          for (let k = 0; k <= 4; k++) {
            const a = L(u - 0.2 + k * 0.1, v0), b = L(u - 0.2 + k * 0.1, v0 + 0.16 / floors);
            g.moveTo(a[0], a[1]);
            g.lineTo(b[0], b[1]);
          }
          const c0 = L(u - 0.2, v0 + 0.16 / floors), c1 = L(u + 0.2, v0 + 0.16 / floors);
          g.moveTo(c0[0], c0[1]);
          g.lineTo(c1[0], c1[1]);
          g.stroke();
        }
        if (f === 1 && !t.night && rng.next() < 0.45) {
          // Flower box under the window (in the garden, once the flowers are back).
          this.gate(this.theme === 'garden' ? 'flowers' : 'paint', g, (gg) => {
            quadOn(gg, L, u - 0.12, u + 0.12, v0 - 0.06 / floors, v0, t.greens[0]);
            const c = L(u, v0);
            gg.fillStyle = rng.pick(FLOWERS);
            gg.fillRect(c[0] - 2, c[1] - 2, 2, 2);
            gg.fillRect(c[0] + 2, c[1] - 1, 2, 2);
          });
        }
      }
      if (r > 12) {
        const lit = t.night && rng.next() < 0.5 && lights;
        quadOn(g, R, 0.42, 0.58, v0, v1, lit ? shade(GLOW, -0.08) : 'rgba(30,36,48,0.4)');
        if (lit && !this.mute) this.lit.push(R(0.5, v0)[0]);
      }
    }
    // Door, with a little stone step, and a striped awning over it in the market and the harbour.
    if (this.theme !== 'market' || floors < 2) {
      arch(g, L, 0.55, 0.75, 0, 0.62 / floors, shade(shutter, -0.15));
      quadOn(g, L, 0.52, 0.78, 0, 0.05 / floors, shade(t.ground, -0.1));
    }
    if ((this.theme === 'market' || this.theme === 'harbour') && rng.next() < 0.5) {
      const c = rng.pick(['#C4553F', '#3E7C8C', '#F2B23C', '#6F8F4E']);
      const v = 0.7 / floors;
      for (let k = 0; k < 4; k++) quadOn(g, L, 0.5 + k * 0.08, 0.58 + k * 0.08, v, v + 0.08 / floors, k % 2 ? '#FBF1E1' : faded ? mix(c, '#D6D0C6', 0.6) : c);
    }
    // Bougainvillea climbing the front corner of some houses.
    if (!t.night && !t.underwater) {
      const climb = rng.next() < 0.3;
      const pick = [rng.next(), rng.next(), rng.next()];
      if (climb)
        this.gate(this.theme === 'garden' ? 'flowers' : 'paint', g, (gg) => {
          for (let k = 0; k < 14; k++) {
            const v = (k / 14) * 0.75 * (0.6 + pick[k % 3] * 0.4);
            const c = lerp(p.F, p.Ft, v);
            const dx = Math.sin(k * 2.3) * 3;
            gg.fillStyle = k % 3 === 0 ? '#5E9466' : k % 2 ? '#D94F8C' : '#EC7FB0';
            gg.beginPath();
            gg.arc(c[0] + dx, c[1], 1.6 + (k % 2) * 0.6, 0, Math.PI * 2);
            gg.fill();
          }
        });
    }
    if (t.night && lights) {
      const d = L(0.65, 0.3 / floors);
      const glow = g.createRadialGradient(d[0], d[1], 1, d[0], d[1], 14);
      glow.addColorStop(0, 'rgba(255,217,138,0.35)');
      glow.addColorStop(1, 'rgba(255,217,138,0)');
      g.fillStyle = glow;
      g.fillRect(d[0] - 14, d[1] - 14, 28, 28);
    }
    const peak = this.roof(g, P, p, rng.pick(t.roofs), Math.min(l, r) * 0.75, wall, roofStyle);
    return { p, peak, door: L(0.65, 0) };
  }

  /**
   * A roof, in one of the shapes that make a Mediterranean skyline: a gable either way, a
   * hipped roof, or a flat roof terrace with its parapet, plants or pergola. Returns its
   * highest point (for garlands).
   */
  private roof(g: CanvasRenderingContext2D, P: Place, p: Box, col: string, rh: number, wall: string, style: RoofStyle = 'gable'): Pt {
    const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const up = (a: Pt, d: number): Pt => [a[0], a[1] - d];
    const tiles = (a0: Pt, a1: Pt, b0: Pt, b1: Pt, c: string) => {
      g.strokeStyle = c;
      g.lineWidth = 1;
      g.beginPath();
      for (let k = 1; k < 4; k++) {
        const a = lerp(a0, a1, k / 4), b = lerp(b0, b1, k / 4);
        g.moveTo(a[0], a[1]);
        g.lineTo(b[0], b[1]);
      }
      g.stroke();
    };
    const ridge = (a: Pt, b: Pt) => {
      g.strokeStyle = shade(col, 0.25);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
      g.stroke();
    };
    let peak: Pt;
    let chimneyAt: Pt;
    switch (style) {
      case 'flat': {
        // A roof terrace: tiled floor, a parapet, and something growing or drying on it.
        poly(g, [p.Lt, p.Ft, p.Rt, p.Bt], shade('#D9A884', P.t.night ? -0.45 : 0));
        const inset = (q: Pt, k: number): Pt => lerp(q, mid(p.Lt, p.Rt), k);
        poly(g, [inset(p.Lt, 0.12), inset(p.Ft, 0.12), inset(p.Rt, 0.12), inset(p.Bt, 0.12)], shade('#C98F6B', P.t.night ? -0.45 : 0));
        for (const [a, b] of [[p.Lt, p.Ft], [p.Ft, p.Rt]] as [Pt, Pt][]) poly(g, [a, b, up(b, 2.5), up(a, 2.5)], shade(wall, 0.12));
        const c = mid(p.Lt, p.Rt);
        const deco = P.rng.next();
        if (deco < 0.4) {
          // A pergola with a vine.
          g.strokeStyle = '#8C6E58';
          g.lineWidth = 1;
          g.beginPath();
          for (const q of [p.Lt, p.Ft, p.Rt]) {
            const r = inset(q, 0.3);
            g.moveTo(r[0], r[1]);
            g.lineTo(r[0], r[1] - 9);
          }
          g.stroke();
          poly(g, [up(inset(p.Lt, 0.3), 9), up(inset(p.Ft, 0.3), 9), up(inset(p.Rt, 0.3), 9), up(inset(p.Bt, 0.3), 9)], P.t.night ? 'rgba(60,90,80,0.8)' : 'rgba(110,160,100,0.85)');
        } else if (deco < 0.75) {
          pot(g, c[0] - 4, c[1] + 2, P.rng, P.t.greens);
          pot(g, c[0] + 5, c[1] + 1, P.rng, P.t.greens);
        } else cylinder(g, c[0] + 2, c[1] + 1, 3.5, 6, '#D7D2CA');
        peak = up(c, 10);
        chimneyAt = c;
        break;
      }
      case 'hip': {
        const apex = up(mid(p.Lt, p.Rt), rh * 0.9);
        poly(g, [p.Lt, p.Bt, apex], shade(col, -0.3));
        poly(g, [p.Bt, p.Rt, apex], shade(col, -0.35));
        poly(g, [p.Lt, p.Ft, apex], col);
        poly(g, [p.Ft, p.Rt, apex], shade(col, -0.15));
        tiles(p.Lt, apex, p.Ft, apex, shade(col, -0.16));
        ridge(p.Ft, apex);
        peak = apex;
        chimneyAt = lerp(apex, p.Rt, 0.4);
        break;
      }
      case 'gableX': {
        // Ridge along the right face: the gable end looks left.
        const eave = 2;
        const Ft: Pt = [p.Ft[0], p.Ft[1] + eave], Rt: Pt = [p.Rt[0] + eave, p.Rt[1] + 1];
        const rL = up(mid(p.Lt, p.Ft), rh), rR = up(mid(p.Bt, p.Rt), rh);
        poly(g, [p.Lt, p.Bt, rR, rL], shade(col, -0.3));
        poly(g, [p.Lt, p.Ft, rL], wall);
        poly(g, [Ft, Rt, rR, rL], shade(col, -0.1));
        tiles(Ft, rL, Rt, rR, shade(col, -0.26));
        ridge(rL, rR);
        peak = rL;
        chimneyAt = lerp(rL, rR, 0.4);
        break;
      }
      default: {
        // Ridge along the left face: the gable end looks right.
        const eave = 2;
        const Lt: Pt = [p.Lt[0] - eave, p.Lt[1] + 1], Ft: Pt = [p.Ft[0], p.Ft[1] + eave];
        const rF = up(mid(p.Ft, p.Rt), rh), rB = up(mid(p.Lt, p.Bt), rh);
        poly(g, [rB, rF, p.Rt, p.Bt], shade(col, -0.3));
        poly(g, [p.Ft, p.Rt, rF], shade(wall, -0.2));
        poly(g, [Lt, Ft, rF, rB], col);
        tiles(Lt, rB, Ft, rF, shade(col, -0.18));
        ridge(rB, rF);
        peak = rF;
        chimneyAt = lerp(rB, rF, 0.3);
      }
    }
    if (style !== 'flat' && P.rng.next() < 0.45) {
      const c = chimneyAt;
      box(g, c[0], c[1] + 6, 3, 3, 9, shade(P.t.walls[1 % P.t.walls.length], -0.1));
      if (!this.mute && !P.t.underwater) this.smokes.push([c[0], c[1] - 4]);
    }
    return peak;
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
    const p = box(g, x, by, LOT, LOT, h, '#D3ECE6', false);
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
    if (!this.mute) this.fountains.push([x, by - 15]);
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
    if (!this.mute) this.lamps.push([x, by - h - 3]);
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
    if (!this.mute) this.beacon = [x, top - 6];
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
    for (let k = 0; k < 2; k++) {
      const wd = { x: x + P.rng.range(-10, 10), y: by + 2, h: P.rng.range(12, 22), c: P.rng.pick(P.t.greens) };
      if (!this.mute && this.has('seaweed')) this.weeds.push(wd);
    }
  }

  /** A drowned house: no roof, a jagged broken top, dark empty windows. */
  private ruinHouse(g: CanvasRenderingContext2D, P: Place, x: number, by: number, h: number) {
    const col = P.rng.pick(P.t.walls);
    const p = box(g, x, by, LOT, LOT, h, col, false);
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
    if (this.mute) return;
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
    // Wisps of smoke drifting from the chimneys.
    for (let k = 0; k < this.smokes.length; k++) {
      const [x, y] = this.smokes[k];
      for (let j = 0; j < 3; j++) {
        const u = (time * 0.22 + j / 3 + k * 0.37) % 1;
        g.fillStyle = t.night ? `rgba(190,190,220,${(1 - u) * 0.22})` : `rgba(255,255,255,${(1 - u) * 0.5})`;
        g.beginPath();
        g.arc(x + u * 7 + Math.sin(time + j + k) * 1.5, y - u * 16, 1.4 + u * 3.2, 0, Math.PI * 2);
        g.fill();
      }
    }
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
    if (t.night && this.has('fireflies')) {
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
    else if (!t.night && (this.theme !== 'harbour' || this.has('gulls'))) this.drawBirds(g, w, time);
  }

  private drawWater(g: CanvasRenderingContext2D, t: Theme, w: number, h: number, time: number) {
    const wy = this.waterY;
    if (wy >= h - 4) return;
    if (!t.underwater) this.drawReflection(g, t, w, h, wy, time);
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
        for (let k = 0; k < 2 && this.has('boats'); k++) {
          const x = ((time * (8 + k * 5) + k * w * 0.55) % (w + 80)) - 40;
          const y = wy + 26 + k * 30 + bob(k);
          if (y < h - 6) sailboat(g, x, y, 24 + k * 4, t.boat, k ? '#E07A5F' : '#2F6F8F', Math.sin(time * 1.6 + k) * 0.05);
        }
        break;
      case 'garden':
        for (let k = 0; k < 3 && this.has('ducks'); k++) {
          const x = ((time * 5 + k * 26 + 40) % (w + 60)) - 30;
          duck(g, x, wy + 30 + (k % 2) * 5 + bob(k) * 0.5, k === 0 ? 1.15 : 0.8);
        }
        break;
      case 'market':
        if (this.has('gondola')) gondola(g, ((time * 9) % (w + 120)) - 60, wy + 28 + bob(0), t.boat, true, false);
        break;
      case 'night':
        if (this.has('gondola')) gondola(g, w - (((time * 7) % (w + 120)) - 60), wy + 30 + bob(0), t.boat, false, true);
        break;
    }
  }

  /**
   * The village mirrored in the water, squashed and trembling in thin strips, fading with
   * depth and tinted by the water: the signature look of a canal town.
   */
  private drawReflection(g: CanvasRenderingContext2D, t: Theme, w: number, h: number, wy: number, time: number) {
    const src = this.bld;
    if (!src) return;
    const dpr = src.width / w;
    const k = 0.55;
    const depth = Math.min(h - wy - 2, 90 * this.scale * k + 10);
    const sh = 2;
    g.save();
    for (let d = 0; d < depth; d += sh) {
      const fade = 1 - d / depth;
      const sy = this.groundY - (d + sh) / k;
      const off = Math.sin(time * 1.6 + d * 0.35) * (0.6 + (d / depth) * 2.2);
      g.globalAlpha = (t.night ? 0.45 : 0.3) * fade;
      g.drawImage(src, 0, sy * dpr, src.width, (sh / k) * dpr, off, wy + 3 + d, w, sh);
    }
    g.restore();
    // Tint the reflection with the water so it sits below the surface.
    const tint = g.createLinearGradient(0, wy, 0, wy + depth);
    tint.addColorStop(0, `${t.water[0]}55`);
    tint.addColorStop(1, `${t.water[0]}00`);
    g.fillStyle = tint;
    g.fillRect(0, wy, w, depth);
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

  private drawSun(g: CanvasRenderingContext2D, w: number) {
    const sx = w * 0.78, sy = Math.min(70, this.skyY * 0.3);
    const sun = g.createRadialGradient(sx, sy, 4, sx, sy, 90);
    sun.addColorStop(0, 'rgba(255,248,225,0.9)');
    sun.addColorStop(0.2, 'rgba(255,240,210,0.5)');
    sun.addColorStop(1, 'rgba(255,240,210,0)');
    g.fillStyle = sun;
    g.fillRect(sx - 90, sy - 90, 180, 180);
  }

  /** A few puffy clouds drifting, high enough to pass above the roofs. */
  private drawClouds(g: CanvasRenderingContext2D, w: number, time: number) {
    for (let k = 0; k < 3; k++) {
      const x = ((time * (3 + k) + k * 170) % (w + 160)) - 80;
      const y = this.skyY * (0.16 + k * 0.1);
      // A soft shaded underside, then the sunlit puff.
      for (const [dy, col] of [[2.5, 'rgba(200,190,200,0.35)'], [0, 'rgba(255,255,255,0.85)']] as [number, string][]) {
        g.fillStyle = col;
        g.beginPath();
        g.ellipse(x, y + dy, 28, 7, 0, 0, Math.PI * 2);
        g.arc(x - 9, y - 4 + dy, 9, 0, Math.PI * 2);
        g.arc(x + 6, y - 6 + dy, 11, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  /** Stars twinkling in the upper sky. */
  private drawStars(g: CanvasRenderingContext2D, w: number, time: number) {
    const rng = new Rng(this.seed * 7 + 3);
    for (let k = 0; k < 40; k++) {
      const x = rng.next() * w, y = rng.next() * this.skyY * 0.5;
      g.fillStyle = `rgba(255,250,240,${0.35 + 0.35 * Math.sin(time * (0.7 + rng.next()) + k)})`;
      g.fillRect(x, y, 1.5, 1.5);
    }
  }

  /** A small crescent moon with its halo. */
  private drawMoon(g: CanvasRenderingContext2D, w: number) {
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
      // Never across the title: they fade out as they fly behind the centre of the top bar.
      const centre = Math.abs(x - w / 2) / (w * 0.32);
      if (y < 180 && centre < 1) {
        if (centre < 0.55) continue;
        g.globalAlpha = (centre - 0.55) / 0.45;
      } else g.globalAlpha = 1;
      g.beginPath();
      g.moveTo(x - 5, y - flap);
      g.lineTo(x, y);
      g.lineTo(x + 5, y - flap);
      g.stroke();
    }
    g.globalAlpha = 1;
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
