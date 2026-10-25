/**
 * A strip of the village drawn across the top of the menu screens (journey, collection,
 * shop, settings), so every screen keeps a sense of place, the way a book keeps its
 * running head. Pure SVG, drawn once from a fixed seed.
 */

const WALLS = ['#F3E8D6', '#EBD9BF', '#F1D7C4', '#E6E0CF', '#F6E2B8', '#E9D3C9'];
const ROOFS = ['#C8573A', '#D9734E', '#B9502F', '#3F7C93', '#C8573A', '#7E9A5E'];

let cached = '';

export function skylineBand(): string {
  if (cached) return cached;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const base = 138;
  let svg = '';
  // Two rows: a paler one behind, the street in front.
  for (const row of [0, 1]) {
    let x = -12 + row * 14;
    while (x < 402) {
      const w = 30 + rnd() * 20;
      const h = (row ? 24 : 34) + rnd() * 18;
      const top = base - h - (row ? 0 : 6);
      const wall = pick(WALLS);
      const roof = pick(ROOFS);
      const peak = 12 + rnd() * 6;
      const op = row ? 1 : 0.55;
      svg += `<g opacity="${op}">`;
      svg += `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${(base - top).toFixed(1)}" fill="${wall}"/>`;
      svg += `<rect x="${(x + w * 0.72).toFixed(1)}" y="${top.toFixed(1)}" width="${(w * 0.28).toFixed(1)}" height="${(base - top).toFixed(1)}" fill="#000" opacity="0.06"/>`;
      svg += `<path d="M${(x - 2).toFixed(1)} ${top.toFixed(1)}L${(x + w / 2).toFixed(1)} ${(top - peak).toFixed(1)}L${(x + w + 2).toFixed(1)} ${top.toFixed(1)}Z" fill="${roof}"/>`;
      if (row) {
        const cols = w > 40 ? 2 : 1;
        for (let r = 0; r < 2; r++)
          for (let c = 0; c < cols; c++) {
            const wx = x + (w / (cols + 1)) * (c + 1) - 3;
            const wy = top + 8 + r * 15;
            if (wy + 9 < base - 4) svg += `<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="6" height="9" rx="3" fill="#5C6B78" opacity="0.55"/>`;
          }
        if (rnd() < 0.3) svg += `<rect x="${(x + w * 0.62).toFixed(1)}" y="${(top - peak + 2).toFixed(1)}" width="5" height="9" fill="#9C8574"/>`;
      }
      svg += '</g>';
      x += w - (row ? 0 : 4);
    }
  }
  cached = `<div class="band" aria-hidden="true"><svg viewBox="0 0 390 152" preserveAspectRatio="xMidYMax slice">
    <defs><linearGradient id="bandSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#CFE4E8"/><stop offset="1" stop-color="#F4EADB"/></linearGradient></defs>
    <rect width="390" height="152" fill="url(#bandSky)"/>${svg}
    <rect y="${base}" width="390" height="14" fill="#E2D5C0"/><rect y="${base}" width="390" height="2" fill="#CDBFA6"/></svg></div>`;
  return cached;
}
