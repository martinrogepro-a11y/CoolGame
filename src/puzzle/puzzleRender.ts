import { MATERIALS, type Palette } from '../game/content';
import { drawGlyph } from '../game/render';
import { PUZZLE_COLORS, type PuzzleState } from './puzzle';

const STONE = '#A99D8A';

export function colorOf(hue: number): string {
  return PUZZLE_COLORS[hue] ?? STONE;
}

function easeOutBack(t: number): number {
  const u = t - 1;
  return 1 + 2.7 * u * u * u + 1.7 * u * u;
}

function hash(n: number): number {
  n = Math.imul(n ^ 0x5bd1e995, 0x27d4eb2d);
  return ((n ^ (n >>> 15)) >>> 0) / 4294967296;
}

/**
 * Draws a canal puzzle. Canals are coloured water in stone banks; fountains are round
 * basins, workshops square. When solved, `reveal` (0..1) turns every cell into the
 * tile of the hidden picture, from the centre outwards.
 */
export class PuzzleRenderer {
  private g: CanvasRenderingContext2D;
  private dpr = 1;
  private cw = 0;
  private ch = 0;
  pal: Palette;
  colorblind = false;
  insets = { top: 100, bottom: 120 };
  cell = 40;
  ox = 0;
  oy = 0;
  private time = 0;
  reveal = 0;
  /** Water pulse running along freshly connected canals. */
  private pulses: { k: number; t: number }[] = [];

