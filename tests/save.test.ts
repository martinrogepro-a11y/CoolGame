import { describe, expect, it } from 'vitest';
import { daysBetween } from '../src/core/rng';
import {
  applyLevel, claimMission, doubleRun, freshSave, HINT_PACK, makeMissions, migrate, refreshDaily, touchStreak, tradeForHints,
} from '../src/meta/save';

describe('save & meta loop', () => {
  it('migrates partial / old saves without losing data', () => {
    const s = migrate({ lifetime: 120, tesserae: [5, 6], settings: { sound: false } });
    expect(s.lifetime).toBe(120);
    expect(s.tesserae).toEqual([5, 6, 0, 0, 0]);
    expect(s.settings.sound).toBe(false);
    expect(s.settings.haptics).toBe(true);
    expect(migrate('garbage').v).toBe(1);
  });

  it('extends the streak on consecutive days and resets after a gap', () => {
    const s = freshSave();
    touchStreak(s, '2026-01-01');
    touchStreak(s, '2026-01-01');
    expect(s.streak.count).toBe(1);
    touchStreak(s, '2026-01-02');
    touchStreak(s, '2026-01-03');
    expect(s.streak.count).toBe(3);
    expect(s.gift).toBeGreaterThan(0);
    refreshDaily(s, '2026-01-06');
    expect(s.streak.count).toBe(0);
    touchStreak(s, '2026-01-06');
    expect(s.streak.count).toBe(1);
    expect(s.streak.best).toBe(3);
  });

  it('daysBetween handles month and DST boundaries', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-01-31', '2026-02-01')).toBe(1);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });

  it('generates the same 3 missions for everyone on a given day', () => {
    expect(makeMissions('2026-05-05')).toEqual(makeMissions('2026-05-05'));
    expect(makeMissions('2026-05-05')).toHaveLength(3);
  });

  it('applies level rewards, missions and doubling', () => {
    const s = freshSave();
    refreshDaily(s, '2026-02-02');
    s.missions.list = [{ id: 'm', kind: 'levels', goal: 1, progress: 0, reward: 30, claimed: false }];
    const r = applyLevel(s, 0, [0, 0, 0, 0, 1, 1, 1, 1], false, false);
    expect(r.total).toBe(4);
    expect(s.tesserae[0]).toBe(2);
    expect(r.missionsDone).toHaveLength(1);
    doubleRun(s, r);
    expect(s.tesserae[0]).toBe(4);
    expect(s.lifetime).toBe(8);
    expect(claimMission(s, 'm')).toBe(30);
    expect(claimMission(s, 'm')).toBe(0);
    expect(s.lifetime).toBe(38);
  });

  it('drops the retired endless mode from old saves', () => {
    const s = migrate({ best: { coast: 9 }, built: ['well'], missions: { day: 'd', list: [{ id: 'x', kind: 'score', goal: 1, progress: 0, reward: 1, claimed: false }] } });
    expect('best' in s).toBe(false);
    expect('built' in s).toBe(false);
    expect(s.missions.list).toHaveLength(0);
  });

  it('trades tesserae for hints, from the largest piles first', () => {
    const s = freshSave();
    s.tesserae = [100, 40, 20, 0, 0];
    expect(tradeForHints(s)).toBe(true);
    expect(s.tesserae.reduce((a, b) => a + b, 0)).toBe(160 - HINT_PACK.cost);
    expect(s.hints).toBe(3 + HINT_PACK.hints);
    expect(tradeForHints(s)).toBe(false);
  });
});

describe('stars, chest and albums', () => {
  it('fills the chest with new stars only and opens it', async () => {
    const { applyLevel, openChest, CHEST_STARS, claimAlbum } = await import('../src/meta/save');
    const s = freshSave();
    const colors = Array(25).fill(0);
    expect(applyLevel(s, 0, colors, false, false).starsGained).toBe(1);
    expect(applyLevel(s, 0, colors, true, false).starsGained).toBe(2);
    expect(applyLevel(s, 0, colors, true, false).starsGained).toBe(0);
    expect(s.puzzle.chest).toBe(3);
    expect(openChest(s, 1)).toBeNull();
    s.puzzle.chest = CHEST_STARS + 2;
    const hints = s.hints;
    const r = openChest(s, 1)!;
    expect(s.hints).toBe(hints + r.hints);
    expect(s.puzzle.chest).toBe(2);
    expect(claimAlbum(s, 'garden', { hints: 3 })).toBe(true);
    expect(claimAlbum(s, 'garden', { hints: 3 })).toBe(false);
  });
});
