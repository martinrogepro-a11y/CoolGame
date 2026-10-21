import { describe, expect, it } from 'vitest';
import { applyLevel, freshSave, migrate } from '../src/meta/save';
import { isComplete, nextRestoration, restore, restoredIn, VILLAGES } from '../src/meta/village';

describe('village restoration', () => {
  it('restores in order, spending stars, until the place is complete', () => {
    const v = { stars: 100, done: [] as string[] };
    const total = VILLAGES.garden.reduce((a, r) => a + r.cost, 0);
    for (const r of VILLAGES.garden) expect(restore(v, 'garden')?.id).toBe(r.id);
    expect(isComplete(v, 'garden')).toBe(true);
    expect(restore(v, 'garden')).toBeNull();
    expect(v.stars).toBe(100 - total);
    expect(restoredIn(v, 'garden').has('fountain')).toBe(true);
    expect(restoredIn(v, 'harbour').size).toBe(0);
  });

  it('refuses a restoration the player cannot afford', () => {
    const v = { stars: 0, done: [] as string[] };
    expect(restore(v, 'harbour')).toBeNull();
    expect(nextRestoration(v, 'harbour')?.id).toBe('paint');
  });

  it('stars won in levels go to the village', () => {
    const s = freshSave();
    applyLevel(s, 0, new Array(25).fill(5), true, false);
    expect(s.village.stars).toBe(3);
    applyLevel(s, 0, new Array(25).fill(5), true, false);
    expect(s.village.stars).toBe(3);
  });

  it('older saves get their stars back to spend', () => {
    const s = migrate({ puzzle: { next: 3, stars: [3, 1, 3], chest: 0, albums: [] } });
    expect(s.village).toEqual({ stars: 7, done: [] });
  });
});
