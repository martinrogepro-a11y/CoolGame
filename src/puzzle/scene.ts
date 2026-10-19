import { Rng } from '../core/rng';

/**
 * Living backdrop around the puzzle board, Townscaper-style: a row of colourful houses on a
 * quay, a lagoon with moored boats, and per-chapter moods (garden, harbour, market, night,
 * sunken city). The board itself stays flat and top-down so the puzzle remains readable;
 * the scene only frames it. Static parts are cached in an offscreen canvas.
 */

export type ThemeId = 'garden' | 'harbour' | 'market' | 'night' | 'deep';

interface Theme {
  sky: [string, string];
  water: [string, string];
  quay: string;
  facades: string[];
  roofs: string[];
  window: string;
  lit: boolean;
  stars: boolean;
  trees: boolean;
  awnings: boolean;
  underwater: boolean;
  shimmer: string;
  boat: string;
  /** Height of the skyline relative to the space available (garden: low cottages). */
  height: number;
}

const THEMES: Record<ThemeId, Theme> = {
  garden: {
    sky: ['#F4ECDC', '#E6EEDB'], water: ['#BCD9D0', '#A8CCC2'], quay: '#D9CCB4',
    facades: ['#F3E3C3', '#E9C9A8', '#CFE0C3', '#F1D6C6', '#E4D7B8'], roofs: ['#B7684B', '#8E5A44', '#6E8B5A'],
    window: '#7C8C8E', lit: false, stars: false, trees: true, awnings: false, underwater: false, shimmer: 'rgba(255,255,255,0.5)', boat: '#F7F1E6', height: 0.55,
  },
  harbour: {
    sky: ['#F7EADB', '#DCEBF0'], water: ['#8FC3D1', '#6FAFC2'], quay: '#CFC0A5',
    facades: ['#E07A5F', '#F2CC8F', '#81B29A', '#5B8FC7', '#E5989B', '#F4A261', '#B5838D'], roofs: ['#8F4636', '#6B3A2E'],
    window: '#40505E', lit: false, stars: false, trees: false, awnings: false, underwater: false, shimmer: 'rgba(255,255,255,0.55)', boat: '#FBF6EC', height: 1,
  },
  market: {
    sky: ['#F8E4C7', '#F1D6AE'], water: ['#A6C8BE', '#8DB8AC'], quay: '#D6B98F',
    facades: ['#E8B56B', '#D98E5B', '#C9744F', '#EBCB8B', '#D4A373'], roofs: ['#9C4A2F', '#7E3B26'],
    window: '#5B4636', lit: false, stars: false, trees: false, awnings: true, underwater: false, shimmer: 'rgba(255,248,230,0.55)', boat: '#FBF3E4', height: 1,
  },
  night: {
    sky: ['#161B2E', '#2B3352'], water: ['#1E2B45', '#17223A'], quay: '#3A4158',
    facades: ['#3B4466', '#44406A', '#354E66', '#4A4A6A'], roofs: ['#262B44', '#2F2A44'],
    window: '#F6CF7A', lit: true, stars: true, trees: false, awnings: false, underwater: false, shimmer: 'rgba(246,207,122,0.35)', boat: '#D9D3C7', height: 1,
  },
  deep: {
    sky: ['#0E5566', '#06293D'], water: ['#0B4255', '#062436'], quay: '#5E8C8A',
    facades: ['#6F9C98', '#5E8A86', '#7FAAA2'], roofs: ['#4B7471'],
    window: '#9FE3D7', lit: true, stars: false, trees: false, awnings: false, underwater: true, shimmer: 'rgba(170,240,230,0.25)', boat: '#E8D9A8', height: 1,
  },
};

export function boatColor(theme: ThemeId): string {
  return THEMES[theme].boat;
}

export function isUnderwater(theme: ThemeId): boolean {
  return THEMES[theme].underwater;
}

export class Scene {
  theme: ThemeId = 'harbour';
  seed = 1;
  private cache: HTMLCanvasElement | null = null;
  private cacheKey = '';
  private bubbles: { x: number; y: number; r: number; v: number }[] = [];
  private fish: { x: number; y: number; v: number; s: number }[] = [];

