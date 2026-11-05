/**
 * The journey: chapters are places along the canals, each with ten pictures.
 * Finishing every picture of a chapter completes its album page and grants a reward.
 *
 * Within a chapter the pictures follow a rising sawtooth of difficulty (solver search size):
 * the gentlest opens and teaches the place's mechanic, each step up is followed by a breather,
 * and the hardest closes the chapter. Changing an order means a new JOURNEY_ORDER and a save
 * migration (see meta/save.ts).
 */

export interface Chapter {
  id: string;
  pictures: string[];
  /** Reward for completing the album: hints and a palette. */
  reward: { hints: number; palette?: string };
}

export const CHAPTERS: readonly Chapter[] = [
  { id: 'garden', pictures: ['tree', 'snail', 'house', 'drop', 'heart', 'tulip', 'leaf', 'mushroom', 'sun', 'apple'], reward: { hints: 3 } },
  { id: 'harbour', pictures: ['boat', 'anchor', 'fish', 'crab', 'shell', 'whale', 'island', 'jellyfish', 'octopus', 'lighthouse'], reward: { hints: 4, palette: 'dune' } },
  { id: 'market', pictures: ['flower', 'cup', 'cat', 'icecream', 'strawberry', 'teapot', 'fir', 'pear', 'butterfly', 'cake'], reward: { hints: 5, palette: 'sakura' } },
  { id: 'night', pictures: ['moon', 'fox', 'turtle', 'umbrella', 'owl', 'penguin', 'rocket', 'castle', 'balloon', 'lantern'], reward: { hints: 6, palette: 'night' } },
  { id: 'deep', pictures: ['coral', 'manta', 'seahorse', 'treasure', 'amphora', 'oyster', 'anglerfish', 'temple', 'submarine', 'helmet'], reward: { hints: 7 } },
];

/** Version of the pictures' order; saves record stars by level index, so a new order is migrated. */
export const JOURNEY_ORDER = 2;

/** The order saves before JOURNEY_ORDER 2 were recorded in. */
export const JOURNEY_V1: readonly string[] = [
  'heart', 'tree', 'drop', 'house', 'tulip', 'mushroom', 'apple', 'sun', 'leaf', 'snail',
  'fish', 'boat', 'anchor', 'shell', 'crab', 'jellyfish', 'octopus', 'island', 'whale', 'lighthouse',
  'icecream', 'cup', 'cat', 'fir', 'flower', 'pear', 'cake', 'strawberry', 'teapot', 'butterfly',
  'moon', 'fox', 'owl', 'lantern', 'umbrella', 'rocket', 'balloon', 'penguin', 'turtle', 'castle',
  'oyster', 'seahorse', 'coral', 'treasure', 'amphora', 'helmet', 'manta', 'submarine', 'temple', 'anglerfish',
];

export const LEVEL_COUNT = CHAPTERS.reduce((a, c) => a + c.pictures.length, 0);

/** Chapter and position of a global level index (levels beyond the journey loop as "encore" albums). */
export function chapterOf(level: number): { chapter: Chapter; ci: number; li: number; encore: number } {
  const encore = Math.floor(level / LEVEL_COUNT);
  let rest = level % LEVEL_COUNT;
  for (let ci = 0; ci < CHAPTERS.length; ci++) {
    const ch = CHAPTERS[ci];
    if (rest < ch.pictures.length) return { chapter: ch, ci, li: rest, encore };
    rest -= ch.pictures.length;
  }
  throw new Error('unreachable');
}

export function firstLevelOf(ci: number): number {
  let n = 0;
  for (let i = 0; i < ci; i++) n += CHAPTERS[i].pictures.length;
  return n;
}
