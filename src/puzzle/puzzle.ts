import { Rng } from '../core/rng';
import { type Picture, pictureColors } from './pictures';

/**
 * Canal puzzles. Each level hides a pixel picture: the grid is partitioned into
 * same-colour paths, whose two ends become a fountain and a workshop. The player
 * must link every pair without crossing and cover every cell; the finished canals
 * then turn into the mosaic.
 */

export interface Pair {
  /** Picture colour this canal mostly covers: 0-4 materials, 5 stone. */
  c: number;
  /** Canal colour shown while playing (index in PUZZLE_COLORS), unique per level. */
  hue: number;
  a: number;
  b: number;
}

/** Ten distinct canal colours in the game's palette; the first five are the materials. */
export const PUZZLE_COLORS = ['#D2694A', '#3F5E9A', '#4E9A74', '#E0A332', '#8A4F8C', '#2F9C9C', '#E08AA6', '#9AA342', '#26375E', '#9A5B34'];

export interface Level {
  id: string;
  n: number;
  /** The real picture (revealed on completion). */
  colors: number[];
  pairs: Pair[];
  /** One known solution: cells of each pair's path, from a to b. */
  solution: number[][];
}

const MIN_PATH = 3;

function neighbors(i: number, n: number): number[] {
  const x = i % n, y = Math.floor(i / n);
  const res: number[] = [];
  if (y > 0) res.push(i - n);
  if (x < n - 1) res.push(i + 1);
  if (y < n - 1) res.push(i + n);
  if (x > 0) res.push(i - 1);
  return res;
}

function components(colors: number[], n: number): number[][] {
  const seen = new Uint8Array(colors.length);
  const comps: number[][] = [];
  for (let i = 0; i < colors.length; i++) {
    if (seen[i]) continue;
    const comp: number[] = [];
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const c = stack.pop()!;
      comp.push(c);
      for (const nb of neighbors(c, n)) if (!seen[nb] && colors[nb] === colors[i]) {
        seen[nb] = 1;
        stack.push(nb);
      }
    }
    comps.push(comp);
  }
  return comps;
}

/**
 * Pixel art has single-pixel eyes and thin lines that no path can cover alone.
 * For the puzzle layout only, tiny regions take the colour of their main neighbour;
 * the reveal still shows the exact picture.
 */
export function puzzleColors(colors: number[], n: number): number[] {
  const out = colors.slice();
  for (let pass = 0; pass < 12; pass++) {
    let changed = false;
    for (const comp of components(out, n)) {
      if (comp.length >= MIN_PATH) continue;
      const votes = new Map<number, number>();
      for (const c of comp) for (const nb of neighbors(c, n)) if (out[nb] !== out[c]) votes.set(out[nb], (votes.get(out[nb]) ?? 0) + 1);
      if (votes.size === 0) continue;
      const best = [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0];
      for (const c of comp) out[c] = best;
      changed = true;
    }
    if (!changed) break;
  }
  return out;
}

