/**
 * Frescoes: pixel mosaics completed tile by tile with everything the player delivers.
 * Inspired by colour-by-number apps (an image you want to finish) and kept in our world:
 * every delivered tessera lands in the current fresco, run after run.
 * Legend: r clay, b slate, g jade, y saffron, p plum, . grout (always laid).
 */

export interface Fresco {
  id: string;
  rows: string[];
}

export const FRESCOES: readonly Fresco[] = [
  {
    id: 'sunset',
    rows: [
      '............',
      '....rrrr....',
      '...rrrrrr...',
      '..rrrrrrrr..',
      '..rrrrrrrr..',
      '..rrrrrrrr..',
      'bbbbbbbbbbbb',
      '.bbb..bbbb..',
      'bbbbbbbbbbbb',
      '..bbbb..bbb.',
      'bbbbbbbbbbbb',
      '............',
    ],
  },
  {
    id: 'whale',
    rows: [
      '..............',
      '.....b..b.....',
      '......bb......',
      '.......b......',
      '...bbbbbbbb...',
      '..bbbbbbbbbb..',
      '.bbb.bbbbbbbb.',
      '.bbbbbbbbbbbbb',
      '.rrrrrrrbbbb.b',
      '..rrrrrrbbb...',
      '...........bb.',
      'gg..gg..gg..gg',
      'gggggggggggggg',
      '..............',
    ],
  },
  {
    id: 'fox',
    rows: [
      '..............',
      '.r..........r.',
      '.rr........rr.',
      '.rrr......rrr.',
      '.rrrrrrrrrrrr.',
      'rrrrrrrrrrrrrr',
      'rrbbrrrrrrbbrr',
      'rrrrrrrrrrrrrr',
      '.rr..rrrr..rr.',
      '..r...rr...r..',
      '...r..bb..r...',
      '....r....r....',
      '.....rrrr.....',
      'gggggggggggggg',
    ],
  },
  {
    id: 'lighthouse',
    rows: [
      '................',
      'yy.....pp.....yy',
      '..yy..pppp..yy..',
      '....yyyyyyyy....',
      '..yy..pppp..yy..',
      'yy.....rr.....yy',
      '......rrrr......',
      '......pppp......',
      '......rrrr......',
      '.....rrrrrr.....',
      '.....pppppp.....',
      '.....rrrrrr.....',
      '....gggggggg....',
      'bb.gggggggggg.bb',
      'bbbbbbbbbbbbbbbb',
      '.bbbbb.bbbbbb.bb',
    ],
  },
  {
    id: 'koi',
    rows: [
      '................',
      '..gg........bb..',
      '.gggg..........b',
      '.gggg...........',
      '..gg.....rr.....',
      '........rrry....',
      '.......ryrrrr...',
      '......rrrryyr...',
      '.....yrrrrrry...',
      '....yyrrrrr.....',
      '...yyyrr........',
      '..y.yyy.....gg..',
      '..yy.......gggg.',
      'b..........gggg.',
      '.b..bb......gg..',
      '................',
    ],
  },
];

const CODE: Record<string, number> = { r: 0, b: 1, g: 2, y: 3, p: 4 };

export interface FrescoCell {
  x: number;
  y: number;
  /** Material id, or -1 for grout. */
  c: number;
}

const cache = new Map<string, FrescoCell[]>();

/**
 * Cells in the order they are laid: from the centre outwards with a little jitter,
 * so the picture emerges like a real mosaic being set.
 */
export function frescoCells(f: Fresco): FrescoCell[] {
  const hit = cache.get(f.id);
  if (hit) return hit;
  const n = f.rows.length;
  const c = (n - 1) / 2;
  const cells: (FrescoCell & { d: number })[] = [];
  let seed = 7;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < f.rows[y].length; x++) {
      seed = (seed * 16807) % 2147483647;
      const ch = f.rows[y][x];
      cells.push({ x, y, c: ch in CODE ? CODE[ch] : -1, d: Math.hypot(x - c, y - c) + (seed / 2147483647) * 2.2 });
    }
  const res = cells.sort((a, b) => a.d - b.d).map(({ x, y, c }) => ({ x, y, c }));
  cache.set(f.id, res);
  return res;
}

export function frescoNeeds(f: Fresco): number[] {
  const need = [0, 0, 0, 0, 0];
  for (const cell of frescoCells(f)) if (cell.c >= 0) need[cell.c]++;
  return need;
}

/** Share of the coloured cells already laid, 0..1. */
export function frescoProgress(f: Fresco, filled: number[]): number {
  const need = frescoNeeds(f);
  const total = need.reduce((a, b) => a + b, 0);
  const done = need.reduce((a, n, i) => a + Math.min(n, filled[i] ?? 0), 0);
  return total ? done / total : 1;
}

export function frescoById(id: string): Fresco | undefined {
  return FRESCOES.find((f) => f.id === id);
}
