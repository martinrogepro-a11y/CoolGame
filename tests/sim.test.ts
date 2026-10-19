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

  it('never recycles on a single matching line', () => {
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

describe('overpasses', () => {
  /** Builds a sim and clears its entities so we can lay out a controlled scenario. */
  function blank() {
    const sim = new Sim({ district: districtById('peaks'), seed: 5 });
    for (const s of sim.sources) sim.sourceAt[sim.idx(s.x, s.y)] = -1;
    for (const s of sim.sites) sim.siteAt[sim.idx(s.x, s.y)] = -1;
    sim.sources.length = 0;
    sim.sites.length = 0;
    for (const c of sim.cells) c.terrain = 0;
    sim.bounds = { x0: 0, y0: 0, x1: sim.w - 1, y1: sim.h - 1 };
    sim.belts = 50;
    sim.bridges = 2;
    return sim;
  }
  function addSource(sim: Sim, x: number, y: number, color: number) {
    const s = { id: sim.sources.length, x, y, color, outs: [], buffer: 3, timer: 1, rr: 0, age: 0 };
    sim.sources.push(s as never);
    sim.sourceAt[sim.idx(x, y)] = s.id;
  }
  function addSite(sim: Sim, x: number, y: number, color: number) {
    const s = { id: sim.sites.length, x, y, color, pending: 3, stock: 0, incoming: 0, orderTimer: 99, overflow: 0, age: 0, delivered: 0, bump: 0 };
    sim.sites.push(s as never);
    sim.siteAt[sim.idx(x, y)] = s.id;
  }

  it('lets a perpendicular belt pass over another one, both keep flowing', () => {
    const sim = blank();
    // Horizontal line: source (0,5) -> site (6,5). Vertical line: source (3,2) -> site (3,8).
    addSource(sim, 0, 5, 0);
    addSite(sim, 6, 5, 0);
    addSource(sim, 3, 2, 1);
    addSite(sim, 3, 8, 1);
    sim.beginStroke(0, 5);
    sim.extendStroke(6, 5);
    sim.endStroke();
    const bridges = sim.bridges;
    sim.beginStroke(3, 2);
    for (let y = 3; y <= 8; y++) sim.extendStroke(3, y);
    sim.endStroke();
    expect(sim.cells[sim.idx(3, 5)].cross?.dir).toBe(2);
    expect(sim.bridges).toBe(bridges - 1);
    for (let t = 0; t < 20 * 60; t++) sim.step(1 / 60);
    expect(sim.sites[0].delivered).toBeGreaterThan(3);
    expect(sim.sites[1].delivered).toBeGreaterThan(3);
    const recycled = sim.drainEvents().filter((e) => e.type === 'recycle').length;
    expect(recycled).toBe(0);
  });

  it('refunds the bridge when backtracking or erasing an overpass', () => {
    const sim = blank();
    addSource(sim, 0, 5, 0);
    addSite(sim, 6, 5, 0);
    addSource(sim, 3, 2, 1);
    sim.beginStroke(0, 5);
    sim.extendStroke(6, 5);
    sim.endStroke();
    const b0 = sim.bridges, belts0 = sim.belts;
    sim.beginStroke(3, 2);
    for (let y = 3; y <= 7; y++) sim.extendStroke(3, y);
    expect(sim.bridges).toBe(b0 - 1);
    for (let y = 6; y >= 4; y--) sim.extendStroke(3, y); // drag back over the crossing
    expect(sim.bridges).toBe(b0);
    expect(sim.cells[sim.idx(3, 5)].cross).toBeNull();
    for (let y = 5; y <= 7; y++) sim.extendStroke(3, y);
    sim.endStroke();
    expect(sim.bridges).toBe(b0 - 1);
    sim.erase(3, 5);
    expect(sim.bridges).toBe(b0);
    // Four vertical belts placed, then the crossed horizontal belt erased (and refunded).
    expect(sim.belts).toBe(belts0 - 4 + 1);
  });

  it('splits a mixed trunk so each colour reaches its own workshop', () => {
    const sim = blank();
    addSource(sim, 0, 4, 0);
    addSource(sim, 0, 8, 1);
    addSite(sim, 6, 6, 0);
    addSite(sim, 5, 3, 1);
    const draw = (pts: [number, number][]) => {
      expect(sim.beginStroke(...pts[0])).toBe(true);
      for (const p of pts.slice(1)) sim.extendStroke(...p);
      sim.endStroke();
    };
    draw([[0, 4], [1, 4], [2, 4], [2, 5], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6]]);
    draw([[0, 8], [1, 8], [2, 8], [2, 7], [2, 6]]);
    draw([[5, 6], [5, 5], [5, 4], [5, 3]]);
    for (let t = 0; t < 30 * 60; t++) sim.step(1 / 60);
    expect(sim.sites[0].delivered).toBeGreaterThan(3);
    expect(sim.sites[1].delivered).toBeGreaterThan(3);
    expect(sim.drainEvents().filter((e) => e.type === 'recycle')).toHaveLength(0);
  });
});
