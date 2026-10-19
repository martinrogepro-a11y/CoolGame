import { describe, expect, it } from 'vitest';
import { PICTURES } from '../src/puzzle/pictures';
import { generateLevel, PuzzleState } from '../src/puzzle/puzzle';

describe('puzzle generation', () => {
  it('builds a valid level from every picture', () => {
    for (const pic of PICTURES) {
      const lv = generateLevel(pic);
      const n = lv.n;
      const seen = new Set<number>();
      lv.solution.forEach((path, k) => {
        expect(path.length).toBeGreaterThanOrEqual(3);
        expect(path[0]).toBe(lv.pairs[k].a);
        expect(path[path.length - 1]).toBe(lv.pairs[k].b);
        for (let s = 1; s < path.length; s++) {
          const a = path[s - 1], b = path[s];
          expect(Math.abs((a % n) - (b % n)) + Math.abs(Math.floor(a / n) - Math.floor(b / n))).toBe(1);
        }
        for (const c of path) {
          expect(seen.has(c)).toBe(false);
          seen.add(c);
        }
      });
      expect(seen.size).toBe(n * n);
      expect(new Set(lv.pairs.map((p) => p.hue)).size).toBe(lv.pairs.length);
      console.log(pic.id.padEnd(11), `${n}x${n}`, 'pairs', lv.pairs.length);
    }
  });

  it('is deterministic', () => {
    expect(generateLevel(PICTURES[5])).toEqual(generateLevel(PICTURES[5]));
  });
});

describe('puzzle play', () => {
  const lv = generateLevel(PICTURES[8]);

  function draw(st: PuzzleState, path: number[]) {
    st.begin(path[0]);
    for (const c of path.slice(1)) st.extend(c);
    st.end();
  }

  it('is solved by playing the known solution, perfectly', () => {
    const st = new PuzzleState(lv);
    lv.solution.forEach((p) => draw(st, p));
    expect(st.solved()).toBe(true);
    expect(st.perfect(0)).toBe(true);
  });

  it('can be drawn from the workshop end too', () => {
    const st = new PuzzleState(lv);
    lv.solution.forEach((p) => draw(st, p.slice().reverse()));
    expect(st.solved()).toBe(true);
  });

  it('is not solved while a cell is empty', () => {
    const st = new PuzzleState(lv);
    lv.solution.forEach((p, k) => (k === 0 ? undefined : draw(st, p)));
    expect(st.solved()).toBe(false);
  });

  it('cuts a crossed canal and restores it when the finger retreats', () => {
    const st = new PuzzleState(lv);
    const long = lv.solution.reduce((a, b) => (b.length > a.length ? b : a));
    draw(st, long);
    const before = st.paths[0].slice();
    const n = lv.n;
    const adj = (a: number, b: number) => Math.abs((a % n) - (b % n)) + Math.abs(Math.floor(a / n) - Math.floor(b / n)) === 1;
    let mid = -1, other: number[] | undefined, idx = -1;
    for (const m of long.slice(1, -1)) {
      for (const p of lv.solution) {
        if (p === long) continue;
        const j = p.findIndex((c, q) => q < p.length - 1 && adj(c, m));
        if (j >= 0) {
          mid = m;
          other = p;
          idx = j;
          break;
        }
      }
      if (other) break;
    }
    if (!other) return;
    const near = other[idx];
    st.begin(other[0]);
    for (const c of other.slice(1, idx + 1)) st.extend(c);
    expect(st.extend(mid)).toBe(true);
    expect(st.paths[0].length).toBeLessThan(before.length);
    st.extend(near);
    expect(st.paths[0]).toEqual(before);
    st.end();
  });

  it('refuses to end a canal on another pair', () => {
    const st = new PuzzleState(lv);
    const p = lv.solution[0];
    st.begin(p[0]);
    const wrong = st.endpoints.find((e) => e.pair !== st.endpointAt(p[0])!.pair);
    if (wrong) {
      const n = lv.n;
      const head = p[0];
      if ([head - 1, head + 1, head - n, head + n].includes(wrong.cell)) expect(st.extend(wrong.cell)).toBe(false);
    }
    st.end();
  });

  it('hints solve the whole level and break perfection', () => {
    const st = new PuzzleState(lv);
    let guard = 0;
    while (!st.solved() && guard++ < 50) st.hint();
    expect(st.solved()).toBe(true);
    expect(st.perfect(1)).toBe(false);
  });
});
