import { drawGlyph, MATERIALS, type Palette } from '../game/content';
import { PUZZLE_COLORS, type PuzzleState } from './puzzle';
import { boardStyle, Scene } from './scene';

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
  /** True while something on the board is moving fast (water rushing in, a hint, the reveal). */
  get animating(): boolean {
    return this.pulses.length > 0 || (this.reveal > 0 && this.reveal < 1) || [...this.flow.values()].some((f) => f < 1);
  }
  /** Width of the mosaic border, in cells. */
  private border = 0.34;
  /** Finger position while drawing: a magnifier shows the cells under it on dense grids. */
  loupe: { x: number; y: number } | null = null;
  /** Objects are drawn larger and simpler when cells are small (level of detail). */
  private get dense(): boolean {
    return this.cell < 48;
  }
  /** Decor around the board (chapter mood). */
  readonly scene = new Scene();
  private bs = boardStyle('harbour');
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
    // Twice the CSS resolution is as sharp as the eye sees on a phone, at less than half the pixels of 3×.
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cw = this.canvas.clientWidth;
    this.ch = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.cw * this.dpr);
    this.canvas.height = Math.round(this.ch * this.dpr);
  }

  layout(n: number) {
    // Dense grids get the full width (a thinner mosaic border, a narrower margin); small
    // ones are capped, so the jump from the first levels to the last is not a zoom-out.
    this.border = n >= 8 ? 0.22 : 0.34;
    const availW = this.cw - (n >= 8 ? 14 : 32) - this.border * 2 * 36;
    const availH = this.ch - this.insets.top - this.insets.bottom;
    this.cell = Math.floor(Math.min(availW / n, availH / n, 60));
    this.ox = Math.round((this.cw - this.cell * n) / 2);
    this.oy = Math.round(this.insets.top + (availH - this.cell * n) / 2);
  }

  /** Draws only the chapter scene (menu backdrop), with the skyline standing at `horizon` (0..1 of the height). */
  drawAmbient(dt: number, horizon = 0.62) {
    this.time += dt;
    const g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.scene.draw(g, this.cw, this.ch, this.dpr, { x: 0, y: this.ch * horizon, size: 0 }, this.time);
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
    const n = st.n;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.bs = boardStyle(this.scene.theme);
    this.scene.draw(g, this.cw, this.ch, this.dpr, { x: this.ox, y: this.oy, size: this.cell * n }, this.time);
    // The board is a piece of the place seen from above, cached until the layout changes.
    const pad = 0.5;
    g.drawImage(this.boardBase(st), this.ox - pad * this.cell, this.oy - pad * this.cell, (n + pad * 2) * this.cell, (n + pad * 2) * this.cell);
    g.save();
    g.translate(this.ox, this.oy);
    g.scale(this.cell, this.cell);

    const rv = this.reveal;
    if (rv < 1) {
      g.globalAlpha = 1 - Math.min(1, rv * 1.6);
      this.drawCanals(st, dt);
      this.drawFeatures(st);
      this.drawEndpoints(st);
      if (this.demo) this.drawDemo(st.n, this.demo);
      g.globalAlpha = 1;
    }
    if (rv > 0) this.drawPicture(st, rv);
    g.restore();
    if (this.title && rv > 0.55) {
      g.save();
      g.globalAlpha = Math.min(1, (rv - 0.55) / 0.3);
      g.fillStyle = this.bs.titleOnDark ? '#F3EEE4' : this.bs.ink;
      g.shadowColor = 'rgba(0,0,0,0.25)';
      g.shadowBlur = 8;
      g.textAlign = 'center';
      g.textBaseline = 'bottom';
      g.font = `600 ${Math.round(Math.min(34, this.cell * 0.8))}px 'Fraunces Variable', Georgia, serif`;
      g.fillText(this.title, this.cw / 2, this.oy - 14 + (1 - g.globalAlpha) * 8);
      g.restore();
    }
    if (this.loupe && this.dense && rv === 0) this.drawLoupe();
  }

  /**
   * On dense grids the finger hides the cell it is on: a round magnifier floats above it
   * (like the iOS text loupe) showing the canal's head and its neighbours, enlarged.
   */
  private drawLoupe() {
    const g = this.g;
    const { x, y } = this.loupe!;
    const src = this.cell * 1.3, R = 58, zoom = R / src;
    const cx = Math.min(this.cw - R - 8, Math.max(R + 8, x));
    const cy = Math.max(R + 70, y - 110);
    const d = this.dpr;
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.3)';
    g.shadowBlur = 14;
    g.shadowOffsetY = 4;
    g.fillStyle = '#FBF8F1';
    g.beginPath();
    g.arc(cx, cy, R + 3, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.save();
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.clip();
    g.drawImage(this.canvas, (x - src) * d, (y - src) * d, src * 2 * d, src * 2 * d, cx - R, cy - R, R * 2, R * 2);
    // Where the finger is.
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, 6 * zoom, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }

  private baseCanvas: HTMLCanvasElement | null = null;
  private baseKey = '';

  /** Mosaic border, joints and textured cells of the place, drawn once per layout. */
  private boardBase(st: PuzzleState): HTMLCanvasElement {
    const n = st.n;
    const pad = 0.5;
    const px = Math.round((n + pad * 2) * this.cell * this.dpr);
    const key = `${this.bs.kind}|${n}|${px}|${this.border}|${[...st.stalls].join()}|${[...st.currents.keys()].join()}`;
    if (this.baseCanvas && key === this.baseKey) return this.baseCanvas;
    this.baseKey = key;
    const c = (this.baseCanvas ??= document.createElement('canvas'));
    c.width = c.height = px;
    const g = c.getContext('2d')!;
    const u = px / (n + pad * 2);
    g.setTransform(u, 0, 0, u, pad * u, pad * u);
    g.clearRect(-pad, -pad, n + pad * 2, n + pad * 2);
    const bs = this.bs;
    // Border: a band of coloured tesserae around the joints.
    const bw = this.border;
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(-bw, -bw + 0.08, n + bw * 2, n + bw * 2);
    g.fillStyle = bs.slab;
    g.fillRect(-bw, -bw, n + bw * 2, n + bw * 2);
    const per = 3;
    const step = (n + bw * 2 - 0.06) / (n * per + 2);
    const s = step * 0.78;
    for (let k = 0; k < n * per + 2; k++) {
      const p = -bw + 0.03 + k * step;
      g.fillStyle = bs.tess[k % bs.tess.length];
      g.fillRect(p, -bw + 0.04, s, s);
      g.fillRect(p, n + bw - 0.04 - s, s, s);
      g.fillStyle = bs.tess[(k + 2) % bs.tess.length];
      g.fillRect(-bw + 0.04, p, s, s);
      g.fillRect(n + bw - 0.04 - s, p, s, s);
      // Each tessera catches a little light on its top edge.
      g.fillStyle = 'rgba(255,255,255,0.3)';
      g.fillRect(p, -bw + 0.04, s, 0.03);
      g.fillRect(p, n + bw - 0.04 - s, s, 0.03);
      g.fillRect(-bw + 0.04, p, s, 0.03);
      g.fillRect(n + bw - 0.04 - s, p, s, 0.03);
    }
    g.fillStyle = bs.slab;
    g.fillRect(-0.12, -0.12, n + 0.24, n + 0.24);
    if (bs.kind === 'harbour') {
      // Sea glinting between the planks of the pier.
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 0.025;
      g.beginPath();
      for (let k = 0; k < n * 2; k++) {
        const y = hash(k * 7 + n) * n, x = hash(k * 13 + 1) * n;
        g.moveTo(x, y);
        g.lineTo(x + 0.25, y);
      }
      g.stroke();
    }
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) this.cellTile(g, x, y, (x + y) % 2 === 1);
    for (const cell of st.currents.keys()) {
      g.fillStyle = 'rgba(47,119,120,0.22)';
      g.beginPath();
      g.roundRect((cell % n) + 0.04, Math.floor(cell / n) + 0.04, 0.92, 0.92, 0.14);
      g.fill();
    }
    for (const cell of st.stalls) terrace(g, (cell % n) + 0.5, Math.floor(cell / n) + 0.5, this.bs.tess[0]);
    return c;
  }

  /** One cell, in the material of the place. */
  private cellTile(g: CanvasRenderingContext2D, x: number, y: number, alt: boolean) {
    const bs = this.bs;
    const r = (k: number) => hash(x * 131 + y * 71 + k * 17);
    const x0 = x + 0.04, y0 = y + 0.04, w = 0.92;
    g.fillStyle = alt ? bs.cell2 : bs.cell;
    g.beginPath();
    g.roundRect(x0, y0, w, w, bs.kind === 'harbour' ? 0.05 : 0.14);
    g.fill();
    g.save();
    g.clip();
    // A raised tile: light catches its top edge, its bottom edge sits in shade.
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.fillRect(x0, y0, w, 0.04);
    g.fillStyle = 'rgba(40,30,20,0.07)';
    g.fillRect(x0, y0 + w - 0.06, w, 0.06);
    switch (bs.kind) {
      case 'garden': {
        // A lawn: tufts of grass and the odd flower.
        g.strokeStyle = 'rgba(95,148,102,0.35)';
        g.lineWidth = 0.025;
        g.beginPath();
        for (let k = 0; k < 4; k++) {
          const tx = x0 + 0.12 + r(k) * 0.68, ty = y0 + 0.18 + r(k + 9) * 0.65;
          g.moveTo(tx - 0.04, ty);
          g.lineTo(tx - 0.06, ty - 0.07);
          g.moveTo(tx, ty);
          g.lineTo(tx, ty - 0.09);
          g.moveTo(tx + 0.04, ty);
          g.lineTo(tx + 0.06, ty - 0.07);
        }
        g.stroke();
        if (r(20) < 0.3) {
          g.fillStyle = ['#E9788A', '#F4C04E', '#FFFFFF', '#B78BD6'][Math.floor(r(21) * 4)];
          g.beginPath();
          g.arc(x0 + 0.2 + r(22) * 0.55, y0 + 0.2 + r(23) * 0.55, 0.035, 0, Math.PI * 2);
          g.fill();
        }
        break;
      }
      case 'harbour': {
        // Weathered planks with nails.
        g.strokeStyle = 'rgba(120,90,55,0.3)';
        g.lineWidth = 0.02;
        g.beginPath();
        for (let k = 1; k < 3; k++) {
          g.moveTo(x0, y0 + (w * k) / 3);
          g.lineTo(x0 + w, y0 + (w * k) / 3);
        }
        const j = 0.25 + r(1) * 0.5;
        g.moveTo(x0 + w * j, y0);
        g.lineTo(x0 + w * j, y0 + w / 3);
        g.stroke();
        g.fillStyle = 'rgba(110,85,60,0.35)';
        for (let k = 0; k < 3; k++) {
          g.fillRect(x0 + 0.06, y0 + (w * (k + 0.5)) / 3 - 0.015, 0.03, 0.03);
          g.fillRect(x0 + w - 0.09, y0 + (w * (k + 0.5)) / 3 - 0.015, 0.03, 0.03);
        }
        break;
      }
      case 'market': {
        // Glazed tiles with a faint azulejo star.
        g.strokeStyle = alt ? 'rgba(196,85,63,0.16)' : 'rgba(62,124,140,0.16)';
        g.lineWidth = 0.035;
        const cx = x0 + w / 2, cy = y0 + w / 2;
        g.beginPath();
        g.moveTo(cx, cy - 0.22);
        g.lineTo(cx + 0.22, cy);
        g.lineTo(cx, cy + 0.22);
        g.lineTo(cx - 0.22, cy);
        g.closePath();
        for (const [dx, dy] of [[0, 0], [w, 0], [0, w], [w, w]]) {
          g.moveTo(x0 + dx + 0.12, y0 + dy);
          g.arc(x0 + dx, y0 + dy, 0.12, 0, Math.PI * 2);
        }
        g.stroke();
        break;
      }
      case 'night': {
        // Four worn cobbles.
        g.fillStyle = 'rgba(80,70,130,0.08)';
        for (const [dx, dy] of [[0, 0], [0.5, 0], [0, 0.5], [0.5, 0.5]]) {
          g.beginPath();
          g.roundRect(x0 + dx * w + 0.04, y0 + dy * w + 0.04, w / 2 - 0.08, w / 2 - 0.08, 0.1);
          g.fill();
        }
        break;
      }
      case 'deep': {
        // Sand ripples and a pebble.
        g.strokeStyle = 'rgba(47,119,120,0.14)';
        g.lineWidth = 0.025;
        g.beginPath();
        for (let k = 0; k < 3; k++) {
          const yy = y0 + 0.22 + k * 0.25 + r(k) * 0.04;
          g.moveTo(x0, yy);
          g.quadraticCurveTo(x0 + w / 2, yy - 0.08, x0 + w, yy);
        }
        g.stroke();
        if (r(30) < 0.35) {
          g.fillStyle = 'rgba(47,119,120,0.22)';
          g.beginPath();
          g.ellipse(x0 + 0.2 + r(31) * 0.5, y0 + 0.25 + r(32) * 0.5, 0.05, 0.035, 0, 0, Math.PI * 2);
          g.fill();
        }
        break;
      }
    }
    g.restore();
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

    // A canal is a channel dug in the square: a stone edging catching the light on its
    // upper lip and casting a shadow below, a sunken bed, then water that rushes in from
    // the fountain. Edgings first, so separate canals never look joined.
    const wk = this.dense ? 1.14 : 1;
    const stroke = (path: number[], col: string, width: number, dy = 0) => {
      g.save();
      g.translate(0, dy);
      trace(path);
      g.strokeStyle = col;
      g.lineWidth = Math.min(0.8, width * wk);
      g.stroke();
      g.restore();
    };
    const bank = this.bs.bank;
    const bed = shadeHex(this.bs.cell, -0.16);
    st.paths.forEach((path) => {
      if (path.length < 2) return;
      stroke(path, 'rgba(30,20,10,0.22)', 0.66, 0.05);
      stroke(path, shadeHex(bank, 0.28), 0.62, -0.025);
      stroke(path, bank, 0.6);
    });
    st.paths.forEach((path, k) => {
      if (path.length < 2) return;
      const col = colorOf(st.pathColor(k));
      const flow = this.flow.get(path[0] * 1000 + path[path.length - 1]) ?? 0;
      // The sunken bed: shadowed under its upper edge, with the canal's colour as a guide.
      stroke(path, shadeHex(bed, -0.12), 0.42, -0.02);
      stroke(path, bed, 0.4, 0.01);
      stroke(path, col, 0.12);
      if (flow > 0) {
        // Water always flows from the fountain, whichever end the canal was drawn from.
        const water = st.endpointAt(path[0])?.kind === 'workshop' ? path.slice().reverse() : path;
        const len = water.length - 1;
        g.setLineDash([len * flow + 0.001, len + 1]);
        g.lineDashOffset = 0;
        stroke(water, col, 0.4);
        // Light on the surface: a paler band along the upper bank.
        g.save();
        g.globalAlpha *= 0.45;
        stroke(water, shadeHex(col, 0.45), 0.1, -0.08);
        g.restore();
        g.setLineDash([]);
        if (flow < 1) {
          // Foamy water front.
          const pos = flow * len;
          const i0 = Math.floor(pos);
          const f = pos - i0;
          const [ax, ay] = this.center(water[i0], n);
          const [bx, by] = this.center(water[Math.min(len, i0 + 1)], n);
          g.fillStyle = 'rgba(255,255,255,0.8)';
          g.beginPath();
          g.arc(ax + (bx - ax) * f, ay + (by - ay) * f, 0.14, 0, Math.PI * 2);
          g.fill();
        } else {
          // Ripples drifting downstream, and a few glints of sun.
          g.save();
          g.setLineDash([0.08, 0.42]);
          g.lineDashOffset = -this.time * 1.1;
          stroke(water, 'rgba(255,255,255,0.4)', 0.05, 0.06);
          g.lineDashOffset = -this.time * 0.8 - 0.21;
          stroke(water, 'rgba(255,255,255,0.25)', 0.04, -0.05);
          g.restore();
          const gl = (this.time * 0.35 + k * 0.29) % 1;
          if (gl < 0.25) {
            const at = water[Math.floor((k * 7 + Math.floor(this.time * 0.35)) % water.length)];
            const [gx, gy] = this.center(at, n);
            const a = Math.sin((gl / 0.25) * Math.PI);
            g.fillStyle = `rgba(255,255,255,${0.8 * a})`;
            g.beginPath();
            g.arc(gx + 0.08, gy - 0.05, 0.04 + 0.03 * a, 0, Math.PI * 2);
            g.fill();
          }
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

  /** Bridges (with the crossing canal redrawn on top), lanterns and currents. */
  private drawFeatures(st: PuzzleState) {
    const g = this.g;
    const n = st.n;
    if (st.bridges.size) {
      const lanes = st.bridgeLanes();
      for (const b of st.bridges) {
        const x = b % n, y = Math.floor(b / n);
        // An aqueduct: a stone deck carrying the horizontal canal over the vertical one.
        g.fillStyle = 'rgba(0,0,0,0.22)';
        g.fillRect(x - 0.02, y + 0.76, 1.04, 0.08);
        g.fillStyle = this.bs.stone;
        g.fillRect(x - 0.02, y + 0.2, 1.04, 0.58);
        g.fillStyle = 'rgba(0,0,0,0.16)';
        g.fillRect(x - 0.02, y + 0.2, 1.04, 0.07);
        g.fillRect(x - 0.02, y + 0.71, 1.04, 0.07);
        g.strokeStyle = 'rgba(0,0,0,0.12)';
        g.lineWidth = 0.02;
        g.beginPath();
        for (let k = 1; k < 4; k++) {
          g.moveTo(x + k / 4, y + 0.27);
          g.lineTo(x + k / 4, y + 0.71);
        }
        g.stroke();
        const k = lanes.get(b)!.h;
        if (k >= 0) {
          const path = st.paths[k];
          const col = colorOf(st.pathColor(k));
          const wet = (this.flow.get(path[0] * 1000 + path[path.length - 1]) ?? 0) > 0;
          g.lineCap = 'butt';
          g.strokeStyle = col;
          g.globalAlpha = wet ? 1 : 0.45;
          g.lineWidth = wet ? 0.36 : 0.3;
          g.beginPath();
          g.moveTo(x, y + 0.5);
          g.lineTo(x + 1, y + 0.5);
          g.stroke();
          g.globalAlpha = 1;
          g.lineCap = 'round';
        }
      }
    }
    for (const [cell, pair] of st.lanterns) {
      const x = (cell % n) + 0.5, y = Math.floor(cell / n) + 0.5;
      const hue = st.level.pairs[pair].hue;
      const col = colorOf(hue);
      const k = st.owner[cell];
      const lit = k >= 0 && st.pathColor(k) === hue;
      if (lit) {
        const glow = g.createRadialGradient(x, y, 0.05, x, y, 0.75);
        glow.addColorStop(0, 'rgba(255,226,150,0.65)');
        glow.addColorStop(1, 'rgba(255,226,150,0)');
        g.fillStyle = glow;
        g.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
      }
      // A little hanging lantern: dark frame, glass in the canal's colour.
      g.fillStyle = 'rgba(0,0,0,0.2)';
      g.beginPath();
      g.ellipse(x + 0.02, y + 0.24, 0.14, 0.05, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#2A2440';
      g.beginPath();
      g.moveTo(x, y - 0.3);
      g.lineTo(x + 0.17, y - 0.12);
      g.lineTo(x + 0.13, y + 0.2);
      g.lineTo(x - 0.13, y + 0.2);
      g.lineTo(x - 0.17, y - 0.12);
      g.closePath();
      g.fill();
      g.fillStyle = lit ? '#FFE9A8' : col;
      g.beginPath();
      g.moveTo(x, y - 0.2);
      g.lineTo(x + 0.11, y - 0.09);
      g.lineTo(x + 0.08, y + 0.14);
      g.lineTo(x - 0.08, y + 0.14);
      g.lineTo(x - 0.11, y - 0.09);
      g.closePath();
      g.fill();
      if (lit) {
        g.strokeStyle = col;
        g.lineWidth = 0.04;
        g.stroke();
      }
    }
    for (const [cell, dir] of st.currents) {
      const x = (cell % n) + 0.5, y = Math.floor(cell / n) + 0.5;
      const ang = dir === 1 ? 0 : dir === -1 ? Math.PI : dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      g.save();
      g.translate(x, y);
      g.rotate(ang);
      // Two chevrons, swaying gently with the current.
      const t = Math.sin(this.time * 2.4) * 0.05;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      for (const u of [-0.1 + t, 0.12 + t]) {
        g.beginPath();
        g.moveTo(u - 0.11, -0.15);
        g.lineTo(u + 0.04, 0);
        g.lineTo(u - 0.11, 0.15);
        g.strokeStyle = 'rgba(16,52,63,0.55)';
        g.lineWidth = 0.13;
        g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.95)';
        g.lineWidth = 0.065;
        g.stroke();
      }
      g.restore();
    }
  }

  /**
   * Who travels the finished canals depends on the place: ducks in the garden, a little
   * fishing boat at the harbour, a gondola loaded with fruit at the market, a gondola and
   * its lantern at night, a fish in the sunken city. Seen from above, heading `ang`.
   */
  private drawBoat(x: number, y: number, ang: number, accent: string) {
    const g = this.g;
    const kind = this.bs.kind;
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    const ellipse = (cx: number, cy: number, rx: number, ry: number, col: string) => {
      g.fillStyle = col;
      g.beginPath();
      g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
    };
    // A soft wake opening behind it.
    if (kind !== 'deep') {
      g.strokeStyle = 'rgba(255,255,255,0.45)';
      g.lineWidth = 0.025;
      g.beginPath();
      g.moveTo(-0.18, -0.05);
      g.lineTo(-0.36, -0.12);
      g.moveTo(-0.18, 0.05);
      g.lineTo(-0.36, 0.12);
      g.stroke();
    }
    switch (kind) {
      case 'garden': {
        // A duck and its duckling.
        for (const [dx, s] of [[0.06, 1], [-0.2, 0.6]] as [number, number][]) {
          ellipse(dx, 0.02 * s, 0.11 * s, 0.075 * s, 'rgba(0,0,0,0.15)');
          ellipse(dx, 0, 0.11 * s, 0.07 * s, s === 1 ? '#FBF6EC' : '#F4D35E');
          ellipse(dx + 0.09 * s, 0, 0.045 * s, 0.045 * s, s === 1 ? '#FBF6EC' : '#F2C12E');
          ellipse(dx + 0.14 * s, 0, 0.025 * s, 0.015 * s, '#F2A93B');
        }
        break;
      }
      case 'harbour': {
        // A small fishing boat: white hull with a coloured stripe, a wheelhouse, a mast.
        ellipse(0.02, 0.04, 0.24, 0.09, 'rgba(0,0,0,0.18)');
        g.fillStyle = '#FBF6EE';
        g.beginPath();
        g.moveTo(0.26, 0);
        g.quadraticCurveTo(0.14, -0.1, -0.2, -0.085);
        g.lineTo(-0.2, 0.085);
        g.quadraticCurveTo(0.14, 0.1, 0.26, 0);
        g.fill();
        g.strokeStyle = accent;
        g.lineWidth = 0.025;
        g.stroke();
        g.fillStyle = '#B98A5A';
        g.fillRect(-0.16, -0.055, 0.2, 0.11);
        g.fillStyle = accent;
        g.fillRect(-0.12, -0.045, 0.09, 0.09);
        g.fillStyle = '#4E4A46';
        g.beginPath();
        g.arc(0.1, 0, 0.022, 0, Math.PI * 2);
        g.fill();
        break;
      }
      case 'market':
      case 'night': {
        // A gondola: long black hull with its curled prow, the gondolier at the stern.
        ellipse(0.02, 0.04, 0.27, 0.08, 'rgba(0,0,0,0.2)');
        g.fillStyle = '#2E2A2E';
        g.beginPath();
        g.moveTo(0.3, -0.01);
        g.quadraticCurveTo(0.1, -0.09, -0.26, -0.05);
        g.lineTo(-0.28, 0);
        g.lineTo(-0.26, 0.05);
        g.quadraticCurveTo(0.1, 0.09, 0.3, 0.01);
        g.fill();
        g.fillStyle = '#C9A25E';
        g.fillRect(0.24, -0.02, 0.06, 0.04);
        if (kind === 'market') {
          // Crates of fruit in the canal's colour.
          for (const [cx, col] of [[0.1, accent], [-0.02, '#F2A93B'], [-0.13, accent]] as [number, string][]) {
            g.fillStyle = '#C89A64';
            g.fillRect(cx - 0.05, -0.045, 0.1, 0.09);
            ellipse(cx, 0, 0.032, 0.032, col);
          }
        } else {
          // Its lantern lights the water around it.
          const glow = g.createRadialGradient(0.18, 0, 0.01, 0.18, 0, 0.42);
          glow.addColorStop(0, 'rgba(255,214,130,0.55)');
          glow.addColorStop(1, 'rgba(255,214,130,0)');
          g.fillStyle = glow;
          g.fillRect(-0.24, -0.42, 0.84, 0.84);
          ellipse(0.18, 0, 0.03, 0.03, '#FFE3A1');
          ellipse(-0.04, 0, 0.06, 0.05, accent);
        }
        ellipse(-0.2, 0, 0.04, 0.04, '#F1D2B8');
        break;
      }
      default: {
        // A fish, its tail beating.
        const wag = Math.sin(this.time * 8 + x) * 0.04;
        g.fillStyle = accent;
        g.beginPath();
        g.ellipse(0, 0, 0.16, 0.08, 0, 0, Math.PI * 2);
        g.moveTo(-0.14, 0);
        g.lineTo(-0.27, -0.08 + wag);
        g.lineTo(-0.27, 0.08 + wag);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.beginPath();
        g.arc(0.08, -0.02, 0.022, 0, Math.PI * 2);
        g.fill();
      }
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

  /**
   * Endpoints are things of the place, seen from above: every canal leaves a fountain
   * (round) and feeds a building of the place (square): a cottage, a boathouse, a market
   * stall, a lit house, a giant shell. Colour always comes first, shape second.
   */
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
      if (e.kind === 'fountain') this.fountain(x, y, col, done, e.cell);
      else this.building(x, y, col, done);
      if (this.colorblind || e.kind === 'fountain') {
        g.fillStyle = 'rgba(255,255,255,0.95)';
        drawGlyph(g, glyph, x, y + (e.kind === 'fountain' ? 0 : 0.04), this.dense ? 0.12 : 0.09);
      }
    }
  }

  /** A round stone basin filled with the canal's colour, rippling until it is linked. */
  private fountain(x: number, y: number, col: string, done: boolean, seed: number) {
    const g = this.g;
    const kind = this.bs.kind;
    const R = this.dense ? 0.43 : 0.38, r = this.dense ? 0.32 : 0.27;
    g.fillStyle = 'rgba(0,0,0,0.16)';
    g.beginPath();
    g.arc(x + 0.02, y + 0.06, R, 0, Math.PI * 2);
    g.fill();
    // The rim says where we are; the water inside is always the canal's colour.
    const ring = (n: number, a: string, b: string) => {
      for (let k = 0; k < n; k++) {
        g.fillStyle = k % 2 ? b : a;
        g.beginPath();
        g.arc(x, y, R, (k / n) * Math.PI * 2, ((k + 1) / n) * Math.PI * 2);
        g.arc(x, y, r, ((k + 1) / n) * Math.PI * 2, (k / n) * Math.PI * 2, true);
        g.closePath();
        g.fill();
      }
    };
    switch (kind) {
      case 'garden': {
        // A mossy stone basin with flowers at its foot.
        ring(10, this.bs.stone, shadeHex('#DDD2BC', -0.06));
        const fl = ['#E9788A', '#F4C04E', '#FFFFFF'];
        for (let k = 0; k < 3; k++) {
          const a = 0.6 + k * 2.1;
          g.fillStyle = '#7FB07A';
          g.beginPath();
          g.arc(x + Math.cos(a) * R, y + Math.sin(a) * R, 0.07, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = fl[k];
          g.beginPath();
          g.arc(x + Math.cos(a) * R, y + Math.sin(a) * R, 0.035, 0, Math.PI * 2);
          g.fill();
        }
        break;
      }
      case 'harbour': {
        // A coil of mooring rope around the basin: the harbour's own spring.
        ring(1, '#D9BF8C', '#D9BF8C');
        g.strokeStyle = '#A88A5C';
        g.lineWidth = 0.025;
        g.beginPath();
        for (let k = 0; k < 22; k++) {
          const a = (k / 22) * Math.PI * 2;
          g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
          g.lineTo(x + Math.cos(a + 0.22) * R, y + Math.sin(a + 0.22) * R);
        }
        g.stroke();
        g.beginPath();
        g.arc(x, y, (R + r) / 2, 0, Math.PI * 2);
        g.strokeStyle = 'rgba(120,95,60,0.35)';
        g.stroke();
        break;
      }
      case 'market': {
        // A cream stone rim inlaid with small blue tiles (unlike the striped parasols).
        ring(1, '#F3E3CB', '#F3E3CB');
        g.fillStyle = '#3E7C8C';
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2;
          const cx = x + Math.cos(a) * 0.325, cy = y + Math.sin(a) * 0.325;
          g.beginPath();
          g.moveTo(cx, cy - 0.035);
          g.lineTo(cx + 0.035, cy);
          g.lineTo(cx, cy + 0.035);
          g.lineTo(cx - 0.035, cy);
          g.fill();
        }
        break;
      }
      case 'night': {
        ring(10, this.bs.stone, shadeHex('#BDB7D6', -0.08));
        // Four little candles on the rim.
        for (let k = 0; k < 4; k++) {
          const a = Math.PI / 4 + (k * Math.PI) / 2;
          const cx = x + Math.cos(a) * (R - 0.05), cy = y + Math.sin(a) * (R - 0.05);
          const fl = 0.7 + 0.3 * Math.sin(this.time * 9 + k * 2 + seed);
          g.fillStyle = `rgba(255,214,130,${0.35 * fl})`;
          g.beginPath();
          g.arc(cx, cy, 0.1, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = '#FFE9A8';
          g.beginPath();
          g.arc(cx, cy, 0.035, 0, Math.PI * 2);
          g.fill();
        }
        break;
      }
      case 'deep':
        // The mouth of a great terracotta amphora.
        ring(1, '#C9825F', '#C9825F');
        g.strokeStyle = '#A9643F';
        g.lineWidth = 0.04;
        g.beginPath();
        g.arc(x, y, R - 0.03, 0, Math.PI * 2);
        g.stroke();
        break;
    }
    g.fillStyle = col;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.beginPath();
    g.ellipse(x - 0.08, y - 0.1, 0.09, 0.045, -0.5, 0, Math.PI * 2);
    g.fill();
    // The spring: droplets leaping from the centre (bubbles rising in the sunken city).
    const t0 = this.time * 1.3 + seed * 0.37;
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (let k = 0; k < 6; k++) {
      const u = (t0 + k / 6) % 1;
      const a = (k / 6) * Math.PI * 2 + seed;
      const d = kind === 'deep' ? 0.04 : 0.05 + u * 0.16;
      const yy = kind === 'deep' ? y - u * 0.22 : y + Math.sin(a) * d - Math.sin(u * Math.PI) * 0.06;
      g.globalAlpha = (1 - u) * 0.9;
      g.beginPath();
      g.arc(x + Math.cos(a) * d, yy, kind === 'deep' ? 0.025 + u * 0.02 : 0.025, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    if (!done) {
      const t = (this.time * 0.7 + seed * 0.13) % 1;
      g.save();
      g.strokeStyle = 'rgba(255,255,255,0.6)';
      g.lineWidth = 0.03;
      g.globalAlpha *= 1 - t;
      g.beginPath();
      g.arc(x, y, 0.1 + t * 0.15, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
  }

  /** The building a canal feeds, in the style of the place. */
  private building(x: number, y: number, col: string, done: boolean) {
    const g = this.g;
    const h = this.dense ? 0.38 : 0.33;
    const kind = this.bs.kind;
    // Night: warm light pooling around the houses (stronger once water arrives).
    if (kind === 'night') {
      const r = done ? 0.75 : 0.55;
      const glow = g.createRadialGradient(x, y, 0.1, x, y, r);
      glow.addColorStop(0, `rgba(255,214,130,${done ? 0.5 : 0.3})`);
      glow.addColorStop(1, 'rgba(255,214,130,0)');
      g.fillStyle = glow;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.beginPath();
    if (kind === 'deep') g.ellipse(x + 0.03, y + 0.3, 0.3, 0.08, 0, 0, Math.PI * 2);
    else g.roundRect(x - h + 0.03, y - h + 0.07, h * 2, h * 2, 0.08);
    g.fill();
    switch (kind) {
      case 'market': {
        // A stall's striped awning, with a scalloped front edge.
        const st = 5;
        for (let k = 0; k < st; k++) {
          g.fillStyle = k % 2 ? '#FBF1E1' : col;
          g.fillRect(x - h + (k * h * 2) / st, y - h, (h * 2) / st + 0.005, h * 1.75);
        }
        for (let k = 0; k < st; k++) {
          g.fillStyle = k % 2 ? '#EADFCB' : shadeHex(col, -0.15);
          g.beginPath();
          g.arc(x - h + ((k + 0.5) * h * 2) / st, y + h * 0.75, h / st, 0, Math.PI);
          g.fill();
        }
        break;
      }
      case 'deep': {
        // A scallop shell: ribs fanning out from the hinge.
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(x, y + h);
        g.arc(x, y + h * 0.1, h * 1.05, Math.PI * 1.08, Math.PI * 1.92);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.45)';
        g.lineWidth = 0.025;
        g.beginPath();
        for (let k = 1; k < 6; k++) {
          const a = Math.PI * (1.08 + (0.84 * k) / 6);
          g.moveTo(x, y + h);
          g.lineTo(x + Math.cos(a) * h * 1.05, y + h * 0.1 + Math.sin(a) * h * 1.05);
        }
        g.stroke();
        g.fillStyle = shadeHex(col, -0.2);
        g.fillRect(x - 0.08, y + h - 0.08, 0.16, 0.1);
        break;
      }
      default: {
        // A little house seen from above and slightly in front, like a toy on the board:
        // its front wall (door, lit window at night), then the tiled roof over it.
        const wall = kind === 'night' ? '#8E86B5' : '#F3E8D6';
        const top = y - h - 0.06, ridge = top + h * 0.95, eaves = y + h * 0.62;
        g.fillStyle = wall;
        g.fillRect(x - h + 0.03, eaves - 0.02, h * 2 - 0.06, 0.28);
        g.fillStyle = 'rgba(0,0,0,0.12)';
        g.fillRect(x - h + 0.03, eaves - 0.02, h * 2 - 0.06, 0.05);
        g.fillStyle = shadeHex(col, -0.35);
        g.beginPath();
        g.roundRect(x - 0.06, eaves + 0.08, 0.12, 0.18, [0.06, 0.06, 0, 0]);
        g.fill();
        g.fillStyle = kind === 'night' ? (done ? '#FFE3A1' : '#C9B97A') : 'rgba(60,70,80,0.55)';
        g.fillRect(x + 0.12, eaves + 0.08, 0.09, 0.08);
        g.fillRect(x - 0.21, eaves + 0.08, 0.09, 0.08);
        // Roof: the far slope in light, the near slope in shade, tile rows, the ridge.
        g.fillStyle = shadeHex(col, 0.14);
        g.beginPath();
        g.roundRect(x - h - 0.02, top, h * 2 + 0.04, ridge - top, [0.08, 0.08, 0, 0]);
        g.fill();
        g.fillStyle = shadeHex(col, -0.1);
        g.beginPath();
        g.roundRect(x - h - 0.02, ridge, h * 2 + 0.04, eaves - ridge, [0, 0, 0.05, 0.05]);
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.13)';
        g.lineWidth = 0.02;
        g.beginPath();
        for (const u of [0.33, 0.66]) {
          g.moveTo(x - h + 0.02, top + (ridge - top) * u);
          g.lineTo(x + h - 0.02, top + (ridge - top) * u);
          g.moveTo(x - h + 0.02, ridge + (eaves - ridge) * u);
          g.lineTo(x + h - 0.02, ridge + (eaves - ridge) * u);
        }
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.45)';
        g.fillRect(x - h - 0.02, ridge - 0.015, h * 2 + 0.04, 0.03);
        // Chimney.
        g.fillStyle = kind === 'night' ? '#3A3468' : '#9C8574';
        g.fillRect(x + h * 0.45, top + 0.02, 0.09, 0.12);
        if (kind === 'harbour') {
          // The little pier the boathouse opens onto.
          g.fillStyle = '#B79572';
          g.fillRect(x - 0.08, eaves + 0.26, 0.16, 0.1);
        }
      }
    }
    if (done) {
      // Water has arrived: a small sparkle above the building.
      const t = (this.time * 1.5) % 2;
      const a = Math.max(0, 1 - Math.abs(t - 0.5) * 2);
      g.fillStyle = `rgba(255,255,255,${0.35 + 0.6 * a})`;
      g.beginPath();
      const sx = x - h * 0.55, sy = y - h * 0.55, r = 0.09;
      g.moveTo(sx, sy - r);
      g.lineTo(sx + r * 0.3, sy - r * 0.3);
      g.lineTo(sx + r, sy);
      g.lineTo(sx + r * 0.3, sy + r * 0.3);
      g.lineTo(sx, sy + r);
      g.lineTo(sx - r * 0.3, sy + r * 0.3);
      g.lineTo(sx - r, sy);
      g.lineTo(sx - r * 0.3, sy - r * 0.3);
      g.fill();
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

/** Lightens (k > 0) or darkens (k < 0) a #rrggbb colour. */
function shadeHex(hex: string, k: number): string {
  const v = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.round(k >= 0 ? c + (255 - c) * k : c * (1 + k));
  return `rgb(${f((v >> 16) & 255)},${f((v >> 8) & 255)},${f(v & 255)})`;
}

/** A café terrace seen from above: a round parasol over a little table and chairs. */
function terrace(g: CanvasRenderingContext2D, x: number, y: number, accent: string) {
  g.fillStyle = 'rgba(0,0,0,0.16)';
  g.beginPath();
  g.arc(x + 0.04, y + 0.07, 0.36, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#9C8574';
  for (const [dx, dy] of [[-0.33, 0], [0.33, 0], [0, -0.33], [0, 0.33]]) g.fillRect(x + dx - 0.06, y + dy - 0.06, 0.12, 0.12);
  const k = 8;
  for (let i = 0; i < k; i++) {
    g.fillStyle = i % 2 ? '#FBF4E8' : accent;
    g.beginPath();
    g.moveTo(x, y);
    g.arc(x, y, 0.32, (i / k) * Math.PI * 2, ((i + 1) / k) * Math.PI * 2);
    g.closePath();
    g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,0.8)';
  g.beginPath();
  g.arc(x, y, 0.04, 0, Math.PI * 2);
  g.fill();
}
