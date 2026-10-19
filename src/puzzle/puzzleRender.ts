import { MATERIALS, type Palette } from '../game/content';
import { drawGlyph } from '../game/render';
import { PUZZLE_COLORS, type PuzzleState } from './puzzle';
import { boatColor, isUnderwater, Scene } from './scene';

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
  /** Water fill progress (0..1) of each linked canal, keyed by its two ends. */
  private flow = new Map<number, number>();
  /** Decor around the board (chapter mood). */
  readonly scene = new Scene();
  /** Name shown above the board when the picture is revealed. */
  title = '';
  /** Cells of a canal to demonstrate with a ghost finger (first level only). */
  demo: number[] | null = null;
  /** 0..1 sweep of light across the revealed mosaic. */
  glint = 0;

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
    this.scene.draw(g, this.cw, this.ch, this.dpr, { x: this.ox, y: this.oy, size: this.cell * n }, this.time);
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
      this.drawCanals(st, dt);
      this.drawEndpoints(st);
      if (this.demo) this.drawDemo(st.n, this.demo);
      g.globalAlpha = 1;
    }
    if (rv > 0) this.drawPicture(st, rv);
    g.restore();
    if (this.title && rv > 0.55) {
      g.save();
      g.globalAlpha = Math.min(1, (rv - 0.55) / 0.3);
      g.fillStyle = isUnderwater(this.scene.theme) || this.scene.theme === 'night' ? '#F3EEE4' : p.ink;
      g.shadowColor = 'rgba(0,0,0,0.25)';
      g.shadowBlur = 8;
      g.textAlign = 'center';
      g.textBaseline = 'bottom';
      g.font = `600 ${Math.round(Math.min(34, this.cell * 0.8))}px 'Fraunces Variable', Georgia, serif`;
      g.fillText(this.title, this.cw / 2, this.oy - 14 + (1 - g.globalAlpha) * 8);
      g.restore();
    }
  }

  private center(i: number, n: number): [number, number] {
    return [(i % n) + 0.5, Math.floor(i / n) + 0.5];
  }

  /**
   * Canals: while unlinked they are a dry stone bed tinted with their colour; once linked,
   * water rushes in from the fountain (dash animation along the path) and then shimmers.
   */
  private drawCanals(st: PuzzleState, dt: number) {
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
    const live = new Set<number>();
    st.paths.forEach((path, k) => {
      if (path.length < 2) return;
      const key = path[0] * 1000 + path[path.length - 1];
      live.add(key);
      if (st.isConnected(k)) this.flow.set(key, Math.min(1, (this.flow.get(key) ?? 0) + dt * (2.6 / Math.max(1, path.length / 4))));
      else this.flow.delete(key);
    });
    for (const key of [...this.flow.keys()]) if (!live.has(key)) this.flow.delete(key);

    // Banks first, so separate canals never look joined.
    st.paths.forEach((path) => {
      if (path.length < 2) return;
      trace(path);
      g.strokeStyle = this.pal.canalEdge;
      g.lineWidth = 0.58;
      g.stroke();
    });
    st.paths.forEach((path, k) => {
      if (path.length < 2) return;
      const col = colorOf(st.pathColor(k));
      const flow = this.flow.get(path[0] * 1000 + path[path.length - 1]) ?? 0;
      trace(path);
      // Dry bed with a coloured guide line.
      g.save();
      g.globalAlpha *= 0.3;
      g.strokeStyle = col;
      g.lineWidth = 0.4;
      g.stroke();
      g.restore();
      g.strokeStyle = col;
      g.lineWidth = 0.1;
      g.stroke();
      if (flow > 0) {
        const len = path.length - 1;
        g.setLineDash([len * flow + 0.001, len + 1]);
        g.lineDashOffset = 0;
        g.strokeStyle = col;
        g.lineWidth = 0.42;
        g.stroke();
        g.setLineDash([]);
        if (flow < 1) {
          // Foamy water front.
          const pos = flow * len;
          const i0 = Math.floor(pos);
          const f = pos - i0;
          const [ax, ay] = this.center(path[i0], n);
          const [bx, by] = this.center(path[Math.min(len, i0 + 1)], n);
          g.fillStyle = 'rgba(255,255,255,0.75)';
          g.beginPath();
          g.arc(ax + (bx - ax) * f, ay + (by - ay) * f, 0.13, 0, Math.PI * 2);
          g.fill();
        } else {
          g.strokeStyle = 'rgba(255,255,255,0.32)';
          g.lineWidth = 0.06;
          g.setLineDash([0.1, 0.4]);
          g.lineDashOffset = -this.time * 1.1;
          g.stroke();
          g.setLineDash([]);
        }
      }
      if (st.drawingPath === k) {
        const [hx, hy] = this.center(path[path.length - 1], n);
        g.save();
        g.fillStyle = col;
        g.globalAlpha *= 0.22;
        g.beginPath();
        g.arc(hx, hy, 0.5, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    });
    // Boats (or fish, under the sea) drifting back and forth along finished canals.
    st.paths.forEach((path, k) => {
      if (path.length < 3 || (this.flow.get(path[0] * 1000 + path[path.length - 1]) ?? 0) < 1) return;
      const len = path.length - 1;
      const u = (this.time * (1.1 / len) + k * 0.37) % 2;
      const pos = (u < 1 ? u : 2 - u) * len;
      const i0 = Math.min(len - 1, Math.floor(pos));
      const f = pos - i0;
      const [ax, ay] = this.center(path[i0], n);
      const [bx, by] = this.center(path[i0 + 1], n);
      const ang = Math.atan2(by - ay, bx - ax) + (u < 1 ? 0 : Math.PI);
      this.drawBoat(ax + (bx - ax) * f, ay + (by - ay) * f, ang, colorOf(st.pathColor(k)));
    });
    // Short highlight on canals laid by a hint.
    for (let j = this.pulses.length - 1; j >= 0; j--) {
      const pu = this.pulses[j];
      pu.t += dt;
      const path = st.paths[pu.k];
      if (!path || pu.t > 1) {
        this.pulses.splice(j, 1);
        continue;
      }
      trace(path);
      g.strokeStyle = `rgba(255,255,255,${0.5 * (1 - pu.t)})`;
      g.lineWidth = 0.5;
      g.stroke();
    }
  }

  /** A gondola seen from above (a little fish in the sunken city), heading `ang`. */
  private drawBoat(x: number, y: number, ang: number, accent: string) {
    const g = this.g;
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    if (isUnderwater(this.scene.theme)) {
      g.fillStyle = accent;
      g.beginPath();
      g.ellipse(0, 0, 0.16, 0.08, 0, 0, Math.PI * 2);
      g.moveTo(-0.14, 0);
      g.lineTo(-0.26, -0.08);
      g.lineTo(-0.26, 0.08);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.8)';
      g.beginPath();
      g.arc(0.08, -0.02, 0.02, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.beginPath();
      g.ellipse(0.02, 0.04, 0.24, 0.09, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = boatColor(this.scene.theme);
      g.beginPath();
      g.moveTo(0.26, 0);
      g.quadraticCurveTo(0.1, -0.11, -0.2, -0.08);
      g.lineTo(-0.24, 0);
      g.lineTo(-0.2, 0.08);
      g.quadraticCurveTo(0.1, 0.11, 0.26, 0);
      g.fill();
      g.strokeStyle = 'rgba(40,40,46,0.35)';
      g.lineWidth = 0.02;
      g.stroke();
      g.fillStyle = accent;
      g.fillRect(-0.08, -0.05, 0.12, 0.1);
    }
    g.restore();
  }

  /** A translucent finger tracing the first canal, looping until the player touches the board. */
  private drawDemo(n: number, path: number[]) {
    const g = this.g;
    const cyc = (this.time % 2.8) / 2.2;
    if (cyc > 1) return;
    const pos = cyc * (path.length - 1);
    const i0 = Math.floor(pos);
    const f = pos - i0;
    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(40,40,46,0.18)';
    g.lineWidth = 0.22;
    g.beginPath();
    for (let k = 0; k <= i0; k++) {
      const [x, y] = this.center(path[k], n);
      if (k === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    const [ax, ay] = this.center(path[i0], n);
    const [bx, by] = this.center(path[Math.min(path.length - 1, i0 + 1)], n);
    const hx = ax + (bx - ax) * f, hy = ay + (by - ay) * f;
    g.lineTo(hx, hy);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.strokeStyle = 'rgba(40,40,46,0.55)';
    g.lineWidth = 0.04;
    g.beginPath();
    g.arc(hx + 0.08, hy + 0.12, 0.2, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.restore();
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
      // A band of light sweeps diagonally across the finished mosaic.
      if (this.glint > 0 && this.glint < 1) {
        const d = this.glint * (2 * n + 4) - 2 - (x + y);
        const a = Math.max(0, 1 - Math.abs(d) / 1.4) * 0.55;
        if (a > 0) {
          g.fillStyle = `rgba(255,255,255,${a})`;
          g.beginPath();
          g.roundRect(-s / 2, -s / 2, s, s, 0.12);
          g.fill();
        }
      }
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
