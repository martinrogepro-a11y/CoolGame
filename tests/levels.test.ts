import { describe, expect, it } from 'vitest';
import { CHAPTERS, chapterOf, LEVEL_COUNT } from '../src/puzzle/chapters';
import { dailyLevel, levelAt } from '../src/puzzle/levels';
import { PuzzleState } from '../src/puzzle/puzzle';
import { solve } from '../src/puzzle/solver';

describe('journey levels', () => {
  it('has 5 chapters of 10 distinct pictures', () => {
    expect(CHAPTERS).toHaveLength(5);
    const ids = CHAPTERS.flatMap((c) => c.pictures);
    expect(new Set(ids).size).toBe(LEVEL_COUNT);
    expect(chapterOf(LEVEL_COUNT).encore).toBe(1);
  });

  it('every journey level has exactly one solution and is playable', () => {
    for (let i = 0; i < LEVEL_COUNT; i++) {
      const lv = levelAt(i);
      const r = solve(lv.n, lv.pairs, 2, 3_000_000, lv.features);
      expect(r.aborted, lv.id).toBe(false);
      expect(r.count, lv.id).toBe(1);
      const st = new PuzzleState(lv);
      for (const p of lv.solution) {
        st.begin(p[0]);
        for (const c of p.slice(1)) st.extend(c);
        st.end();
      }
      expect(st.solved(), lv.id).toBe(true);
      expect(new Set(lv.pairs.map((p) => p.hue)).size).toBe(lv.pairs.length);
    }
  });

  it('daily puzzles are unique too (mirrored journey layouts)', () => {
    for (const day of ['2026-10-19', '2026-10-20', '2026-12-25']) {
      const lv = dailyLevel(day);
      expect(lv.n).toBeGreaterThanOrEqual(7);
      expect(solve(lv.n, lv.pairs, 2, 3_000_000, lv.features).count).toBe(1);
    }
  });
});
