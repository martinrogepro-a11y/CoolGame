import { describe, expect, it } from 'vitest';
import { PICTURES } from '../src/puzzle/pictures';
import { generateLevel } from '../src/puzzle/puzzle';
import { solve } from '../src/puzzle/solver';

describe('solver', () => {
  it('finds the generated solution on small levels', () => {
    for (const pic of PICTURES.slice(0, 8)) {
      const lv = generateLevel(pic);
      const r = solve(lv.n, lv.pairs, 2, 2_000_000);
      expect(r.count).toBeGreaterThanOrEqual(1);
      console.log(pic.id.padEnd(10), lv.n, 'solutions', r.count, 'nodes', r.nodes, r.aborted ? 'ABORT' : '');
    }
  });

  it('counts a trivial 2x2 puzzle exactly', () => {
    // a=0 b=1 on top row, c=2 d=3 bottom row: exactly one way.
    expect(solve(2, [{ a: 0, b: 1 }, { a: 2, b: 3 }], 5).count).toBe(1);
  });
});