  /** Draws the backdrop. `board` is the board rectangle in CSS pixels. */
  draw(g: CanvasRenderingContext2D, w: number, h: number, dpr: number, board: { x: number; y: number; size: number }, time: number) {
    const th = THEMES[this.theme];
    const quayY = Math.round(board.y - 18);
    const key = `${this.theme}|${w}|${h}|${quayY}|${Math.round(board.size)}|${this.seed}|${dpr}`;
    if (key !== this.cacheKey) {
      this.cacheKey = key;
      this.cache = this.renderStatic(th, w, h, dpr, quayY, board.y + board.size);
      this.bubbles = [];
      this.fish = [];
    }
    if (this.cache) g.drawImage(this.cache, 0, 0, w, h);

    // Animated layer.
    if (th.underwater) this.drawDeep(g, w, h, time);
    else this.drawWater(g, th, w, h, quayY, time);
    if (th.stars) {
      const rng = new Rng(this.seed * 7 + 3);
      for (let k = 0; k < 40; k++) {
        const x = rng.next() * w, y = rng.next() * Math.max(10, quayY - 120);
        const a = 0.35 + 0.35 * Math.sin(time * (0.8 + rng.next()) + k);
        g.fillStyle = `rgba(255,248,220,${a})`;
        g.fillRect(x, y, 1.6, 1.6);
      }
    }
    // A soft shadow of the board on the water.
    g.fillStyle = th.underwater ? 'rgba(0,10,20,0.35)' : 'rgba(20,40,50,0.18)';
    g.beginPath();
    g.roundRect(board.x - 6, board.y + 10, board.size + 18, board.size + 14, 22);
    g.fill();
  }

