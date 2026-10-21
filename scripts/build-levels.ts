/**
 * Offline level builder: `npm run levels`.
 *
 * For every picture of the journey it searches for a canal layout that
 *  1. has exactly one solution (checked by the exact solver),
 *  2. follows the picture's colour regions (so the reveal feels earned),
 *  3. is as demanding as possible for its grid size (solver search size as difficulty).
 * Local search: start from generated layouts, then mutate (move a cell between touching
 * canal ends, split a canal, join two canals) while the score improves.
 * Output: src/puzzle/levels.json (pairs + solution per picture).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { Rng } from '../src/core/rng';
import { CHAPTERS } from '../src/puzzle/chapters';
import { pictureById, pictureColors } from '../src/puzzle/pictures';
import { type Features, generateLevel, neighbors, pathColor, puzzleColors, targetPairs } from '../src/puzzle/puzzle';
import { solve } from '../src/puzzle/solver';

interface Built {
  id: string;
  paths: number[][];
  nodes: number;
}

const CAP = 24;

function evaluate(n: number, paths: number[][], layout: number[], target: number, maxLog: number) {
  const pairs = paths.map((p) => ({ a: p[0], b: p[p.length - 1] }));
  const r = solve(n, pairs, CAP, 250_000);
  const count = r.aborted ? CAP : r.count;
  let mismatch = 0;
  for (const p of paths) {
    const c = pathColor(p, layout);
    for (const x of p) if (layout[x] !== c) mismatch++;
  }
  const pairPenalty = Math.max(0, Math.abs(paths.length - target) - 1) * 3;
  // Uniqueness first, then fidelity to the picture, then difficulty (more search = better).
  const score = (count - 1) * 100 + mismatch * 1.5 + pairPenalty - (count === 1 ? Math.min(Math.log2(1 + r.nodes), maxLog) * 3 : 0);
  return { score, count, nodes: r.nodes };
}

function mutate(paths: number[][], n: number, rng: Rng): number[][] | null {
  const ps = paths.map((p) => p.slice());
  const op = rng.next();
  const adj = (a: number, b: number) => neighbors(a, n).includes(b);
  if (op < 0.6) {
    // Move one end cell of a canal onto the touching end of another canal.
    const i = rng.int(0, ps.length);
    const A = ps[i];
    if (A.length <= 3) return null;
    const fromStart = rng.next() < 0.5;
    const e = fromStart ? A[0] : A[A.length - 1];
    const cands: [number, boolean][] = [];
    ps.forEach((B, j) => {
      if (j === i) return;
      if (adj(e, B[0])) cands.push([j, true]);
      if (adj(e, B[B.length - 1])) cands.push([j, false]);
    });
    if (!cands.length) return null;
    const [j, atStart] = rng.pick(cands);
    if (fromStart) A.shift();
    else A.pop();
    if (atStart) ps[j].unshift(e);
    else ps[j].push(e);
    return ps;
  }
  if (op < 0.8) {
    const i = rng.int(0, ps.length);
    const A = ps[i];
    if (A.length < 6) return null;
    const cut = rng.int(3, A.length - 2);
    ps.splice(i, 1, A.slice(0, cut), A.slice(cut));
    return ps;
  }
  // Join two canals whose ends touch.
  const pairs: [number, number, boolean, boolean][] = [];
  for (let i = 0; i < ps.length; i++)
    for (let j = 0; j < ps.length; j++) {
      if (i === j) continue;
      for (const ai of [true, false]) for (const bj of [true, false]) {
        const a = ai ? ps[i][ps[i].length - 1] : ps[i][0];
        const b = bj ? ps[j][0] : ps[j][ps[j].length - 1];
        if (adj(a, b)) pairs.push([i, j, ai, bj]);
      }
    }
  if (!pairs.length) return null;
  const [i, j, ai, bj] = rng.pick(pairs);
  const A = ai ? ps[i] : ps[i].slice().reverse();
  const B = bj ? ps[j] : ps[j].slice().reverse();
  const merged = [...A, ...B];
  const rest = ps.filter((_, k) => k !== i && k !== j);
  return [...rest, merged];
}

function build(id: string, seed: number, maxLog: number): Built {
  const pic = pictureById(id);
  const n = pic.rows.length;
  const layout = puzzleColors(pictureColors(pic), n);
  const target = targetPairs(n);
  const rng = new Rng(seed);
  let best: { paths: number[][]; score: number; count: number; nodes: number } | null = null;
  for (let restart = 0; restart < 10; restart++) {
    let cur = generateLevel(pic, seed * 31 + restart, { attempts: 20 }).solution;
    let ev = evaluate(n, cur, layout, target, maxLog);
    const iters = n <= 6 ? 250 : n <= 7 ? 400 : 700;
    for (let it = 0; it < iters; it++) {
      const cand = mutate(cur, n, rng);
      if (!cand) continue;
      const e2 = evaluate(n, cand, layout, target, maxLog);
      if (e2.score <= ev.score || rng.next() < 0.02) {
        cur = cand;
        ev = e2;
      }
      if (ev.count === 1 && (!best || ev.score < best.score)) best = { paths: cur.map((p) => p.slice()), ...ev };
    }
    if (best && restart >= 2) break;
  }
  if (!best) throw new Error(`no unique layout for ${id}`);
  return { id, paths: best.paths, nodes: best.nodes };
}

// ------------------------------------------------------------------ chapter mechanics

type Paths = number[][];
const pairsOf = (paths: Paths) => paths.map((p) => ({ a: p[0], b: p[p.length - 1] }));
const count = (n: number, paths: Paths, f: Features, cap = 24) => {
  const r = solve(n, pairsOf(paths), cap, 150_000, f);
  return r.aborted ? cap : r.count;
};

/**
 * Harbour: where a canal runs straight, reroute the canals above and below it so one of
 * them crosses it over a bridge (the cut-off pieces become canals of their own).
 */
