import { describe, expect, it } from 'vitest';
import { CHAPTERS, firstLevelOf } from '../src/puzzle/chapters';
import { levelAt } from '../src/puzzle/levels';
import { assignHues, type Features, type Level, PuzzleState } from '../src/puzzle/puzzle';
import { solve } from '../src/puzzle/solver';

/**
 * 5x5 with a bridge in the middle: a horizontal canal 10..14 crosses a vertical one 2..22,
 * and four L-shaped canals fill the corners.
 */
const BRIDGE_PATHS = [
  [10, 11, 12, 13, 14],
  [2, 7, 12, 17, 22],
  [0, 1, 6, 5],
  [3, 4, 9, 8],
  [15, 16, 21, 20],
  [18, 19, 24, 23],
];

function level(paths: number[][], features: Features, n = 5): Level {
  return { id: 'test', n, colors: new Array(n * n).fill(5), pairs: assignHues(paths, new Array(n * n).fill(5)), solution: paths, features };
}

function draw(st: PuzzleState, path: number[]): boolean {
  st.begin(path[0]);
  let ok = true;
  for (const c of path.slice(1)) ok = st.extend(c) && ok;
  st.end();
  return ok;
}

describe('bridges', () => {
  const lv = level(BRIDGE_PATHS, { bridges: [12] });

  it('the solver finds the crossing solution', () => {
    expect(solve(5, lv.pairs, 5, 100_000, lv.features).count).toBeGreaterThan(0);
    // Without the bridge, two canals cannot share the middle cell.
    expect(solve(5, lv.pairs, 5, 100_000).count).toBe(0);
  });

  it('two canals cross, and both lanes are needed to finish', () => {
    const st = new PuzzleState(lv);
    BRIDGE_PATHS.forEach((p, k) => (k === 1 ? undefined : draw(st, p)));
    expect(st.solved()).toBe(false);
    expect(draw(st, BRIDGE_PATHS[1])).toBe(true);
    expect(st.paths.find((p) => p[0] === 10)).toEqual(BRIDGE_PATHS[0]);
    expect(st.solved()).toBe(true);
  });

  it('a canal cannot turn on a bridge', () => {
    const st = new PuzzleState(lv);
    st.begin(2);
    expect(st.extend(7)).toBe(true);
    expect(st.extend(12)).toBe(true);
    expect(st.extend(13)).toBe(false);
  });
});

describe('terraces, lanterns and currents', () => {
  const n = 3;

  it('nothing can be built on a terrace', () => {
    const st = new PuzzleState(level([[0, 1, 2], [3, 4, 5]], { stalls: [6, 7, 8] }, 3));
    st.begin(3);
    expect(st.extend(6)).toBe(false);
  });

  it('only the canal of its colour may pass a lantern', () => {
    const lv = level([[0, 1, 2], [3, 4, 5], [6, 7, 8]], { lanterns: [{ cell: 4, pair: 1 }] }, n);
    const st = new PuzzleState(lv);
    st.begin(0);
    expect(st.extend(1)).toBe(true);
    expect(st.extend(4)).toBe(false);
    st.end();
    st.begin(3);
    expect(st.extend(4)).toBe(true);
  });

  it('currents set the direction, from the fountain to the house', () => {
    const lv = level([[0, 1, 2], [3, 4, 5], [6, 7, 8]], { currents: [{ cell: 4, dir: 1 }] }, n);
    expect(solve(n, lv.pairs, 5, 10_000, lv.features).count).toBe(1);
    const st = new PuzzleState(lv);
    // Drawn from the house end, the canal goes against the arrow: allowed in reverse only.
    st.begin(5);
    expect(st.extend(4)).toBe(true);
    expect(st.extend(3)).toBe(true);
    st.end();
    const wrong = new PuzzleState(level([[0, 1, 2], [5, 4, 3], [6, 7, 8]], { currents: [{ cell: 4, dir: 1 }] }, n));
    wrong.begin(5);
    expect(wrong.extend(4)).toBe(false);
  });
});

describe('chapter mechanics in the journey', () => {
  it('each chapter after the garden opens with its mechanic', () => {
    const key = ['', 'bridges', 'stalls', 'lanterns', 'currents'];
    CHAPTERS.forEach((_, ci) => {
      if (ci === 0) return;
      const lv = levelAt(firstLevelOf(ci));
      const list = (lv.features as Record<string, unknown[] | undefined>)[key[ci]] ?? [];
      expect(list.length, lv.id).toBeGreaterThan(0);
    });
  });
});
