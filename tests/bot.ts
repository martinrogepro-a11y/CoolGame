import { type Dir, opposite, type Sim } from '../src/game/sim';
import { T } from '../src/game/terrain';

/**
 * A greedy player used for balancing: every second it links each unsupplied
 * workshop to the nearest quarry (or belt already carrying its colour) with
 * the shortest possible path. Good-but-not-great play.
 */
export function botTick(sim: Sim) {
  for (const site of sim.sites) {
    const { cells, overpasses } = carriers(sim, site.color);
    if (fed(sim, site, cells, overpasses)) continue;
    connect(sim, site, cells);
  }
}

/** A workshop counts as fed only if a belt carrying its own colour reaches it. */
function fed(sim: Sim, site: { x: number; y: number }, cells: Set<number>, overpasses: Set<number>): boolean {
  const i = sim.idx(site.x, site.y);
  return sim.insOf(i).some((d) => {
    const n = sim.neighbor(i, d);
    return cells.has(n) || overpasses.has(n);
  });
}

/** Cells whose output carries the given colour (quarries + belts downstream of them). */
function carriers(sim: Sim, color: number): { cells: Set<number>; overpasses: Set<number> } {
  const cells = new Set<number>();
  const overpasses = new Set<number>();
  const queue: number[] = [];
  for (const s of sim.sources) if (s.color === color) queue.push(sim.idx(s.x, s.y));
  while (queue.length) {
    const i = queue.pop()!;
    if (cells.has(i)) continue;
    cells.add(i);
    for (const d of sim.outsOf(i) ?? []) {
      let n = sim.neighbor(i, d);
      while (n >= 0 && sim.cells[n].cross?.dir === d) {
        overpasses.add(n);
        n = sim.neighbor(n, d);
      }
      if (n >= 0 && sim.cells[n].belt) queue.push(n);
    }
  }
  return { cells, overpasses };
}

function connect(sim: Sim, site: { x: number; y: number; color: number }, starts: Set<number>) {
  const target = sim.idx(site.x, site.y);
  // BFS from the workshop backwards over buildable cells.
  const prev = new Map<number, number>();
  prev.set(target, -1);
  const queue = [target];
  let found = -1;
  while (queue.length && found < 0) {
    const cur = queue.shift()!;
    for (let d = 0 as Dir; d < 4; d++) {
      const n = sim.neighbor(cur, d);
      if (n < 0 || prev.has(n)) continue;
      const x = n % sim.w, y = Math.floor(n / sim.w);
      if (!sim.inBounds(x, y)) continue;
      if (starts.has(n)) {
        const outs = sim.outsOf(n)!;
        if (outs.length < 3 && !outs.includes(opposite(d))) {
          prev.set(n, cur);
          found = n;
          break;
        }
        continue;
      }
      const c = sim.cells[n];
      // Hop over a straight perpendicular belt with an overpass if we have a bridge.
      if (c.belt && !c.cross && c.terrain === T.Land && sim.bridges > 0 && cur !== target && c.outs.length === 1 && c.outs[0] % 2 !== d % 2) {
        const ins = sim.insOf(n);
        const n2 = sim.neighbor(n, d);
        if (n2 >= 0 && !prev.has(n2) && ins.every((x) => x === opposite(c.outs[0]))) {
          const c2 = sim.cells[n2];
          const x2 = n2 % sim.w, y2 = Math.floor(n2 / sim.w);
          if (sim.inBounds(x2, y2) && !c2.belt && c2.terrain === T.Land && sim.sourceAt[n2] < 0 && sim.siteAt[n2] < 0) {
            prev.set(n, cur);
            prev.set(n2, n);
            queue.push(n2);
            continue;
          }
        }
      }
      const ok = !c.belt && sim.sourceAt[n] < 0 && sim.siteAt[n] < 0 && (c.terrain === T.Land || (c.terrain === T.Water && sim.bridges > 0));
      if (cur !== target || ok) {
        if (!ok) continue;
        prev.set(n, cur);
        queue.push(n);
      }
    }
  }
  if (found < 0) return;
  const path: number[] = [];
  for (let i = prev.get(found)!; i !== -1; i = prev.get(i)!) path.push(i);
  if (path.length - 1 > sim.belts) return;
  const fx = found % sim.w, fy = Math.floor(found / sim.w);
  if (!sim.beginStroke(fx, fy)) return;
  for (const i of path) sim.extendStroke(i % sim.w, Math.floor(i / sim.w));
  sim.endStroke();
}

export function playBot(sim: Sim, maxSeconds = 1800, pick?: (s: Sim) => void): number {
  const dt = 1 / 30;
  let acc = 0;
  while (sim.state !== 'over' && sim.time < maxSeconds) {
    sim.step(dt);
    if (sim.state === 'upgrade') {
      if (pick) pick(sim);
      else sim.chooseUpgrade(sim.offer.includes('belts') && sim.belts < 12 ? 'belts' : sim.offer[0]);
    }
    acc += dt;
    if (acc >= 1) {
      acc = 0;
      botTick(sim);
    }
  }
  return sim.time;
}
