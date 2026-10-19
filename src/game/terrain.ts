import { Rng } from '../core/rng';
import type { TerrainStyle } from './content';

export const enum T {
  Land = 0,
  Water = 1,
  Rock = 2,
}

/** Procedurally builds a terrain map. The central start area is always kept as land. */
export function generateTerrain(style: TerrainStyle, w: number, h: number, rng: Rng): Uint8Array {
  const t = new Uint8Array(w * h);
  const set = (x: number, y: number, v: T) => {
    if (x >= 0 && y >= 0 && x < w && y < h) t[y * w + x] = v;
  };
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);

  switch (style) {
    case 'coast': {
      // A wavy shoreline along the bottom and a small lake/inlet near the middle.
      let depth = 2;
      for (let x = 0; x < w; x++) {
        depth = Math.max(1, Math.min(3, depth + rng.int(-1, 2)));
        for (let y = h - depth; y < h; y++) set(x, y, T.Water);
      }
      const lx = rng.int(1, w - 3);
      const ly = rng.int(cy - 4, cy - 2);
      set(lx, ly, T.Water);
      set(lx + 1, ly, T.Water);
      if (rng.next() < 0.6) set(lx + 1, ly + 1, T.Water);
      for (let i = 0; i < 3; i++) set(rng.int(0, w), rng.int(0, 3), T.Rock);
      break;
    }
    case 'peaks': {
      for (let c = 0; c < 7; c++) {
        let x = rng.int(0, w);
        let y = rng.int(0, h);
        const n = rng.int(2, 5);
        for (let k = 0; k < n; k++) {
          set(x, y, T.Rock);
          if (rng.next() < 0.5) x += rng.pick([-1, 1]);
          else y += rng.pick([-1, 1]);
        }
      }
      break;
    }
    case 'delta': {
      // Main river flowing top to bottom, meandering, plus a tributary.
      let x = rng.int(cx - 1, cx + 2);
      for (let y = 0; y < h; y++) {
        set(x, y, T.Water);
        if (y > 1 && rng.next() < 0.35) {
          const nx = Math.max(1, Math.min(w - 2, x + rng.pick([-1, 1])));
          set(nx, y, T.Water);
          x = nx;
        }
      }
      const ty = rng.int(cy + 2, h - 2);
      const left = rng.next() < 0.5;
      for (let k = 0; k < w; k++) {
        const xx = left ? k : w - 1 - k;
        if (t[ty * w + xx] === T.Water) break;
        set(xx, ty, T.Water);
      }
      break;
    }
    case 'archipelago': {
      for (let b = 0; b < 6; b++) {
        const bx = rng.int(0, w);
        const by = rng.int(0, h);
        const r = rng.range(0.8, 1.9);
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) if (Math.hypot(x - bx, (y - by) * 0.9) < r) set(x, y, T.Water);
      }
      break;
    }
  }

  // Keep the opening area playable.
  for (let y = cy - 2; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) if (style !== 'delta' || t[y * w + x] !== T.Water) set(x, y, T.Land);
  if (style === 'delta') {
    // The river may cross the opening area; that is the point of the district, but leave land on both banks.
    for (let y = cy - 2; y <= cy + 1; y++) {
      set(cx - 2, y, T.Land);
      set(cx + 2, y, T.Land);
    }
  }
  return t;
}
