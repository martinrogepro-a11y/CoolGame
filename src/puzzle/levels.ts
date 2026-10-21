import { dayKey, daysBetween, hashString } from '../core/rng';
import { chapterOf, CHAPTERS } from './chapters';
import BUILT from './levels.json';
import { pictureById, pictureColors } from './pictures';
import { assignHues, type Features, generateLevel, type Level, puzzleColors } from './puzzle';

/** Hand-checked layouts (unique solution, graded difficulty) produced by `npm run levels`. */
const built = BUILT as Record<string, { paths: number[][]; nodes: number; f?: Features } | undefined>;
const cache = new Map<string, Level>();

function fromBuilt(id: string, mirror: boolean): Level | null {
  const b = built[id];
  if (!b) return null;
  const pic = pictureById(id);
  const n = pic.rows.length;
  const flip = (i: number) => (mirror ? Math.floor(i / n) * n + (n - 1 - (i % n)) : i);
  const base = pictureColors(pic);
  const colors = base.map((_, i) => base[flip(i)]);
  const paths = b.paths.map((p) => p.map(flip));
  const pairs = assignHues(paths, puzzleColors(colors, n));
  const f = b.f ?? {};
  // Mirroring flips horizontal currents.
  const dir = (d: number) => (mirror && (d === 1 || d === -1) ? -d : d);
  const features: Features = {
    bridges: f.bridges?.map(flip),
    stalls: f.stalls?.map(flip),
    lanterns: f.lanterns?.map((l) => ({ cell: flip(l.cell), pair: l.pair })),
    currents: f.currents?.map((c) => ({ cell: flip(c.cell), dir: dir(c.dir) })),
  };
  return { id, n, colors, pairs, solution: paths, features };
}

/** Level `index` of the journey. After the last chapter, "encore" rounds reuse pictures with new layouts. */
export function levelAt(index: number): Level {
  const key = `L${index}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { chapter, li, encore } = chapterOf(index);
  const id = chapter.pictures[li];
  const lv = (encore === 0 && fromBuilt(id, false)) || generateLevel(pictureById(id), 1 + encore);
  cache.set(key, lv);
  return lv;
}

/** The daily puzzle: a large picture, mirrored, so even players who solved it get a fresh layout. */
export function dailyLevel(day = dayKey()): Level {
  const key = `D${day}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const pool = CHAPTERS.flatMap((c) => c.pictures).filter((id) => pictureById(id).rows.length >= 7 && built[id]);
  const idx = pool.length ? Math.abs(daysBetween('2026-01-01', day) + (hashString(day) % 3)) % pool.length : 0;
  const lv = (pool.length && fromBuilt(pool[idx], true)) || generateLevel(pictureById('whale'), 1000 + (hashString(day) % 997));
  cache.set(key, lv);
  return lv;
}

/** Difficulty label shown on hard levels (solver search size). */
export function isHard(index: number): boolean {
  const { chapter, li, encore } = chapterOf(index);
  const b = built[chapter.pictures[li]];
  return encore === 0 && !!b && b.nodes > 2000;
}
