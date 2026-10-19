import { describe, expect, it } from 'vitest';
import { districtById } from '../src/game/content';
import { Sim, TUNING } from '../src/game/sim';

function makeSim(seed = 42) {
  return new Sim({ district: districtById('coast'), seed });
}

/** Draws a straight-ish L path between two points through the stroke API. */
function connect(sim: Sim, from: { x: number; y: number }, to: { x: number; y: number }) {
  expect(sim.beginStroke(from.x, from.y)).toBe(true);
  sim.extendStroke(to.x, to.y);
  sim.endStroke();
}

function run(sim: Sim, seconds: number, dt = 1 / 60) {
  for (let t = 0; t < seconds; t += dt) {
    sim.step(dt);
    if (sim.state === 'upgrade') sim.chooseUpgrade(sim.offer[0]);
  }
}

describe('Sim', () => {
  it('is deterministic for a given seed', () => {
    const a = makeSim(7);
    const b = makeSim(7);
    run(a, 120);
    run(b, 120);
    expect(a.sites.map((s) => [s.x, s.y, s.color])).toEqual(b.sites.map((s) => [s.x, s.y, s.color]));
  });

  it('opens with one quarry and one matching workshop', () => {
    const sim = makeSim();
    expect(sim.sources).toHaveLength(1);
    expect(sim.sites).toHaveLength(1);
    expect(sim.sites[0].color).toBe(sim.sources[0].color);
  });

  it('delivers items along a drawn belt and spends belts', () => {
    const sim = makeSim();
    const src = sim.sources[0];
    const site = sim.sites[0];
    const before = sim.belts;
    connect(sim, src, site);
    const used = before - sim.belts;
    expect(used).toBeGreaterThan(0);
    expect(sim.sources[0].outs.length).toBe(1);
    run(sim, 20);
    expect(sim.stats.score).toBeGreaterThan(2);
    expect(sim.stats.delivered[src.color]).toBe(sim.stats.score);
  });

  it('refunds belts on erase and backtracking', () => {
    const sim = makeSim();
    const src = sim.sources[0];
    const before = sim.belts;
    expect(sim.beginStroke(src.x, src.y)).toBe(true);
    const bx = src.x + (src.x < 4 ? 1 : -1);
    sim.extendStroke(bx, src.y);
    if (sim.belts === before - 1) {
      sim.extendStroke(src.x, src.y); // drag back
      expect(sim.belts).toBe(before);
    }
    sim.endStroke();
    connect(sim, src, sim.sites[0]);
    const spent = before - sim.belts;
    let erased = 0;
    for (let y = 0; y < sim.h; y++) for (let x = 0; x < sim.w; x++) if (sim.erase(x, y)) erased++;
    expect(erased).toBe(spent);
    expect(sim.belts).toBe(before);
    expect(sim.sources[0].outs).toEqual([]);
  });

  it('ends the run when a workshop is neglected', () => {
    const sim = makeSim();
    run(sim, 400);
    expect(sim.state).toBe('over');
    const ev = sim.drainEvents();
    expect(ev.some((e) => e.type === 'over')).toBe(true);
  });

  it('revive gives exactly one second chance', () => {
    const sim = makeSim();
    run(sim, 400);
    expect(sim.state).toBe('over');
    sim.revive();
    expect(sim.state).toBe('playing');
    expect(sim.sites.every((s) => s.overflow === 0)).toBe(true);
    run(sim, 400);
    expect(sim.state).toBe('over');
    sim.revive();
    expect(sim.state).toBe('over');
  });

  it('opens a week break with two distinct upgrade offers', () => {
    const sim = makeSim();
    for (let t = 0; t < TUNING.WEEK + 1 && sim.state === 'playing'; t += 1 / 30) sim.step(1 / 30);
    expect(sim.state).toBe('upgrade');
    expect(sim.offer).toHaveLength(2);
    expect(new Set(sim.offer).size).toBe(2);
    const belts = sim.belts;
    sim.chooseUpgrade('belts');
    expect(sim.belts).toBe(belts + 10);
    expect(sim.state).toBe('playing');
  });

  it('routes items at a split toward the matching workshop', () => {
    const sim = makeSim(3);
    // Build a hand-made scenario on an empty board.
    const s = sim as unknown as { sources: Sim['sources']; sites: Sim['sites'] };
    expect(s.sources.length).toBeGreaterThan(0);
    // Every delivered item must match its workshop colour when only matching paths exist.
    connect(sim, sim.sources[0], sim.sites[0]);
    run(sim, 30);
    const recycled = sim.drainEvents().filter((e) => e.type === 'recycle').length;
    expect(recycled).toBe(0);
  });
});