function addBridges(n: number, paths: Paths, want: number, rng: Rng): { paths: Paths; f: Features } {
  let cur = paths.map((p) => p.slice());
  const bridges: number[] = [];
  for (let k = 0; k < want; k++) {
    const at = new Map<number, [number, number]>();
    cur.forEach((p, i) => p.forEach((c, j) => at.set(c, [i, j])));
    const cands: [Paths, number][] = [];
    cur.forEach((A, ia) => {
      for (let j = 1; j < A.length - 1; j++) {
        const c = A[j], d = c - A[j - 1];
        if (A[j + 1] - c !== d) continue;
        const x = c % n, y = Math.floor(c / n);
        if (x < 1 || y < 1 || x > n - 2 || y > n - 2) continue;
        if (bridges.some((b) => b === c || neighbors(b, n).includes(c))) continue;
        const p = Math.abs(d) === 1 ? n : 1;
        const [ib, jb] = at.get(c - p)!, [ic, jc] = at.get(c + p)!;
        if (ib === ia || ic === ia || ib === ic || bridges.includes(c - p) || bridges.includes(c + p)) continue;
        const B = cur[ib], C = cur[ic];
        // The part of B that ends next to c, and the part of C that starts next to c.
        for (const [inB, restB] of [[B.slice(0, jb + 1), B.slice(jb + 1)], [B.slice(jb).reverse(), B.slice(0, jb)]])
          for (const [inC, restC] of [[C.slice(jc), C.slice(0, jc)], [C.slice(0, jc + 1).reverse(), C.slice(jc + 1)]]) {
            if ((restB.length && restB.length < 3) || (restC.length && restC.length < 3)) continue;
            const next = cur.filter((_, i) => i !== ib && i !== ic);
            next.push([...inB, c, ...inC]);
            if (restB.length) next.push(restB);
            if (restC.length) next.push(restC);
            if (next.length > 13) continue;
            cands.push([next, c]);
          }
      }
    });
    let ok = false;
    for (const i of rng.shuffle(cands.map((_, i) => i)).slice(0, 60)) {
      if (count(n, cands[i][0], { bridges: [...bridges, cands[i][1]] }, 2) === 1) {
        cur = cands[i][0];
        bridges.push(cands[i][1]);
        ok = true;
        break;
      }
    }
    if (!ok) break;
  }
  return { paths: cur, f: { bridges } };
}