  private renderStatic(th: Theme, w: number, h: number, dpr: number, quayY: number, boardBottom: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const rng = new Rng(this.seed);
    if (th.underwater) {
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, th.sky[0]);
      grad.addColorStop(1, th.sky[1]);
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
      // Light rays from the surface.
      for (let k = 0; k < 5; k++) {
        const x = rng.range(-40, w);
        const ray = g.createLinearGradient(0, 0, 0, h * 0.8);
        ray.addColorStop(0, 'rgba(200,255,245,0.14)');
        ray.addColorStop(1, 'rgba(200,255,245,0)');
        g.fillStyle = ray;
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x + 40 + rng.next() * 40, 0);
        g.lineTo(x + 140, h * 0.8);
        g.lineTo(x + 60, h * 0.8);
        g.closePath();
        g.fill();
      }
      this.drawRuins(g, th, w, quayY, rng);
      // Sand floor.
      g.fillStyle = 'rgba(214,196,150,0.18)';
      g.beginPath();
      g.moveTo(0, h);
      for (let x = 0; x <= w; x += 20) g.lineTo(x, h - 50 - Math.sin(x / 50) * 12);
      g.lineTo(w, h);
      g.fill();
      return c;
    }
    const sky = g.createLinearGradient(0, 0, 0, quayY);
    sky.addColorStop(0, th.sky[0]);
    sky.addColorStop(1, th.sky[1]);
    g.fillStyle = sky;
    g.fillRect(0, 0, w, quayY);
    // The moon sits between the top buttons and the rooftops, only when there is room.
    const moonY = quayY - Math.min(140, quayY - 30) - 26;
    if (th.stars && moonY > 120) {
      g.fillStyle = 'rgba(255,244,214,0.9)';
      g.beginPath();
      g.arc(w * 0.72, moonY, 15, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = th.sky[0];
      g.beginPath();
      g.arc(w * 0.72 + 7, moonY - 4, 13, 0, Math.PI * 2);
      g.fill();
    }
    // Water.
    const water = g.createLinearGradient(0, quayY, 0, h);
    water.addColorStop(0, th.water[0]);
    water.addColorStop(1, th.water[1]);
    g.fillStyle = water;
    g.fillRect(0, quayY, w, h - quayY);
    this.drawHouses(g, th, w, quayY, rng);
    // Quay.
    g.fillStyle = th.quay;
    g.fillRect(0, quayY - 4, w, 10);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(0, quayY + 6, w, 3);
    // Reflections of the houses.
    g.globalAlpha = th.lit ? 0.18 : 0.1;
    g.save();
    g.translate(0, quayY * 2 + 12);
    g.scale(1, -0.35);
    this.drawHouses(g, th, w, quayY, new Rng(this.seed));
    g.restore();
    g.globalAlpha = 1;
    // Boats moored in the free water between the board and the bottom buttons.
    const top = boardBottom + 46, bottom = h - 120;
    if (bottom - top > 10)
      for (let k = 0; k < 3; k++) {
        const bx = ((k + 0.5) / 3) * w + rng.range(-30, 30);
        const by = rng.range(top, bottom);
        drawBoatSide(g, bx, by, 26 + rng.next() * 10, th.boat, th.facades[k % th.facades.length]);
      }
    return c;
  }

  /** A row of narrow, colourful houses standing on the quay. */
  private drawHouses(g: CanvasRenderingContext2D, th: Theme, w: number, base: number, rng: Rng) {
    const maxH = Math.max(36, Math.min(140, base - 30) * th.height);
    let x = -10;
    while (x < w + 10) {
      const hw = rng.range(26, 46);
      const hh = rng.range(maxH * 0.45, maxH);
      const facade = th.facades[rng.int(0, th.facades.length)];
      const roof = th.roofs[rng.int(0, th.roofs.length)];
      const top = base - hh;
      if (th.trees && rng.next() < 0.25) {
        // A round tree between houses.
        g.fillStyle = '#7FA36B';
        g.beginPath();
        g.arc(x + hw / 2, base - 22, 16, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#6D5B45';
        g.fillRect(x + hw / 2 - 2, base - 10, 4, 10);
        x += hw * 0.8;
        continue;
      }
      // Body, with a darker side for depth.
      g.fillStyle = facade;
      g.fillRect(x, top, hw, hh);
      g.fillStyle = 'rgba(0,0,0,0.08)';
      g.fillRect(x + hw - 5, top, 5, hh);
      // Roof: gable or flat with a cornice.
      g.fillStyle = roof;
      if (rng.next() < 0.6) {
        g.beginPath();
        g.moveTo(x - 2, top + 1);
        g.lineTo(x + hw / 2, top - hw * 0.45);
        g.lineTo(x + hw + 2, top + 1);
        g.closePath();
        g.fill();
      } else g.fillRect(x - 2, top - 4, hw + 4, 5);
      // Windows.
      const cols = hw > 36 ? 3 : 2;
      const ww = 5, wh = 8;
      const gap = (hw - cols * ww) / (cols + 1);
      for (let wy = top + 10; wy < base - 22; wy += 16)
        for (let cI = 0; cI < cols; cI++) {
          const lit = th.lit && rng.next() < 0.6;
          g.fillStyle = lit ? th.window : th.lit ? 'rgba(10,15,30,0.5)' : th.window;
          g.globalAlpha = th.lit ? 1 : 0.55;
          g.fillRect(x + gap + cI * (ww + gap), wy, ww, wh);
          g.globalAlpha = 1;
        }
      // Door, and sometimes a striped market awning.
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(x + hw / 2 - 4, base - 14, 8, 14);
      if (th.awnings && rng.next() < 0.7) {
        const aw = hw - 6;
        for (let s = 0; s < 5; s++) {
          g.fillStyle = s % 2 ? '#FBF3E4' : th.roofs[0];
          g.fillRect(x + 3 + (s * aw) / 5, base - 24, aw / 5, 7);
        }
      }
      x += hw - 1;
    }
  }

  /** Sunken city: columns, arches and domes as soft silhouettes. */
  private drawRuins(g: CanvasRenderingContext2D, th: Theme, w: number, base: number, rng: Rng) {
    let x = 0;
    while (x < w) {
      const kind = rng.next();
      g.fillStyle = th.facades[rng.int(0, th.facades.length)];
      g.globalAlpha = 0.55;
      if (kind < 0.4) {
        const hh = rng.range(50, Math.min(150, base - 20));
        g.fillRect(x + 6, base - hh, 12, hh);
        g.fillRect(x + 2, base - hh - 6, 20, 6);
        x += 30;
      } else if (kind < 0.75) {
        const aw = rng.range(50, 80);
        const hh = rng.range(40, 90);
        g.beginPath();
        g.moveTo(x, base);
        g.lineTo(x, base - hh);
        g.arc(x + aw / 2, base - hh, aw / 2, Math.PI, 0);
        g.lineTo(x + aw, base);
        g.lineTo(x + aw - 12, base);
        g.lineTo(x + aw - 12, base - hh);
        g.arc(x + aw / 2, base - hh, aw / 2 - 12, 0, Math.PI, true);
        g.lineTo(x + 12, base);
        g.closePath();
        g.fill();
        x += aw + 8;
      } else {
        const r = rng.range(24, 40);
        g.beginPath();
        g.arc(x + r, base - 30, r, Math.PI, 0);
        g.fillRect(x, base - 30, r * 2, 30);
        g.fill();
        x += r * 2 + 10;
      }
      g.globalAlpha = 1;
    }
  }

  private drawWater(g: CanvasRenderingContext2D, th: Theme, w: number, h: number, quayY: number, time: number) {
    g.strokeStyle = th.shimmer;
    g.lineWidth = 1.5;
    g.lineCap = 'round';
    const rng = new Rng(this.seed * 13 + 1);
    g.beginPath();
    for (let k = 0; k < 26; k++) {
      const y = quayY + 16 + rng.next() * (h - quayY - 20);
      const x = ((rng.next() * w + time * (8 + rng.next() * 10)) % (w + 40)) - 20;
      const len = 6 + rng.next() * 14;
      g.moveTo(x, y);
      g.lineTo(x + len, y);
    }
    g.stroke();
  }

  private drawDeep(g: CanvasRenderingContext2D, w: number, h: number, time: number) {
    const rng = new Rng(this.seed * 17 + 5);
    if (this.bubbles.length === 0) for (let k = 0; k < 24; k++) this.bubbles.push({ x: rng.next() * w, y: rng.next() * h, r: 1.5 + rng.next() * 3, v: 10 + rng.next() * 25 });
    if (this.fish.length === 0) for (let k = 0; k < 5; k++) this.fish.push({ x: rng.next() * w, y: 60 + rng.next() * (h - 160), v: (rng.next() < 0.5 ? -1 : 1) * (8 + rng.next() * 14), s: 6 + rng.next() * 6 });
    // Seaweed swaying at the bottom.
    g.strokeStyle = 'rgba(90,170,130,0.45)';
    g.lineWidth = 4;
    g.lineCap = 'round';
    for (let k = 0; k < 10; k++) {
      const bx = (k + 0.5) * (w / 10) + Math.sin(k * 3.1) * 10;
      g.beginPath();
      g.moveTo(bx, h);
      for (let s = 1; s <= 6; s++) g.lineTo(bx + Math.sin(time * 1.2 + k + s * 0.6) * s * 2, h - s * 14);
      g.stroke();
    }
    for (const f of this.fish) {
      f.x += (f.v * 1) / 60;
      if (f.x < -30) f.x = w + 30;
      if (f.x > w + 30) f.x = -30;
      const dir = Math.sign(f.v);
      g.fillStyle = 'rgba(160,230,220,0.35)';
      g.beginPath();
      g.ellipse(f.x, f.y + Math.sin(time + f.y) * 3, f.s, f.s * 0.45, 0, 0, Math.PI * 2);
      g.moveTo(f.x - dir * f.s, f.y);
      g.lineTo(f.x - dir * f.s * 1.7, f.y - f.s * 0.5);
      g.lineTo(f.x - dir * f.s * 1.7, f.y + f.s * 0.5);
      g.fill();
    }
    g.strokeStyle = 'rgba(210,255,250,0.45)';
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

/** A small boat seen from the side, for the moorings. */
function drawBoatSide(g: CanvasRenderingContext2D, x: number, y: number, len: number, hull: string, stripe: string) {
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.beginPath();
  g.ellipse(x, y + 5, len * 0.6, 3, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = hull;
  g.beginPath();
  g.moveTo(x - len / 2, y - 5);
  g.lineTo(x + len / 2, y - 5);
  g.lineTo(x + len / 2 - 6, y + 3);
  g.lineTo(x - len / 2 + 6, y + 3);
  g.closePath();
  g.fill();
  g.fillStyle = stripe;
  g.fillRect(x - len / 2 + 3, y - 3, len - 6, 2.5);
  g.fillStyle = '#6D5B45';
  g.fillRect(x - 1, y - 20, 2, 15);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.beginPath();
  g.moveTo(x + 1, y - 20);
  g.lineTo(x + 11, y - 8);
  g.lineTo(x + 1, y - 8);
  g.closePath();
  g.fill();
}