/** Covers a region with vertex-disjoint paths (Warnsdorff-style greedy walk), or null. */
function coverRegion(region: number[], n: number, rng: Rng, mergeChance: number, colors?: number[]): number[][] | null {
  const free = new Set(region);
  const colorCost = (a: number, b: number) => (colors && colors[a] !== colors[b] ? 1.6 : 0);
  const deg = (c: number) => neighbors(c, n).filter((x) => free.has(x)).length;
  const paths: number[][] = [];
  const pickNext = (from: number): number => {
    const opts = neighbors(from, n).filter((x) => free.has(x));
    if (!opts.length) return -1;
    let best = Infinity;
    let cands: number[] = [];
    for (const o of opts) {
      const d = deg(o) + colorCost(from, o) + rng.next() * 0.9;
      if (d < best - 1e-9) {
        best = d;
        cands = [o];
      }
    }
    return cands[0];
  };
  while (free.size) {
    let start = -1;
    let best = Infinity;
    for (const c of free) {
      const d = deg(c) + rng.next() * 0.5;
      if (d < best) {
        best = d;
        start = c;
      }
    }
    free.delete(start);
    const path = [start];
    for (let nx = pickNext(start); nx >= 0; nx = pickNext(path[path.length - 1])) {
      free.delete(nx);
      path.push(nx);
    }
    for (let nx = pickNext(path[0]); nx >= 0; nx = pickNext(path[0])) {
      free.delete(nx);
      path.unshift(nx);
    }
    paths.push(path);
  }
  // Join paths whose ends touch: fixes short ones, and sometimes lengthens others (harder levels).
  const adjacent = (a: number, b: number) => neighbors(a, n).includes(b);
  let progress = true;
  while (progress) {
    progress = false;
    for (let i = 0; i < paths.length && !progress; i++) {
      const p = paths[i];
      const short = p.length < MIN_PATH;
      if (!short && rng.next() > mergeChance) continue;
      for (let j = 0; j < paths.length && !progress; j++) {
        if (i === j) continue;
        const q = paths[j];
        for (const [pa, qa] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
          const pe = pa ? p[p.length - 1] : p[0];
          const qe = qa ? q[q.length - 1] : q[0];
          if (!adjacent(pe, qe)) continue;
          const pp = pa ? p : p.slice().reverse(); // ends at pe
          const qq = qa ? q.slice().reverse() : q; // starts at qe
          paths[i] = [...pp, ...qq];
          paths.splice(j, 1);
          progress = true;
          break;
        }
      }
    }
  }
  // A short path touching the middle of another one steals that path's tail.
  for (let guard = 0; guard < 50; guard++) {
    const i = paths.findIndex((p) => p.length < MIN_PATH);
    if (i < 0) break;
    const p = paths[i];
    let fixed = false;
    for (const pe of [p[0], p[p.length - 1]]) {
      const pp = pe === p[p.length - 1] ? p : p.slice().reverse();
      for (let j = 0; j < paths.length && !fixed; j++) {
        if (j === i) continue;
        const q = paths[j];
        for (let m = 0; m < q.length && !fixed; m++) {
          if (!adjacent(pe, q[m])) continue;
          const options: [number[], number[]][] = [
            [q.slice(m), q.slice(0, m)],
            [q.slice(0, m + 1).reverse(), q.slice(m + 1)],
          ];
          for (const [tail, rest] of options) {
            if (rest.length !== 0 && rest.length < MIN_PATH) continue;
            paths[i] = [...pp, ...tail];
            if (rest.length) paths[j] = rest;
            else paths.splice(j, 1);
            fixed = true;
            break;
          }
        }
      }
      if (fixed) break;
    }
    if (!fixed) break;
  }
  return paths.every((p) => p.length >= MIN_PATH) ? paths : null;
}

/** Most frequent picture colour along a path (stone only wins if nothing else is there). */
function pathColor(path: number[], colors: number[]): number {
  const count = [0, 0, 0, 0, 0, 0];
  for (const c of path) count[colors[c]] += colors[c] === 5 ? 0.8 : 1;
  return count.indexOf(Math.max(...count));
}

/** Target number of pairs per grid size, close to the classic puzzles of this genre. */
export function targetPairs(n: number): number {
  return n <= 5 ? 5 : n === 6 ? 6 : n === 7 ? 7 : n === 8 ? 8 : 10;
}

/**
 * Builds a level: the grid is covered with paths that follow the picture's colour
 * regions as much as possible, then split or joined until the pair count suits the size.
 */