/** Market: café terraces take the last cell of some canals; canals go around them. */
function addStalls(n: number, paths: Paths, want: number, rng: Rng): { paths: Paths; f: Features } {
  let cur = paths.map((p) => p.slice());
  const stalls: number[] = [];
  for (let k = 0; k < want; k++) {
    const cands: [Paths, number][] = [];
    cur.forEach((p, i) => {
      if (p.length < 4) return;
      for (const atEnd of [false, true]) {
        const cell = atEnd ? p[p.length - 1] : p[0];
        if (stalls.some((s) => neighbors(s, n).includes(cell))) continue;
        const np = atEnd ? p.slice(0, -1) : p.slice(1);
        cands.push([cur.map((q, j) => (j === i ? np : q)), cell]);
      }
    });
    let ok = false;
    for (const i of rng.shuffle(cands.map((_, i) => i))) {
      if (count(n, cands[i][0], { stalls: [...stalls, cands[i][1]] }, 2) === 1) {
        cur = cands[i][0];
        stalls.push(cands[i][1]);
        ok = true;
        break;
      }
    }
    if (!ok) break;
  }
  return { paths: cur, f: { stalls } };
}

/**
 * Night and sunken city: join two canals (the layout now has several solutions), then add
 * the fewest lanterns (or currents) taken from the intended solution until it is unique
 * again. The markers are then needed to reason, not decoration.
 */
function addMarkers(n: number, paths: Paths, kind: 'lanterns' | 'currents', maxMarkers: number, rng: Rng): { paths: Paths; f: Features } {
  const build = (marks: number[], ps: Paths): Features => {
    const at = new Map<number, [number, number]>();
    ps.forEach((p, k) => p.forEach((c, j) => at.set(c, [k, j])));
    if (kind === 'lanterns') return { lanterns: marks.map((c) => ({ cell: c, pair: at.get(c)![0] })) };
    return {
      currents: marks.map((c) => {
        const [k, j] = at.get(c)!;
        return { cell: c, dir: ps[k][j + 1] - ps[k][j] };
      }),
    };
  };
  const candidates = (ps: Paths) => {
    const res: number[] = [];
    for (const p of ps)
      for (let j = 1; j < p.length - 1; j++) {
        if (kind === 'currents' && p[j + 1] - p[j] !== p[j] - p[j - 1]) continue;
        res.push(p[j]);
      }
    return res;
  };
  const joins: Paths[] = [];
  for (let i = 0; i < paths.length; i++)
    for (let j = 0; j < paths.length; j++) {
      if (i === j) continue;
      const a = paths[i][paths[i].length - 1];
      if (neighbors(a, n).includes(paths[j][0])) joins.push([...paths.filter((_, k) => k !== i && k !== j), [...paths[i], ...paths[j]]]);
    }
  for (const ps of rng.shuffle(joins).slice(0, 12)) {
    const marks: number[] = [];
    let c = count(n, ps, build(marks, ps));
    while (c > 1 && marks.length < maxMarkers) {
      let best = -1, bestC = c;
      for (const cell of candidates(ps)) {
        if (marks.includes(cell)) continue;
        const cc = count(n, ps, build([...marks, cell], ps));
        if (cc < bestC) {
          bestC = cc;
          best = cell;
        }
      }
      if (best < 0) break;
      marks.push(best);
      c = bestC;
    }
    if (c === 1 && marks.length > 0) return { paths: ps, f: build(marks, ps) };
  }
  // Fallback: the original unique layout with one marker on its longest canal.
  const longest = paths.reduce((a, b) => (b.length > a.length ? b : a));
  const cands = candidates([longest]);
  return { paths, f: cands.length ? build([cands[Math.floor(cands.length / 2)]], paths) : {} };
}

