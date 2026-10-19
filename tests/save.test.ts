import { describe, expect, it } from 'vitest';
import { daysBetween } from '../src/core/rng';
import { LANDMARKS } from '../src/meta/landmarks';
import {
  applyRun, build, canBuild, claimMission, doubleRun, freshSave, makeMissions, migrate, refreshDaily, touchStreak,
} from '../src/meta/save';

const stats = (delivered: number[], extra: Partial<{ weeks: number; bridgesUsed: number; bestCombo: number }> = {}) => ({
  score: delivered.reduce((a, b) => a + b, 0),
  weeks: 3,
  delivered,
  bridgesUsed: 0,
  beltsPlaced: 10,
  bestCombo: 4,
  time: 200,
  ...extra,
});

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

  it('applies run rewards, best score, missions and doubling', () => {
    const s = freshSave();
    refreshDaily(s, '2026-02-02');
    s.missions.list = [{ id: 'm', kind: 'score', goal: 10, progress: 0, reward: 30, claimed: false }];
    const r = applyRun(s, stats([8, 4, 0, 0, 0]), 'coast', false);
    expect(r.total).toBe(12);
    expect(r.newBest).toBe(true);
    expect(s.best.coast).toBe(12);
    expect(s.tesserae[0]).toBe(8);
    expect(r.missionsDone).toHaveLength(1);
    doubleRun(s, r);
    expect(s.tesserae[0]).toBe(16);
    expect(s.lifetime).toBe(24);
    expect(claimMission(s, 'm')).toBe(30);
    expect(claimMission(s, 'm')).toBe(0);
    expect(s.lifetime).toBe(54);
  });

  it('builds landmarks only when revealed and affordable', () => {
    const s = freshSave();
    const well = LANDMARKS.find((l) => l.id === 'well')!;
    expect(canBuild(s, well)).toBe(false);
    s.tesserae[0] = 25;
    expect(build(s, well)).toBe(true);
    expect(s.tesserae[0]).toBe(5);
    expect(build(s, well)).toBe(false);
    const arch = LANDMARKS.find((l) => l.premium)!;
    expect(canBuild(s, arch)).toBe(false);
    s.purchases.patron = true;
    expect(canBuild(s, arch)).toBe(true);
  });
});
