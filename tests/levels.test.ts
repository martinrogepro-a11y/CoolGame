import { describe, expect, it } from 'vitest';
import { CHAPTERS, chapterOf, LEVEL_COUNT } from '../src/puzzle/chapters';
import { dailyLevel, levelAt } from '../src/puzzle/levels';
import { PuzzleState } from '../src/puzzle/puzzle';
import { solve } from '../src/puzzle/solver';
import BUILT from '../src/puzzle/levels.json';

describe('journey levels', () => {
  // Difficulty = solver search size. Each chapter is a lesson: gentlest first, hardest last,
  // and the first half never harder than the last three (a rising sawtooth, not a cliff).
  it('each chapter rises like a sawtooth', () => {
    const nodes = (id: string) => (BUILT as Record<string, { nodes: number }>)[id].nodes;
    for (const ch of CHAPTERS) {
      const d = ch.pictures.map(nodes);
      expect(Math.min(...d), ch.id).toBe(d[0]);
      expect(Math.max(...d), ch.id).toBe(d[d.length - 1]);
      expect(Math.max(...d.slice(0, 5)), ch.id).toBeLessThan(Math.min(...d.slice(-3)));
    }
  });

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

  it('no grid is larger than 8x8 (cells stay comfortable on a phone)', () => {
    for (let i = 0; i < LEVEL_COUNT; i++) expect(levelAt(i).n, levelAt(i).id).toBeLessThanOrEqual(8);
  });

  it('daily puzzles are unique too (mirrored journey layouts)', () => {
    for (const day of ['2026-10-19', '2026-10-20', '2026-12-25']) {
      const lv = dailyLevel(day);
      expect(lv.n).toBeGreaterThanOrEqual(7);
      expect(solve(lv.n, lv.pairs, 2, 3_000_000, lv.features).count).toBe(1);
    }
  });
});