export function generateLevel(pic: Picture, seed = 1): Level {
  const n = pic.rows.length;
  const colors = pictureColors(pic);
  const layout = puzzleColors(colors, n);
  const target = targetPairs(n);
  const all = Array.from({ length: n * n }, (_, i) => i);
  const adjacent = (a: number, b: number) => neighbors(a, n).includes(b);
  let best: number[][] | null = null;
  let bestScore = -Infinity;
  for (let attempt = 0; attempt < 120; attempt++) {
    const rng = new Rng(seed * 7919 + attempt * 104729 + 1);
    const paths = coverRegion(all, n, rng, 0, layout);
    if (!paths) continue;
    // Split long paths at colour changes until there are enough pairs.
    for (let guard = 0; paths.length < target && guard < 40; guard++) {
      const k = paths.reduce((bi, p, i) => (p.length > paths[bi].length ? i : bi), 0);
      const p = paths[k];
      if (p.length < MIN_PATH * 2) break;
      let cut = -1;
      let cutScore = -Infinity;
      for (let m = MIN_PATH; m <= p.length - MIN_PATH; m++) {
        const sc = (layout[p[m - 1]] !== layout[p[m]] ? 3 : 0) - Math.abs(m - p.length / 2) / p.length + rng.next() * 0.5;
        if (sc > cutScore) {
          cutScore = sc;
          cut = m;
        }
      }
      paths.splice(k, 1, p.slice(0, cut), p.slice(cut));
    }
    // Join same-coloured touching paths if there are too many pairs.
    for (let guard = 0; paths.length > target + 1 && guard < 40; guard++) {
      let joined = false;
      for (let i = 0; i < paths.length && !joined; i++)
        for (let j = 0; j < paths.length && !joined; j++) {
          if (i === j || pathColor(paths[i], layout) !== pathColor(paths[j], layout)) continue;
          const p = paths[i], q = paths[j];
          if (adjacent(p[p.length - 1], q[0])) {
            paths[i] = [...p, ...q];
            paths.splice(j, 1);
            joined = true;
          }
        }
      if (!joined) break;
    }
    // Score: right number of pairs, paths faithful to the picture.
    let fidelity = 0;
    for (const p of paths) {
      const pc = pathColor(p, layout);
      for (const c of p) if (layout[c] === pc) fidelity++;
    }
    const score = fidelity / (n * n) * 4 - Math.abs(paths.length - target);
    if (score > bestScore) {
      bestScore = score;
      best = paths.map((p) => p.slice());
    }
  }
  if (!best) throw new Error(`could not generate level ${pic.id}`);
  // Each canal gets its own hue, preferring the material it mostly covers so the reveal feels continuous.
  const used = new Set<number>();
  const pairs = best.map((p) => ({ c: pathColor(p, layout), hue: -1, a: p[0], b: p[p.length - 1] }));
  for (const pr of pairs) if (pr.c < 5 && !used.has(pr.c)) {
    pr.hue = pr.c;
    used.add(pr.c);
  }
  for (const pr of pairs) if (pr.hue < 0) {
    pr.hue = PUZZLE_COLORS.findIndex((_, h) => !used.has(h));
    used.add(pr.hue);
  }
  return { id: pic.id, n, colors, pairs, solution: best };
}

// ------------------------------------------------------------------ play state

export interface Endpoint {
  cell: number;
  pair: number;
  hue: number;
  /** Each fountain feeds its own workshop (same colour). */
  kind: 'fountain' | 'workshop';
}

export class PuzzleState {
  readonly level: Level;
  readonly n: number;
  readonly endpoints: Endpoint[];
  /** Canals being drawn or drawn; each starts at an endpoint. */
  paths: number[][] = [];
  owner: Int16Array;
  moves = 0;
  private active = -1;
  private lastStart = -1;
  private snapshot: number[][] = [];
  private endpointAt_: Int16Array;

  constructor(level: Level) {
    this.level = level;
    this.n = level.n;
    this.endpoints = [];
    this.endpointAt_ = new Int16Array(this.n * this.n).fill(-1);
    level.pairs.forEach((p, k) => {
      this.endpointAt_[p.a] = this.endpoints.length;
      this.endpoints.push({ cell: p.a, pair: k, hue: p.hue, kind: 'fountain' });
      this.endpointAt_[p.b] = this.endpoints.length;
      this.endpoints.push({ cell: p.b, pair: k, hue: p.hue, kind: 'workshop' });
    });
    this.owner = new Int16Array(this.n * this.n).fill(-1);
  }

  endpointAt(i: number): Endpoint | null {
    const e = this.endpointAt_[i];
    return e >= 0 ? this.endpoints[e] : null;
  }

  /** Hue of canal k (taken from its starting endpoint). */
  pathColor(k: number): number {
    return this.endpointAt(this.paths[k][0])?.hue ?? 0;
  }

  get drawingPath(): number {
    return this.active;
  }

  isConnected(k: number): boolean {
    const p = this.paths[k];
    if (!p || p.length < 2) return false;
    const a = this.endpointAt(p[0]);
    const b = this.endpointAt(p[p.length - 1]);
    return !!a && !!b && a.pair === b.pair && a.cell !== b.cell;
  }

