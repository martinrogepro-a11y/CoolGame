import { describe, expect, it } from 'vitest';
import { DISTRICTS } from '../src/game/content';
import { Sim } from '../src/game/sim';
import { playBot } from './bot';

describe('balance (greedy bot)', () => {
  for (const d of DISTRICTS) {
    it(`${d.id}: runs last a few minutes and score grows`, () => {
      const times: number[] = [];
      const scores: number[] = [];
      for (let seed = 1; seed <= 12; seed++) {
        const sim = new Sim({ district: d, seed });
        times.push(playBot(sim));
        scores.push(sim.stats.score);
      }
      const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
      const med = (a: number[]) => a.slice().sort((x, y) => x - y)[a.length >> 1];
      console.log(`${d.id.padEnd(12)} time avg ${avg(times).toFixed(0)}s med ${med(times).toFixed(0)}s min ${Math.min(...times).toFixed(0)} max ${Math.max(...times).toFixed(0)} | score avg ${avg(scores).toFixed(0)} med ${med(scores)}`);
      expect(med(times)).toBeGreaterThan(150);
      expect(med(times)).toBeLessThan(1500);
    });
  }
});
