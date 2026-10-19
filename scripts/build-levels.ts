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
import { generateLevel, neighbors, pathColor, puzzleColors, targetPairs } from '../src/puzzle/puzzle';
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

// Already-built levels are kept (delete the file or pass --force to rebuild everything).
const file = new URL('../src/puzzle/levels.json', import.meta.url);
const force = process.argv.includes('--force');
const out: Record<string, { paths: number[][]; nodes: number }> = !force && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
const only = process.argv.slice(2).find((a) => !a.startsWith('--'));
// Difficulty ceiling per chapter (log2 of solver nodes): gentle garden, demanding night.
const MAX_LOG = [5, 8, 11, 14];
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