  connectedCount(): number {
    return this.paths.filter((_, k) => this.isConnected(k)).length;
  }

  filledCount(): number {
    let n = 0;
    for (let i = 0; i < this.owner.length; i++) if (this.owner[i] >= 0 || this.endpointAt_[i] >= 0) n++;
    return n;
  }

  solved(): boolean {
    return this.connectedCount() === this.level.pairs.length && this.filledCount() === this.n * this.n;
  }

  /** Perfect: each canal drawn in a single go, no hint. */
  perfect(hintsUsed: number): boolean {
    return hintsUsed === 0 && this.moves <= this.level.pairs.length;
  }

  private rebuildOwner() {
    this.owner.fill(-1);
    this.paths.forEach((path, k) => path.forEach((c) => (this.owner[c] = k)));
  }

  private adjacent(a: number, b: number): boolean {
    return neighbors(a, this.n).includes(b);
  }

  /** Starts drawing from cell i: an endpoint (restarts its canal) or any cell of a canal (cuts it there). */
  begin(i: number): number {
    if (this.endpointAt_[i] >= 0) {
      this.paths = this.paths.filter((p) => !p.includes(i));
      this.paths.push([i]);
      this.active = this.paths.length - 1;
    } else {
      const k = this.owner[i];
      if (k < 0) return -1;
      this.paths[k] = this.paths[k].slice(0, this.paths[k].indexOf(i) + 1);
      this.active = k;
    }
    this.snapshot = this.paths.map((p) => p.slice());
    this.rebuildOwner();
    return this.active;
  }

  extend(i: number): boolean {
    const k = this.active;
    if (k < 0) return false;
    const path = this.paths[k];
    const head = path[path.length - 1];
    if (i === head || !this.adjacent(head, i)) return false;
    const own = path.indexOf(i);
    if (own >= 0) {
      this.paths[k] = path.slice(0, own + 1);
      this.restoreOthers();
      return true;
    }
    if (this.isConnected(k)) return false;
    const ep = this.endpointAt(i);
    if (ep) {
      const start = this.endpointAt(path[0])!;
      if (ep.pair !== start.pair) return false;
      if (this.paths.some((p, j) => j !== k && p.includes(i))) return false;
    }
    path.push(i);
    this.restoreOthers();
    return true;
  }

  /** Other canals are their state at stroke start, cut where the active canal now passes. */
  private restoreOthers() {
    const used = new Set(this.paths[this.active]);
    this.paths = this.paths.map((p, k) => {
      if (k === this.active) return p;
      const snap = this.snapshot[k] ?? p;
      const cut = snap.findIndex((c) => used.has(c));
      return cut < 0 ? snap.slice() : snap.slice(0, cut);
    });
    this.rebuildOwner();
  }

  end() {
    const k = this.active;
    if (k < 0) return;
    this.active = -1;
    const start = this.paths[k][0];
    if (this.paths[k].length > 1 && start !== this.lastStart) {
      this.moves++;
      this.lastStart = start;
    }
    // Canals reduced to their starting endpoint disappear.
    this.paths = this.paths.filter((p) => p.length > 1);
    this.rebuildOwner();
  }

  /** Lays the known solution of one canal that is not yet in place. Returns its index, or -1. */
  hint(): number {
    const placed = (sol: number[]) => this.paths.some((p) => p.join() === sol.join() || p.slice().reverse().join() === sol.join());
    const k = this.level.solution.findIndex((sol) => !placed(sol));
    if (k < 0) return -1;
    const sol = this.level.solution[k];
    const used = new Set(sol);
    this.paths = this.paths
      .filter((p) => !used.has(p[0]))
      .map((p) => {
        const cut = p.findIndex((c) => used.has(c));
        return cut < 0 ? p : p.slice(0, cut);
      })
      .filter((p) => p.length > 1);
    this.paths.push(sol.slice());
    this.lastStart = -1;
    this.rebuildOwner();
    return k;
  }

  reset() {
    this.paths = [];
    this.moves = 0;
    this.lastStart = -1;
    this.active = -1;
    this.rebuildOwner();
  }
}
