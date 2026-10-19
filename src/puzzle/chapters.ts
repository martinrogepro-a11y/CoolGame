/**
 * The journey: chapters are places along the canals, each with ten pictures.
 * Finishing every picture of a chapter completes its album page and grants a reward.
 */

export interface Chapter {
  id: string;
  pictures: string[];
  /** Reward for completing the album: hints and a palette. */
  reward: { hints: number; palette?: string };
}

export const CHAPTERS: readonly Chapter[] = [
  { id: 'garden', pictures: ['heart', 'tree', 'drop', 'house', 'tulip', 'mushroom', 'apple', 'sun', 'leaf', 'snail'], reward: { hints: 3 } },
  { id: 'harbour', pictures: ['fish', 'boat', 'anchor', 'shell', 'crab', 'jellyfish', 'octopus', 'island', 'whale', 'lighthouse'], reward: { hints: 4, palette: 'dune' } },
  { id: 'market', pictures: ['icecream', 'cup', 'cat', 'fir', 'flower', 'pear', 'cake', 'strawberry', 'teapot', 'butterfly'], reward: { hints: 5, palette: 'sakura' } },
  { id: 'night', pictures: ['moon', 'fox', 'owl', 'star', 'umbrella', 'rocket', 'balloon', 'penguin', 'turtle', 'castle'], reward: { hints: 6, palette: 'night' } },
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