/** Adds the chapter's mechanic to a unique base layout, keeping the solution unique. */
function withMechanic(ci: number, li: number, n: number, base: Paths, seed: number): { paths: Paths; f: Features } | null {
  const rng = new Rng(seed);
  switch (ci) {
    case 1: return addBridges(n, base, li === 0 ? 1 : 1 + (li % 3), rng);
    case 2: return addStalls(n, base, li === 0 ? 1 : 2 + (li % 3), rng);
    case 3: return addMarkers(n, base, 'lanterns', li === 0 ? 2 : 4, rng);
    case 4: return addMarkers(n, base, 'currents', li === 0 ? 2 : 4, rng);
  }
  return null;
}

// Already-built levels are kept (delete the file or pass --force to rebuild everything).
const file = new URL('../src/puzzle/levels.json', import.meta.url);
const force = process.argv.includes('--force');
const out: Record<string, { paths: number[][]; nodes: number; base?: number[][]; f?: Features }> = !force && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
const only = process.argv.slice(2).find((a) => !a.startsWith('--'));
// Difficulty ceiling per chapter (log2 of solver nodes): gentle garden, demanding night.
const MAX_LOG = [5, 8, 11, 14, 14];
CHAPTERS.forEach((ch, ci) => {
  for (const id of ch.pictures) {
    if (only && id !== only) continue;
    if (!only && out[id]) continue;
    const t0 = Date.now();
    let b: Built;
    try {
      b = build(id, 7, MAX_LOG[ci]);
    } catch (e) {
      console.log(`${ch.id.padEnd(8)} ${id.padEnd(11)} SKIPPED (${(e as Error).message})`);
      continue;
    }
    // Double-check uniqueness with a generous budget.
    const r = solve(pictureById(id).rows.length, b.paths.map((p) => ({ a: p[0], b: p[p.length - 1] })), 2, 3_000_000);
    if (r.count !== 1 || r.aborted) throw new Error(`${id} not verified unique`);
    out[id] = { paths: b.paths, nodes: b.nodes };
    console.log(`${ch.id.padEnd(8)} ${id.padEnd(11)} ${pictureById(id).rows.length}x  pairs ${String(b.paths.length).padStart(2)}  difficulty ${String(b.nodes).padStart(6)}  ${Date.now() - t0}ms`);
    if (!only) writeFileSync(file, JSON.stringify(out) + '\n');
  }
});

// Chapter mechanics on top of the base layouts (`--mechanics`, `--mechanics=force` to redo them).
const mech = process.argv.find((a) => a.startsWith('--mechanics'));
if (mech) {
  CHAPTERS.forEach((ch, ci) => {
    ch.pictures.forEach((id, li) => {
      const o = out[id];
      if (!o || ci === 0 || (o.f && !mech.endsWith('=force')) || (only && id !== only)) return;
      const t0 = Date.now();
      const n = pictureById(id).rows.length;
      const base = o.base ?? o.paths;
      const r = withMechanic(ci, li, n, base, 11 + li);
      if (!r) return;
      const v = solve(n, pairsOf(r.paths), 2, 3_000_000, r.f);
      if (v.count !== 1 || v.aborted) throw new Error(`${id} with mechanic not unique`);
      out[id] = { paths: r.paths, nodes: v.nodes, base, f: r.f };
      const marks = Object.values(r.f).reduce((a, x) => a + (x as unknown[]).length, 0);
      console.log(`${ch.id.padEnd(8)} ${id.padEnd(11)} pairs ${String(base.length).padStart(2)}->${String(r.paths.length).padStart(2)}  ${(Object.keys(r.f)[0] ?? '-').padEnd(8)} ${marks}  difficulty ${String(v.nodes).padStart(6)}  ${Date.now() - t0}ms`);
      writeFileSync(file, JSON.stringify(out) + '\n');
    });
  });
}