  constructor(private canvas: HTMLCanvasElement, pal: Palette) {
    this.g = canvas.getContext('2d', { alpha: false })!;
    this.pal = pal;
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.cw = this.canvas.clientWidth;
    this.ch = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.cw * this.dpr);
    this.canvas.height = Math.round(this.ch * this.dpr);
  }

  layout(n: number) {
    const availW = this.cw - 32;
    const availH = this.ch - this.insets.top - this.insets.bottom;
    this.cell = Math.floor(Math.min(availW / n, availH / n, 72));
    this.ox = Math.round((this.cw - this.cell * n) / 2);
    this.oy = Math.round(this.insets.top + (availH - this.cell * n) / 2);
  }

  cellAt(px: number, py: number, n: number): { i: number; inner: boolean } {
    const fx = (px - this.ox) / this.cell;
    const fy = (py - this.oy) / this.cell;
    const x = Math.floor(fx), y = Math.floor(fy);
    if (x < 0 || y < 0 || x >= n || y >= n) return { i: -1, inner: false };
    const inner = Math.abs(fx - x - 0.5) < 0.42 && Math.abs(fy - y - 0.5) < 0.42;
    return { i: y * n + x, inner };
  }

  pulse(k: number) {
    this.pulses.push({ k, t: 0 });
  }

  draw(st: PuzzleState, dt: number) {
    this.time += dt;
    const g = this.g;
    const p = this.pal;
    const n = st.n;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = p.bg;
    g.fillRect(0, 0, this.cw, this.ch);
    g.save();
    g.translate(this.ox, this.oy);
    g.scale(this.cell, this.cell);

    // Board: a stone slab with soft cells.
    g.fillStyle = 'rgba(0,0,0,0.06)';
    g.beginPath();
    g.roundRect(-0.12, -0.06, n + 0.24, n + 0.3, 0.3);
    g.fill();
    g.fillStyle = p.canalEdge;
    g.beginPath();
    g.roundRect(-0.12, -0.12, n + 0.24, n + 0.24, 0.3);
    g.fill();
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        g.fillStyle = p.card;
        g.beginPath();
        g.roundRect(x + 0.04, y + 0.04, 0.92, 0.92, 0.16);
        g.fill();
      }

    const rv = this.reveal;
    if (rv < 1) {
      g.globalAlpha = 1 - Math.min(1, rv * 1.6);
      this.drawCanals(st);
      this.drawEndpoints(st);
      g.globalAlpha = 1;
    }
    if (rv > 0) this.drawPicture(st, rv);
    g.restore();
  }

  private center(i: number, n: number): [number, number] {
    return [(i % n) + 0.5, Math.floor(i / n) + 0.5];
  }

  private drawCanals(st: PuzzleState) {
    const g = this.g;
    const n = st.n;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const trace = (path: number[]) => {
      g.beginPath();
      path.forEach((c, j) => {
        const [x, y] = this.center(c, n);
        if (j === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      });
    };
    // Banks first, so crossings of separate canals never look joined.
    st.paths.forEach((path) => {
      if (path.length < 2) return;
      trace(path);
      g.strokeStyle = this.pal.canalEdge;
      g.lineWidth = 0.56;
      g.stroke();
    });
    st.paths.forEach((path, k) => {
      if (path.length < 2) return;
      const col = colorOf(st.pathColor(k));
      trace(path);
      g.strokeStyle = col;
      g.lineWidth = 0.4;
      g.stroke();
      // Moving water highlights.
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 0.06;
      g.setLineDash([0.12, 0.38]);
      g.lineDashOffset = -this.time * 1.2;
      g.stroke();
      g.setLineDash([]);
      if (st.drawingPath === k) {
        const [hx, hy] = this.center(path[path.length - 1], n);
        g.save();
        g.fillStyle = col;
        g.globalAlpha *= 0.25;
        g.beginPath();
        g.arc(hx, hy, 0.48, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    });
    // Celebration pulse along newly connected canals.
    for (let j = this.pulses.length - 1; j >= 0; j--) {
      const pu = this.pulses[j];
      pu.t += 1 / 60;
      const path = st.paths[pu.k];
      if (!path || pu.t > 1) {
        this.pulses.splice(j, 1);
        continue;
      }
      const at = Math.min(path.length - 1, Math.floor(pu.t * path.length));
      const [x, y] = this.center(path[at], n);
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.beginPath();
      g.arc(x, y, 0.16 * (1 - pu.t) + 0.06, 0, Math.PI * 2);
      g.fill();
    }
  }

  private drawEndpoints(st: PuzzleState) {
    const g = this.g;
    const n = st.n;
    const connected = new Set<number>();
    st.paths.forEach((p, k) => {
      if (st.isConnected(k)) {
        connected.add(p[0]);
        connected.add(p[p.length - 1]);
      }
    });
    for (const e of st.endpoints) {
      const [x, y] = this.center(e.cell, n);
      const col = colorOf(e.hue);
      const done = connected.has(e.cell);
      const glyph = e.hue < 5 ? MATERIALS[e.hue].glyph : 'circle';
      g.fillStyle = 'rgba(0,0,0,0.14)';
      if (e.kind === 'fountain') {
        g.beginPath();
        g.arc(x + 0.02, y + 0.05, 0.36, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = this.pal.canalEdge;
        g.beginPath();
        g.arc(x, y, 0.36, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = col;
        g.beginPath();
        g.arc(x, y, 0.27, 0, Math.PI * 2);
        g.fill();
        if (!done) {
          const t = (this.time * 0.7 + e.cell * 0.13) % 1;
          g.save();
          g.strokeStyle = 'rgba(255,255,255,0.6)';
          g.lineWidth = 0.03;
          g.globalAlpha *= 1 - t;
          g.beginPath();
          g.arc(x, y, 0.1 + t * 0.17, 0, Math.PI * 2);
          g.stroke();
          g.restore();
        }
      } else {
        g.beginPath();
        g.roundRect(x - 0.33 + 0.02, y - 0.33 + 0.05, 0.66, 0.66, 0.14);
        g.fill();
        g.fillStyle = this.pal.card;
        g.strokeStyle = col;
        g.lineWidth = 0.09;
        g.beginPath();
        g.roundRect(x - 0.33, y - 0.33, 0.66, 0.66, 0.14);
        g.fill();
        g.stroke();
        if (done) {
          g.fillStyle = col;
          g.beginPath();
          g.roundRect(x - 0.16, y - 0.16, 0.32, 0.32, 0.06);
          g.fill();
        }
      }
      if (this.colorblind || e.kind === 'fountain') {
        g.fillStyle = e.kind === 'fountain' ? 'rgba(255,255,255,0.95)' : col;
        if (e.kind === 'fountain' || !done) drawGlyph(g, glyph, x, y, 0.09);
      }
    }
  }

  /** The hidden mosaic: tiles pop in from the centre, slightly turned like hand-set tesserae. */
  private drawPicture(st: PuzzleState, rv: number) {
    const g = this.g;
    const n = st.n;
    const c0 = (n - 1) / 2;
    const maxD = Math.hypot(c0, c0) + 0.01;
    for (let i = 0; i < n * n; i++) {
      const x = i % n, y = Math.floor(i / n);
      const delay = (Math.hypot(x - c0, y - c0) / maxD) * 0.55;
      const t = Math.max(0, Math.min(1, (rv - delay) / 0.4));
      if (t <= 0) continue;
      const s = 0.9 * easeOutBack(t);
      const c = st.level.colors[i];
      const rot = (hash(i * 31 + n) - 0.5) * 0.16;
      g.save();
      g.translate(x + 0.5, y + 0.5);
      g.rotate(rot * (1 - t * 0.3));
      g.fillStyle = c < 5 ? MATERIALS[c].color : this.pal.dark ? '#3a3f52' : '#EFE7DA';
      g.beginPath();
      g.roundRect(-s / 2, -s / 2, s, s, 0.12);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.fillRect(-s / 2 + 0.1, -s / 2 + 0.1, s * 0.4, s * 0.12);
      g.restore();
    }
  }
}

/** Small picture thumbnail for level lists: the mosaic if solved, a silhouette otherwise. */
export function drawPictureThumb(canvas: HTMLCanvasElement, colors: number[], n: number, solved: boolean, pal: Palette) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const size = canvas.clientWidth || 56;
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  const g = canvas.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cell = size / n;
  g.fillStyle = pal.canalEdge;
  g.beginPath();
  g.roundRect(0, 0, size, size, size * 0.12);
  g.fill();
  for (let i = 0; i < n * n; i++) {
    const c = colors[i];
    const x = i % n, y = Math.floor(i / n);
    g.fillStyle = solved ? (c < 5 ? MATERIALS[c].color : pal.dark ? '#3a3f52' : '#EFE7DA') : c < 5 ? (pal.dark ? '#4a5068' : '#d9cfbf') : pal.card;
    g.fillRect(x * cell + cell * 0.08, y * cell + cell * 0.08, cell * 0.84, cell * 0.84);
  }
}
