/**
 * Exact solver for canal puzzles (link every pair, cover every cell, no crossing).
 * Used offline to keep only levels with a unique solution and to grade difficulty
 * by the size of the search tree a solver needs.
 */

export interface SolveResult {
  /** Solutions found, capped at the requested limit. */
  count: number;
  /** Search nodes visited: a proxy for how much reasoning the level demands. */
  nodes: number;
  /** True if the node budget ran out before the search finished. */
  aborted: boolean;
}

export function solve(n: number, pairs: { a: number; b: number }[], limit = 2, budget = 400_000): SolveResult {
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
  const owner = new Int16Array(N).fill(-1);
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
  let empty = N - 2 * P;
  let count = 0;
  let nodes = 0;
  let aborted = false;
  const mark = new Int32Array(N);
  let stamp = 0;

  /** Cells a live pair can still use: empty cells, plus its own head and target. */
  const isOpenFor = (c: number) => owner[c] === -1;

  function feasible(): boolean {
    // 1. Every empty cell needs two ways in/out (empty neighbours or live heads/targets).
    for (let c = 0; c < N; c++) {
      if (owner[c] !== -1) continue;
      let open = 0;
      for (const m of nbr[c]) {
        const o = owner[m];
        if (o === -1 || (!done[o] && (head[o] === m || target[o] === m))) open++;
      }
      if (open < 2) return false;
    }
    // 2. Every live pair must still be able to reach its target through empty cells.
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
          if (mark[m] !== stamp && isOpenFor(m)) {
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
    for (let c = 0; c < N; c++) {
      if (owner[c] !== -1 || mark[c] === regionStamp) continue;
      const region: number[] = [c];
      mark[c] = regionStamp;
      const touchHead = new Set<number>();
      const touchTarget = new Set<number>();
      for (let r = 0; r < region.length; r++) {
        for (const m of nbr[region[r]]) {
          const o = owner[m];
          if (o === -1) {
            if (mark[m] !== regionStamp) {
              mark[m] = regionStamp;
              region.push(m);
            }
          } else if (!done[o]) {
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

  function moves(k: number): number[] {
    const res: number[] = [];
    for (const m of nbr[head[k]]) if (m === target[k] || owner[m] === -1) res.push(m);
    return res;
  }

  function rec() {
    if (aborted || count >= limit) return;
    if (++nodes > budget) {
      aborted = true;
      return;
    }
    // Pick the most constrained live pair.
    let best = -1;
    let bestMoves: number[] = [];
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
    for (const m of bestMoves) {
      if (m === target[k]) {
        done[k] = 1;
        if (feasible() || P === 0) rec();
        done[k] = 0;
      } else {
        const prev = head[k];
        owner[m] = k;
        head[k] = m;
        empty--;
        if (feasible()) rec();
        empty++;
        head[k] = prev;
        owner[m] = -1;
      }
      if (aborted || count >= limit) return;
    }
  }

  if (feasible()) rec();
  return { count, nodes, aborted };
}
