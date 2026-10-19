import { MATERIALS, type Glyph, type Palette } from './content';
import { DX, DY, type Dir, type Item, opposite, type Sim, type SimEvent, TUNING } from './sim';
import { T } from './terrain';

interface Fx {
  kind: 'puff' | 'text' | 'ring' | 'spark';
  x: number;
  y: number;
  t: number;
  life: number;
  color: string;
  text?: string;
  vx?: number;
  vy?: number;
}

export interface Insets {
  top: number;
  bottom: number;
}

const DANGER = '#D2463A';

function easeOutBack(t: number): number {
  const c = 1.7;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

export function drawGlyph(g: CanvasRenderingContext2D, glyph: Glyph, x: number, y: number, r: number) {
  g.beginPath();
  switch (glyph) {
    case 'circle':
      g.arc(x, y, r * 0.8, 0, Math.PI * 2);
      break;
    case 'square':
      g.rect(x - r * 0.7, y - r * 0.7, r * 1.4, r * 1.4);
      break;
    case 'triangle':
      g.moveTo(x, y - r * 0.9);
      g.lineTo(x + r * 0.85, y + r * 0.65);
      g.lineTo(x - r * 0.85, y + r * 0.65);
      g.closePath();
      break;
    case 'diamond':
      g.moveTo(x, y - r);
      g.lineTo(x + r * 0.8, y);
      g.lineTo(x, y + r);
      g.lineTo(x - r * 0.8, y);
      g.closePath();
      break;
    case 'plus': {
      const a = r * 0.32;
      g.rect(x - a, y - r * 0.9, a * 2, r * 1.8);
      g.rect(x - r * 0.9, y - a, r * 1.8, a * 2);
      break;
    }
  }
  g.fill();
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private dpr = 1;
  private cw = 0;
  private ch = 0;
  pal: Palette;
  insets: Insets = { top: 90, bottom: 110 };
  colorblind = false;
  /** Camera: cell size in CSS px and origin of cell (0,0). */
  cell = 40;
  ox = 0;
  oy = 0;
  private camInit = false;
  private fx: Fx[] = [];
  private time = 0;
  shake = 0;
  hint: { from: { x: number; y: number }; to: { x: number; y: number } } | null = null;
  focusSite = -1;

  constructor(canvas: HTMLCanvasElement, pal: Palette) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d', { alpha: false })!;
    this.pal = pal;
    this.resize();
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.cw = this.canvas.clientWidth;
    this.ch = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.cw * this.dpr);
    this.canvas.height = Math.round(this.ch * this.dpr);
    this.camInit = false;
  }

  resetCamera() {
    this.camInit = false;
    this.fx = [];
    this.focusSite = -1;
  }

  screenToCell(px: number, py: number): { x: number; y: number; fx: number; fy: number } {
    const fx = (px - this.ox) / this.cell;
    const fy = (py - this.oy) / this.cell;
    return { x: Math.floor(fx), y: Math.floor(fy), fx, fy };
  }

  private updateCamera(sim: Sim, dt: number) {
    const b = sim.bounds;
    const bw = b.x1 - b.x0 + 1 + 0.5;
    const bh = b.y1 - b.y0 + 1 + 0.5;
    const availW = this.cw - 24;
    const availH = this.ch - this.insets.top - this.insets.bottom;
    const cell = Math.min(availW / bw, availH / bh, 84);
    const cx = (b.x0 + b.x1 + 1) / 2;
    const cy = (b.y0 + b.y1 + 1) / 2;
    const ox = this.cw / 2 - cx * cell;
    const oy = this.insets.top + availH / 2 - cy * cell;
    if (!this.camInit) {
      this.cell = cell;
      this.ox = ox;
      this.oy = oy;
      this.camInit = true;
      return;
    }
    const k = 1 - Math.exp(-dt * 2.2);
    this.cell += (cell - this.cell) * k;
    this.ox += (ox - this.ox) * k;
    this.oy += (oy - this.oy) * k;
  }

  // ---------------------------------------------------------------- events → fx

  onEvents(events: SimEvent[]) {
    for (const e of events) {
      switch (e.type) {
        case 'deliver': {
          const col = MATERIALS[e.color].color;
          this.fx.push({ kind: 'text', x: e.x + 0.5, y: e.y + 0.1, t: 0, life: 0.9, color: col, text: e.combo >= 5 ? `+1 ×${e.combo}` : '+1' });
          for (let k = 0; k < 5; k++) {
            const a = (k / 5) * Math.PI * 2 + Math.random();
            this.fx.push({ kind: 'spark', x: e.x + 0.5, y: e.y + 0.5, t: 0, life: 0.5, color: col, vx: Math.cos(a) * 1.4, vy: Math.sin(a) * 1.4 });
          }
          break;
        }
        case 'recycle':
          this.fx.push({ kind: 'puff', x: e.x + 0.5, y: e.y + 0.5, t: 0, life: 0.5, color: this.pal.sub });
          break;
        case 'spawnSite':
        case 'spawnSource':
          this.fx.push({ kind: 'ring', x: e.x + 0.5, y: e.y + 0.5, t: 0, life: 1.1, color: MATERIALS[e.color].color });
          break;
        case 'erase':
          this.fx.push({ kind: 'puff', x: e.x + 0.5, y: e.y + 0.5, t: 0, life: 0.4, color: this.pal.canal });
          break;
        case 'over':
          this.focusSite = e.site;
          this.shake = 0.5;
          break;
        default:
          break;
      }
    }
  }

  // ---------------------------------------------------------------- frame

  draw(sim: Sim, dt: number) {
    this.time += dt;
    this.updateCamera(sim, dt);
    const g = this.g;
    const p = this.pal;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = p.bg;
    g.fillRect(0, 0, this.cw, this.ch);

    g.save();
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const s = this.shake * 10;
      g.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }
    g.translate(this.ox, this.oy);
    const c = this.cell;
    g.scale(c, c);
    g.lineWidth = 1 / c;

    this.drawTerrain(sim);
    this.drawFog(sim);
    this.drawBelts(sim);
    this.drawItems(sim);
    this.drawOverpasses(sim);
    this.drawSources(sim);
    this.drawSites(sim);
    this.drawFx(dt);
    if (this.hint) this.drawHint();
    if (this.focusSite >= 0 && sim.state === 'over') this.drawFocus(sim);
    g.restore();
  }

  private drawTerrain(sim: Sim) {
    const g = this.g;
    const p = this.pal;
    const t = this.time;
    for (let y = 0; y < sim.h; y++) {
      for (let x = 0; x < sim.w; x++) {
        const cell = sim.cells[sim.idx(x, y)];
        if (cell.terrain === T.Water) {
          // Rounded cells bridged to their water neighbours: organic lakes and rivers.
          const water = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < sim.w && yy < sim.h && sim.cells[sim.idx(xx, yy)].terrain === T.Water;
          const m = 0.06;
          g.fillStyle = p.water;
          roundRect(g, x + m, y + m, 1 - 2 * m, 1 - 2 * m, 0.3);
          g.fill();
          if (water(x + 1, y)) g.fillRect(x + 0.5, y + m, 1, 1 - 2 * m);
          if (water(x, y + 1)) g.fillRect(x + m, y + 0.5, 1 - 2 * m, 1);
          if (water(x + 1, y) && water(x, y + 1) && water(x + 1, y + 1)) g.fillRect(x + 0.5, y + 0.5, 1, 1);
          if (x === 0) g.fillRect(x - 1, y + m, 1.5, 1 - 2 * m);
          if (x === sim.w - 1) g.fillRect(x + 0.5, y + m, 1.5, 1 - 2 * m);
          if (y === sim.h - 1) g.fillRect(x + m, y + 0.5, 1 - 2 * m, 1.5);
          if (y === 0) g.fillRect(x + m, y - 1, 1 - 2 * m, 1.5);
          g.strokeStyle = p.waterLine;
          g.lineWidth = 0.035;
          g.lineCap = 'round';
          const off = Math.sin(t * 0.8 + x * 1.7 + y * 2.3) * 0.08;
          g.beginPath();
          g.moveTo(x + 0.28 + off, y + 0.42);
          g.quadraticCurveTo(x + 0.4 + off, y + 0.34, x + 0.52 + off, y + 0.42);
          g.moveTo(x + 0.5 - off, y + 0.7);
          g.quadraticCurveTo(x + 0.62 - off, y + 0.62, x + 0.74 - off, y + 0.7);
          g.stroke();
        } else if (cell.terrain === T.Rock) {
          g.fillStyle = p.rock;
          roundRect(g, x + 0.08, y + 0.08, 0.84, 0.84, 0.22);
          g.fill();
          g.fillStyle = p.rockInk;
          g.beginPath();
          g.moveTo(x + 0.22, y + 0.72);
          g.lineTo(x + 0.42, y + 0.34);
          g.lineTo(x + 0.56, y + 0.56);
          g.lineTo(x + 0.64, y + 0.44);
          g.lineTo(x + 0.8, y + 0.72);
          g.closePath();
          g.fill();
        } else if (sim.inBounds(x, y) && !cell.belt && sim.sourceAt[sim.idx(x, y)] < 0 && sim.siteAt[sim.idx(x, y)] < 0) {
          g.fillStyle = p.dots;
          g.beginPath();
          g.arc(x + 0.5, y + 0.5, 0.045, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  }

  private drawFog(sim: Sim) {
    const g = this.g;
    const b = sim.bounds;
    g.fillStyle = this.pal.fog;
    const big = 40;
    g.fillRect(-big, -big, sim.w + big * 2, b.y0 + big);
    g.fillRect(-big, b.y1 + 1, sim.w + big * 2, big);
    g.fillRect(-big, b.y0, b.x0 + big, b.y1 - b.y0 + 1);
    g.fillRect(b.x1 + 1, b.y0, big, b.y1 - b.y0 + 1);
    g.strokeStyle = this.pal.dots;
    g.lineWidth = 0.03;
    g.setLineDash([0.12, 0.12]);
    roundRect(g, b.x0 - 0.04, b.y0 - 0.04, b.x1 - b.x0 + 1.08, b.y1 - b.y0 + 1.08, 0.3);
    g.stroke();
    g.setLineDash([]);
  }

  /** Sides a canal cell connects to (its outputs plus everything feeding it). */
  private links(sim: Sim, i: number): Dir[] {
    return [...sim.cells[i].outs, ...sim.insOf(i)];
  }

  /**
   * Canals: a sandstone edge, vivid water inside and foam ripples drifting in the
   * direction of the current. Built in three passes so junctions merge cleanly.
   */
  private drawBelts(sim: Sim) {
    const g = this.g;
    const p = this.pal;
    const stroke = new Set(sim.strokeCells());
    const path = (i: number, ext: number) => {
      const x = (i % sim.w) + 0.5, y = Math.floor(i / sim.w) + 0.5;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 0.0001, y);
      for (const d of this.links(sim, i)) {
        const nb = sim.neighbor(i, d);
        const len = nb >= 0 && (sim.siteAt[nb] >= 0 || sim.sourceAt[nb] >= 0) ? 0.5 + ext : 0.5;
        g.moveTo(x, y);
        g.lineTo(x + DX[d] * len, y + DY[d] * len);
      }
    };
    g.lineCap = 'round';
    g.lineJoin = 'round';

    // Pass 1: stone edging (wider and squared on water cells, where the canal becomes a small aqueduct).
    for (let i = 0; i < sim.cells.length; i++) {
      const cell = sim.cells[i];
      if (!cell.belt) continue;
      const grow = Math.min(1, easeOutBack(Math.min(1, cell.age * 5)));
      const onWater = cell.terrain === T.Water;
      if (onWater) {
        g.lineCap = 'butt';
        g.strokeStyle = 'rgba(0,0,0,0.12)';
        g.lineWidth = 0.7;
        g.save();
        g.translate(0.03, 0.06);
        path(i, 0);
        g.stroke();
        g.restore();
      }
      g.strokeStyle = p.canalEdge;
      g.lineWidth = (onWater ? 0.66 : 0.52) * grow;
      path(i, 0.1);
      g.stroke();
      g.lineCap = 'round';
    }

    // Pass 2: water.
    for (let i = 0; i < sim.cells.length; i++) {
      const cell = sim.cells[i];
      if (!cell.belt) continue;
      const grow = Math.min(1, easeOutBack(Math.min(1, cell.age * 5)));
      g.strokeStyle = p.canal;
      g.lineWidth = 0.36 * grow;
      path(i, 0.1);
      g.stroke();
      if (stroke.has(i)) {
        g.strokeStyle = 'rgba(255,255,255,0.22)';
        g.lineWidth = 0.14;
        g.stroke();
      }
    }

    // Pass 3: foam ripples drifting with the current.
    const speed = TUNING.BELT_SPEED * sim.speedMul;
    const phase = (this.time * speed) % 0.5;
    g.strokeStyle = p.foam;
    g.lineWidth = 0.035;
    g.beginPath();
    for (let i = 0; i < sim.cells.length; i++) {
      const cell = sim.cells[i];
      if (!cell.belt || cell.outs.length === 0) continue;
      const x = (i % sim.w) + 0.5, y = Math.floor(i / sim.w) + 0.5;
      const ins = sim.insOf(i);
      const segs: { d: Dir; from: number; to: number }[] = [];
      for (const d of ins) segs.push({ d: opposite(d), from: -0.5, to: 0 });
      for (const d of cell.outs) segs.push({ d, from: 0, to: 0.5 });
      for (const sg of segs) this.foamSegment(x, y, sg.d, sg.from, sg.to, phase, i);
    }
    g.stroke();
  }

  /** Short foam strokes along one half-cell of canal, alternating sides like ripples. */
  private foamSegment(x: number, y: number, d: Dir, from: number, to: number, phase: number, seed: number) {
    const g = this.g;
    let k = 0;
    for (let o = from + phase - 0.5; o < to; o += 0.25, k++) {
      if (o < from) continue;
      const side = (k + seed) % 2 === 0 ? 0.08 : -0.08;
      const cx = x + DX[d] * o - DY[d] * side;
      const cy = y + DY[d] * o + DX[d] * side;
      g.moveTo(cx - DX[d] * 0.05, cy - DY[d] * 0.05);
      g.lineTo(cx + DX[d] * 0.05, cy + DY[d] * 0.05);
    }
  }

  private itemPos(sim: Sim, i: number, it: Item): [number, number] {
    const x = (i % sim.w) + 0.5, y = Math.floor(i / sim.w) + 0.5;
    if (it.p < 0.5 && it.from !== -1) {
      const k = 1 - it.p * 2;
      return [x + DX[it.from] * 0.5 * k, y + DY[it.from] * 0.5 * k];
    }
    if (it.out === -1) return [x, y];
    const k = Math.max(0, it.p - 0.5) * 2;
    return [x + DX[it.out] * 0.5 * k, y + DY[it.out] * 0.5 * k];
  }

  private drawItems(sim: Sim) {
    for (let i = 0; i < sim.cells.length; i++) {
      const cell = sim.cells[i];
      if (!cell.belt) continue;
      for (const it of cell.items) this.drawItem(sim, i, it);
    }
  }

  /** An item is a small glossy tessera floating on the canal, bobbing gently. */
  private drawItem(sim: Sim, i: number, it: Item) {
    const g = this.g;
    const s = 0.22;
    const [x, y] = this.itemPos(sim, i, it);
    const m = MATERIALS[it.color];
    const bob = Math.sin(this.time * 3 + it.id * 1.7);
    g.save();
    g.translate(x, y);
    g.fillStyle = 'rgba(0,30,40,0.16)';
    roundRect(g, -s / 2 + 0.02, -s / 2 + 0.04, s, s, 0.05);
    g.fill();
    g.rotate(bob * 0.14);
    g.translate(0, bob * 0.012);
    g.fillStyle = m.color;
    roundRect(g, -s / 2, -s / 2, s, s, 0.05);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.3)';
    roundRect(g, -s / 2 + 0.03, -s / 2 + 0.03, s * 0.45, s * 0.22, 0.03);
    g.fill();
    if (this.colorblind) {
      g.fillStyle = 'rgba(255,255,255,0.9)';
      drawGlyph(g, m.glyph, 0, 0, 0.06);
    }
    g.restore();
  }

  /** Aqueducts carrying one canal over another: drawn last, raised, with a shadow and arches. */
  private drawOverpasses(sim: Sim) {
    const g = this.g;
    const p = this.pal;
    const phase = (this.time * TUNING.BELT_SPEED * sim.speedMul) % 0.5;
    for (let i = 0; i < sim.cells.length; i++) {
      const cross = sim.cells[i].cross;
      if (!cross) continue;
      const x = (i % sim.w) + 0.5, y = Math.floor(i / sim.w) + 0.5;
      const dx = DX[cross.dir] * 0.5, dy = DY[cross.dir] * 0.5;
      const px = -DY[cross.dir], py = DX[cross.dir];
      g.lineCap = 'butt';
      g.strokeStyle = 'rgba(0,0,0,0.18)';
      g.lineWidth = 0.68;
      g.beginPath();
      g.moveTo(x - dx + 0.04, y - dy + 0.08);
      g.lineTo(x + dx + 0.04, y + dy + 0.08);
      g.stroke();
      g.strokeStyle = p.canalEdge;
      g.lineWidth = 0.66;
      g.beginPath();
      g.moveTo(x - dx, y - dy);
      g.lineTo(x + dx, y + dy);
      g.stroke();
      // Arches on both parapets.
      g.fillStyle = 'rgba(0,0,0,0.14)';
      for (const side of [-1, 1]) {
        for (const o of [-0.25, 0.25]) {
          g.beginPath();
          g.arc(x + DX[cross.dir] * o + px * side * 0.33, y + DY[cross.dir] * o + py * side * 0.33, 0.07, 0, Math.PI * 2);
          g.fill();
        }
      }
      g.strokeStyle = p.canal;
      g.lineWidth = 0.36;
      g.beginPath();
      g.moveTo(x - dx, y - dy);
      g.lineTo(x + dx, y + dy);
      g.stroke();
      g.lineCap = 'round';
      g.strokeStyle = p.foam;
      g.lineWidth = 0.035;
      g.beginPath();
      this.foamSegment(x, y, cross.dir, -0.5, 0.5, phase, i);
      g.stroke();
      for (const it of cross.items) this.drawItem(sim, i, it);
    }
  }

  /** Fountains: a stone basin with rippling water around a coloured spring. */
  private drawSources(sim: Sim) {
    const g = this.g;
    const p = this.pal;
    for (const s of sim.sources) {
      const x = s.x + 0.5, y = s.y + 0.5;
      const m = MATERIALS[s.color];
      const pop = easeOutBack(Math.min(1, s.age * 2.5));
      const r = 0.4 * pop;
      g.fillStyle = 'rgba(0,0,0,0.12)';
      g.beginPath();
      g.arc(x + 0.02, y + 0.05, r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = p.canalEdge;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = p.canal;
      g.beginPath();
      g.arc(x, y, r * 0.78, 0, Math.PI * 2);
      g.fill();
      // Ripples spreading from the spring.
      g.strokeStyle = p.foam;
      g.lineWidth = 0.025;
      for (let k = 0; k < 2; k++) {
        const t = (this.time * 0.6 + k * 0.5 + s.id * 0.37) % 1;
        g.globalAlpha = 1 - t;
        g.beginPath();
        g.arc(x, y, r * (0.4 + t * 0.36), 0, Math.PI * 2);
        g.stroke();
      }
      g.globalAlpha = 1;
      // Emission progress around the spring.
      const prog = 1 - s.timer / TUNING.EMIT_PERIOD;
      g.strokeStyle = m.color;
      g.lineWidth = 0.05;
      g.lineCap = 'round';
      g.beginPath();
      g.arc(x, y, r * 0.62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, prog));
      g.stroke();
      g.fillStyle = m.color;
      g.beginPath();
      g.arc(x, y, r * 0.4, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.95)';
      drawGlyph(g, m.glyph, x, y, 0.08 * pop);
      // Tiles waiting in the basin.
      for (let k = 0; k < TUNING.SOURCE_BUFFER; k++) {
        g.fillStyle = k < s.buffer ? m.color : p.dots;
        const bx = x - 0.16 + k * 0.16;
        roundRect(g, bx - 0.045, y + r + 0.05, 0.09, 0.09, 0.02);
        g.fill();
      }
    }
  }

  private drawSites(sim: Sim) {
    const g = this.g;
    const p = this.pal;
    for (const s of sim.sites) {
      const x = s.x + 0.5, y = s.y + 0.5;
      const m = MATERIALS[s.color];
      const pop = easeOutBack(Math.min(1, s.age * 2.5)) * (1 + s.bump * 0.12);
      const h = 0.4 * pop;
      if (s.overflow > 0) {
        const pulse = s.overflow > 0.5 ? 0.5 + 0.5 * Math.sin(this.time * 10) : 1;
        g.strokeStyle = DANGER;
        g.globalAlpha = 0.35 + 0.65 * pulse;
        g.lineWidth = 0.07;
        g.lineCap = 'round';
        g.beginPath();
        g.arc(x, y, 0.55, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * s.overflow);
        g.stroke();
        g.globalAlpha = 1;
      }
      g.fillStyle = 'rgba(0,0,0,0.12)';
      roundRect(g, x - h + 0.02, y - h + 0.04, h * 2, h * 2, 0.14);
      g.fill();
      g.fillStyle = p.card;
      roundRect(g, x - h, y - h, h * 2, h * 2, 0.14);
      g.fill();
      g.strokeStyle = m.color;
      g.lineWidth = 0.08;
      g.stroke();
      // Pending orders as tiles (3 x 2 grid), stock as hollow tiles.
      const total = Math.min(6, s.pending + s.stock);
      const size = 0.15 * pop;
      for (let k = 0; k < total; k++) {
        const col = k % 3, row = Math.floor(k / 3);
        const tx = x - 0.21 * pop + col * 0.21 * pop - size / 2;
        const ty = y - 0.1 * pop + row * 0.21 * pop - size / 2;
        roundRect(g, tx, ty, size, size, 0.03);
        if (k < s.pending) {
          g.fillStyle = s.pending >= TUNING.OVERFLOW_AT ? DANGER : m.color;
          g.fill();
        } else {
          g.strokeStyle = m.color;
          g.lineWidth = 0.03;
          g.stroke();
        }
      }
      if (total === 0 || this.colorblind) {
        g.fillStyle = m.color;
        drawGlyph(g, m.glyph, x, total === 0 ? y : y - 0.26 * pop, total === 0 ? 0.1 : 0.05);
      }
    }
  }

  private drawFx(dt: number) {
    const g = this.g;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let k = this.fx.length - 1; k >= 0; k--) {
      const f = this.fx[k];
      f.t += dt;
      const a = f.t / f.life;
      if (a >= 1) {
        this.fx.splice(k, 1);
        continue;
      }
      g.globalAlpha = 1 - a;
      switch (f.kind) {
        case 'text':
          g.fillStyle = f.color;
          g.font = `700 0.3px ui-rounded, system-ui, sans-serif`;
          g.fillText(f.text!, f.x, f.y - a * 0.5);
          break;
        case 'puff':
          g.fillStyle = f.color;
          g.beginPath();
          g.arc(f.x, f.y, 0.1 + a * 0.3, 0, Math.PI * 2);
          g.fill();
          break;
        case 'ring':
          g.strokeStyle = f.color;
          g.lineWidth = 0.05 * (1 - a);
          g.beginPath();
          g.arc(f.x, f.y, 0.3 + a * 0.9, 0, Math.PI * 2);
          g.stroke();
          break;
        case 'spark':
          g.fillStyle = f.color;
          g.beginPath();
          g.arc(f.x + f.vx! * a * 0.5, f.y + f.vy! * a * 0.5, 0.05 * (1 - a), 0, Math.PI * 2);
          g.fill();
          break;
      }
    }
    g.globalAlpha = 1;
  }

  private drawHint() {
    const g = this.g;
    const h = this.hint!;
    const cyc = (this.time % 2.2) / 1.6;
    const a = Math.min(1, cyc);
    // Manhattan path: horizontal then vertical.
    const fx = h.from.x + 0.5, fy = h.from.y + 0.5, tx = h.to.x + 0.5, ty = h.to.y + 0.5;
    const lx = Math.abs(tx - fx), ly = Math.abs(ty - fy);
    const d = (lx + ly) * a;
    const px = d <= lx ? fx + Math.sign(tx - fx) * d : tx;
    const py = d <= lx ? fy : fy + Math.sign(ty - fy) * (d - lx);
    g.strokeStyle = this.pal.sub;
    g.globalAlpha = 0.5;
    g.lineWidth = 0.06;
    g.setLineDash([0.1, 0.12]);
    g.beginPath();
    g.moveTo(fx, fy);
    g.lineTo(tx, fy);
    g.lineTo(tx, ty);
    g.stroke();
    g.setLineDash([]);
    g.globalAlpha = cyc > 1 ? 0 : 0.9;
    g.fillStyle = this.pal.ink;
    g.beginPath();
    g.arc(px, py, 0.16, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = this.pal.card;
    g.lineWidth = 0.04;
    g.stroke();
    g.globalAlpha = 1;
  }

  private drawFocus(sim: Sim) {
    const g = this.g;
    const s = sim.sites[this.focusSite];
    if (!s) return;
    const r = 0.8 + Math.sin(this.time * 4) * 0.08;
    g.strokeStyle = DANGER;
    g.lineWidth = 0.06;
    g.beginPath();
    g.arc(s.x + 0.5, s.y + 0.5, r, 0, Math.PI * 2);
    g.stroke();
  }
}
