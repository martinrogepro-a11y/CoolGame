import type { Features } from './puzzle';

/**
 * Exact solver for canal puzzles (link every pair, cover every cell, no crossing).
 * Used offline to keep only levels with a unique solution and to grade difficulty
 * by the size of the search tree a solver needs.
 *
 * It also knows the chapter mechanics: bridges (a horizontal and a vertical canal cross
 * there, both lanes must be used), terraces (blocked cells), lanterns (only the canal of
 * their colour may pass) and currents (the canal must flow through in the arrow's direction).
 */

export interface SolveResult {
  /** Solutions found, capped at the requested limit. */
  count: number;
  /** Search nodes visited: a proxy for how much reasoning the level demands. */
  nodes: number;
  /** True if the node budget ran out before the search finished. */
  aborted: boolean;
}

const FREE = -1;
const BLOCKED = -2;
const BRIDGE = -3;

export function solve(n: number, pairs: { a: number; b: number }[], limit = 2, budget = 400_000, f: Features = {}): SolveResult {
  const N = n * n;
  const nbr: number[][] = [];
  for (let i = 0; i < N; i++) {
    const x = i % n, y = Math.floor(i / n);
    const l: number[] = [];
    if (y > 0) l.push(i - n);
    if (x < n - 1) l.push(i + 1);
    if (y < n - 1) l.push(i + n);
    if (x > 0) l.push(i - 1);
    nbr.push(l);
  }
  /** Neighbour of c one step `d` away (d = ±1 or ±n), or -1 off the grid. */
  const step = (c: number, d: number) => {
    const m = c + d;
    if (m < 0 || m >= N) return -1;
    if ((d === 1 || d === -1) && Math.floor(m / n) !== Math.floor(c / n)) return -1;
    return m;
  };
  const owner = new Int16Array(N).fill(FREE);
  // Lanes of bridge cells: [horizontal, vertical] owner.
  const laneH = new Int16Array(N).fill(FREE);
  const laneV = new Int16Array(N).fill(FREE);
  const lantern = new Int16Array(N).fill(-1);
  const current = new Int32Array(N);
  let empty = N - 2 * pairs.length;
  for (const c of f.stalls ?? []) {
    owner[c] = BLOCKED;
    empty--;
  }
  for (const c of f.bridges ?? []) {
    owner[c] = BRIDGE;
    empty++; // two lanes instead of one cell
  }
  for (const l of f.lanterns ?? []) lantern[l.cell] = l.pair;
  for (const c of f.currents ?? []) current[c.cell] = c.dir;

  const P = pairs.length;
  const head = new Int32Array(P);
  const target = new Int32Array(P);
  const done = new Uint8Array(P);
  pairs.forEach((p, k) => {
    owner[p.a] = k;
    owner[p.b] = k;
    head[k] = p.a;
    target[k] = p.b;
  });
  let count = 0;
  let nodes = 0;
  let aborted = false;
  const mark = new Int32Array(N);
  let stamp = 0;

  const laneFree = (b: number, d: number) => (d === 1 || d === -1 ? laneH[b] : laneV[b]) === FREE;
  /** A live head or target: a canal end that can still connect to a neighbour. */
  const liveEnd = (c: number) => {
    const o = owner[c];
    return o >= 0 && !done[o] && (head[o] === c || target[o] === c);
  };
  /** Could a canal come into c from its neighbour m (direction m -> c)? */
  const openFrom = (m: number, c: number) => {
    const o = owner[m];
    if (o === FREE || liveEnd(m)) return true;
    return o === BRIDGE && laneFree(m, c - m);
  };

  function feasible(): boolean {
    for (let c = 0; c < N; c++) {
      const o = owner[c];
      if (o === FREE) {
        // 1. Every empty cell needs two ways in/out; a current cell needs exactly its own two.
        if (current[c]) {
          const a = step(c, -current[c]), b = step(c, current[c]);
          if (a < 0 || b < 0 || !openFrom(a, c) || !openFrom(b, c)) return false;
        } else {
          let open = 0;
          for (const m of nbr[c]) if (openFrom(m, c)) open++;
          if (open < 2) return false;
        }
        // A lantern whose canal is already finished can no longer be lit.
        if (lantern[c] >= 0 && done[lantern[c]]) return false;
      } else if (o === BRIDGE) {
        // A free lane needs both of its sides open.
        for (const d of [1, n]) {
          if (!laneFree(c, d)) continue;
          const a = step(c, -d), b = step(c, d);
          if (a < 0 || b < 0 || !openFrom(a, c) || !openFrom(b, c)) return false;
        }
      }
    }
    // 2. Every live pair must still be able to reach its target (bridges count as passable).
    const passable = (m: number, k: number) => (owner[m] === FREE && (lantern[m] < 0 || lantern[m] === k)) || (owner[m] === BRIDGE && (laneH[m] === FREE || laneV[m] === FREE));
    for (let k = 0; k < P; k++) {
      if (done[k]) continue;
      stamp++;
      const stack = [head[k]];
      mark[head[k]] = stamp;
      let ok = false;
      while (stack.length && !ok) {
        const c = stack.pop()!;
        for (const m of nbr[c]) {
          if (m === target[k]) {
            ok = true;
            break;
          }
          if (mark[m] !== stamp && passable(m, k)) {
            mark[m] = stamp;
            stack.push(m);
          }
        }
      }
      if (!ok) return false;
    }
    // 3. Every empty region must be fillable by some live pair touching it at both ends.
    stamp++;
    const regionStamp = stamp;
    const inRegion = (m: number) => owner[m] === FREE || (owner[m] === BRIDGE && (laneH[m] === FREE || laneV[m] === FREE));
    for (let c = 0; c < N; c++) {
      if (owner[c] !== FREE || mark[c] === regionStamp) continue;
      const region: number[] = [c];
      mark[c] = regionStamp;
      const touchHead = new Set<number>();
      const touchTarget = new Set<number>();
      for (let r = 0; r < region.length; r++) {
        for (const m of nbr[region[r]]) {
          const o = owner[m];
          if (inRegion(m)) {
            if (mark[m] !== regionStamp) {
              mark[m] = regionStamp;
              region.push(m);
            }
          } else if (o >= 0 && !done[o]) {
            if (head[o] === m) touchHead.add(o);
            if (target[o] === m) touchTarget.add(o);
          }
        }
      }
      let served = false;
      for (const k of touchHead) if (touchTarget.has(k)) served = true;
      if (!served) return false;
    }
    return true;
  }

  /** Can pair k step from `from` into normal cell m (lanterns and currents allowing)? */
  const canEnter = (k: number, from: number, m: number) => {
    const d = m - from;
    if (current[from] && current[from] !== d) return false;
    if (m === target[k]) return true;
    if (owner[m] !== FREE) return false;
    if (lantern[m] >= 0 && lantern[m] !== k) return false;
    return !current[m] || current[m] === d;
  };

  /** Moves for pair k: [next head, bridge crossed on the way or -1]. */
  function moves(k: number): [number, number][] {
    const res: [number, number][] = [];
    const h = head[k];
    for (const m of nbr[h]) {
      if (owner[m] === BRIDGE) {
        const d = m - h;
        if (!laneFree(m, d) || (current[h] && current[h] !== d)) continue;
        const nx = step(m, d);
        if (nx >= 0 && owner[nx] !== BRIDGE && canEnter(k, m, nx)) res.push([nx, m]);
      } else if (canEnter(k, h, m)) res.push([m, -1]);
    }
    return res;
  }

  function setLane(b: number, d: number, v: number) {
    if (d === 1 || d === -1) laneH[b] = v;
    else laneV[b] = v;
  }

  function rec() {
    if (aborted || count >= limit) return;
    if (++nodes > budget) {
      aborted = true;
      return;
    }
    // Pick the most constrained live pair.
    let best = -1;
    let bestMoves: [number, number][] = [];
    for (let k = 0; k < P; k++) {
      if (done[k]) continue;
      const mv = moves(k);
      if (mv.length === 0) return;
      if (best < 0 || mv.length < bestMoves.length) {
        best = k;
        bestMoves = mv;
        if (mv.length === 1) break;
      }
    }
    if (best < 0) {
      if (empty === 0) count++;
      return;
    }
    const k = best;
    for (const [m, br] of bestMoves) {
      const prev = head[k];
      if (br >= 0) {
        setLane(br, br - prev, k);
        empty--;
      }
      if (m === target[k]) {
        done[k] = 1;
        if (feasible()) rec();
        done[k] = 0;
      } else {
        owner[m] = k;
        head[k] = m;
        empty--;
        if (feasible()) rec();
        empty++;
        head[k] = prev;
        owner[m] = FREE;
      }
      if (br >= 0) {
        setLane(br, br - prev, FREE);
        empty++;
      }
      if (aborted || count >= limit) return;
    }
  }

  if (feasible()) rec();
  return { count, nodes, aborted };
}
