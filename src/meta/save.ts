import { dayKey, daysBetween, hashString, Rng } from '../core/rng';
import { storage } from '../core/storage';
import { DISTRICTS } from '../game/content';
import type { RunStats } from '../game/sim';
import { FRESCOES, frescoNeeds } from './frescoes';
import { LANDMARKS, type Landmark } from './landmarks';

const KEY = 'tessera.save.v1';

export type MissionKind = 'deliver_color' | 'score' | 'weeks' | 'bridges' | 'runs' | 'combo';

export interface Mission {
  id: string;
  kind: MissionKind;
  color?: number;
  goal: number;
  progress: number;
  reward: number;
  claimed: boolean;
}

export interface SaveData {
  v: 1;
  tesserae: number[];
  lifetime: number;
  runs: number;
  best: Record<string, number>;
  district: string;
  built: string[];
  palettes: string[];
  palette: string;
  settings: { sound: boolean; haptics: boolean; lang: 'auto' | 'en' | 'fr'; colorblind: boolean };
  streak: { count: number; best: number; lastDay: string };
  daily: { day: string; played: boolean; best: number };
  missions: { day: string; list: Mission[] };
  purchases: { noAds: boolean; patron: boolean };
  ads: { runsSinceInterstitial: number; lastInterstitial: number };
  tutorialDone: boolean;
  firstDay: string;
  /** Pending gift shown on the home screen (e.g. streak milestone). */
  gift: number;
  /** Current fresco and how many tiles of each material are already laid in it. */
  fresco: { idx: number; filled: number[] };
  frescoesDone: string[];
}

export const FRESCO_REWARD = 100;

export function freshSave(): SaveData {
  const today = dayKey();
  return {
    v: 1,
    tesserae: [0, 0, 0, 0, 0],
    lifetime: 0,
    runs: 0,
    best: {},
    district: DISTRICTS[0].id,
    built: [],
    palettes: ['paper'],
    palette: 'paper',
    settings: { sound: true, haptics: true, lang: 'auto', colorblind: false },
    streak: { count: 0, best: 0, lastDay: '' },
    daily: { day: '', played: false, best: 0 },
    missions: { day: '', list: [] },
    purchases: { noAds: false, patron: false },
    ads: { runsSinceInterstitial: 0, lastInterstitial: 0 },
    tutorialDone: false,
    firstDay: today,
    gift: 0,
    fresco: { idx: 0, filled: [0, 0, 0, 0, 0] },
    frescoesDone: [],
  };
}

/** Merges a loaded save onto defaults so new fields always exist after updates. */
export function migrate(raw: unknown): SaveData {
  const base = freshSave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SaveData>;
  return {
    ...base,
    ...r,
    tesserae: base.tesserae.map((_, i) => r.tesserae?.[i] ?? 0),
    settings: { ...base.settings, ...(r.settings ?? {}) },
    streak: { ...base.streak, ...(r.streak ?? {}) },
    daily: { ...base.daily, ...(r.daily ?? {}) },
    missions: { ...base.missions, ...(r.missions ?? {}) },
    purchases: { ...base.purchases, ...(r.purchases ?? {}) },
    ads: { ...base.ads, ...(r.ads ?? {}) },
    best: { ...(r.best ?? {}) },
    fresco: { idx: r.fresco?.idx ?? 0, filled: base.fresco.filled.map((_, i) => r.fresco?.filled?.[i] ?? 0) },
    frescoesDone: [...(r.frescoesDone ?? [])],
    v: 1,
  };
}

export let save: SaveData = freshSave();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export async function loadSave(): Promise<SaveData> {
  const txt = await storage.get(KEY);
  try {
    save = migrate(txt ? JSON.parse(txt) : null);
  } catch {
    save = freshSave();
  }
  refreshDaily(save);
  return save;
}

export function persist(now = false) {
  if (saveTimer) clearTimeout(saveTimer);
  const write = () => void storage.set(KEY, JSON.stringify(save));
  if (now) write();
  else saveTimer = setTimeout(write, 300);
}

// ------------------------------------------------------------------ daily loop

const MISSION_TEMPLATES: { kind: MissionKind; goals: number[]; reward: number }[] = [
  { kind: 'deliver_color', goals: [25, 40, 60], reward: 30 },
  { kind: 'score', goals: [60, 90, 130], reward: 40 },
  { kind: 'weeks', goals: [4, 6, 8], reward: 40 },
  { kind: 'bridges', goals: [2, 4], reward: 25 },
  { kind: 'runs', goals: [2, 3], reward: 25 },
  { kind: 'combo', goals: [6, 10, 14], reward: 35 },
];

export function makeMissions(day: string): Mission[] {
  const rng = new Rng(hashString('missions' + day));
  const kinds = rng.shuffle(MISSION_TEMPLATES.slice()).slice(0, 3);
  return kinds.map((t, k) => {
    const goal = rng.pick(t.goals);
    return {
      id: `${day}-${k}`,
      kind: t.kind,
      color: t.kind === 'deliver_color' ? rng.int(0, 2) : undefined,
      goal,
      progress: 0,
      reward: t.reward + Math.round(goal / 5),
      claimed: false,
    };
  });
}

/** Rolls over missions and the daily challenge when the calendar day changes. */
export function refreshDaily(s: SaveData, today = dayKey()) {
  if (s.missions.day !== today) s.missions = { day: today, list: makeMissions(today) };
  if (s.daily.day !== today) s.daily = { day: today, played: false, best: 0 };
  if (s.streak.lastDay && daysBetween(s.streak.lastDay, today) > 1) s.streak.count = 0;
}

/** Records that the player played today; extends the streak once per day. */
export function touchStreak(s: SaveData, today = dayKey()): boolean {
  if (s.streak.lastDay === today) return false;
  const gap = s.streak.lastDay ? daysBetween(s.streak.lastDay, today) : 99;
  s.streak.count = gap === 1 ? s.streak.count + 1 : 1;
  s.streak.best = Math.max(s.streak.best, s.streak.count);
  s.streak.lastDay = today;
  // Milestone gifts keep the habit rewarding.
  if (s.streak.count % 7 === 0) s.gift += 150;
  else if (s.streak.count % 3 === 0) s.gift += 40;
  if (s.streak.count >= 7 && !s.palettes.includes('sakura')) s.palettes.push('sakura');
  return true;
}

export function dailySeed(day = dayKey()): number {
  return hashString('daily' + day);
}

export function dailyDistrict(day = dayKey()): string {
  return DISTRICTS[hashString('dd' + day) % DISTRICTS.length].id;
}

// ------------------------------------------------------------------ runs & economy

export interface FrescoStep {
  /** Fresco state before the run, for the reveal animation. */
  before: { idx: number; filled: number[] };
  laid: number;
  completed: string[];
}

/**
 * Lays delivered tiles into the current fresco; overflow continues into the next one.
 * Frescoes only take tiles, they never cost tesserae.
 */
export function layFresco(s: SaveData, delivered: number[]): FrescoStep {
  const step: FrescoStep = { before: { idx: s.fresco.idx, filled: s.fresco.filled.slice() }, laid: 0, completed: [] };
  const pool = delivered.slice();
  while (s.fresco.idx < FRESCOES.length) {
    const f = FRESCOES[s.fresco.idx];
    const need = frescoNeeds(f);
    for (let c = 0; c < need.length; c++) {
      const take = Math.max(0, Math.min(pool[c] ?? 0, need[c] - s.fresco.filled[c]));
      s.fresco.filled[c] += take;
      pool[c] -= take;
      step.laid += take;
    }
    if (!need.every((n, c) => s.fresco.filled[c] >= n)) break;
    step.completed.push(f.id);
    s.frescoesDone.push(f.id);
    grantSpread(s, FRESCO_REWARD);
    s.fresco = { idx: s.fresco.idx + 1, filled: [0, 0, 0, 0, 0] };
  }
  return step;
}

export interface RunResult {
  fresco: FrescoStep;
  earned: number[];
  total: number;
  newBest: boolean;
  missionsDone: Mission[];
  unlockedDistricts: string[];
  revealed: Landmark[];
}

export function districtUnlocked(s: SaveData, id: string): boolean {
  const d = DISTRICTS.find((x) => x.id === id);
  return !!d && (s.lifetime >= d.unlockAt || s.purchases.patron);
}

/** Applies the end-of-run rewards. `multiplier` is 2 when the player watched the bonus ad. */
export function applyRun(s: SaveData, stats: RunStats, district: string, daily: boolean): RunResult {
  const before = s.lifetime;
  const unlockedBefore = DISTRICTS.filter((d) => districtUnlocked(s, d.id)).map((d) => d.id);
  const boost = s.purchases.patron ? 1.5 : 1;
  const earned = stats.delivered.map((n) => Math.round(n * boost));
  earned.forEach((n, i) => (s.tesserae[i] += n));
  const total = earned.reduce((a, b) => a + b, 0);
  s.lifetime += total;
  s.runs++;
  const key = daily ? 'daily' : district;
  const newBest = stats.score > (s.best[key] ?? 0);
  if (newBest) s.best[key] = stats.score;
  if (daily) {
    s.daily.played = true;
    s.daily.best = Math.max(s.daily.best, stats.score);
  }
  touchStreak(s);

  const done: Mission[] = [];
  for (const m of s.missions.list) {
    if (m.claimed || m.progress >= m.goal) continue;
    switch (m.kind) {
      case 'deliver_color': m.progress += stats.delivered[m.color ?? 0]; break;
      case 'score': m.progress = Math.max(m.progress, stats.score); break;
      case 'weeks': m.progress = Math.max(m.progress, stats.weeks); break;
      case 'bridges': m.progress += stats.bridgesUsed; break;
      case 'runs': m.progress += 1; break;
      case 'combo': m.progress = Math.max(m.progress, stats.bestCombo); break;
    }
    m.progress = Math.min(m.progress, m.goal);
    if (m.progress >= m.goal) done.push(m);
  }

  if (s.lifetime >= 200 && !s.palettes.includes('night')) s.palettes.push('night');
  if ((s.best['peaks'] ?? 0) >= 100 && !s.palettes.includes('dune')) s.palettes.push('dune');
  const unlockedDistricts = DISTRICTS.filter((d) => districtUnlocked(s, d.id) && !unlockedBefore.includes(d.id)).map((d) => d.id);
  const revealed = LANDMARKS.filter((l) => !l.premium && l.revealAt > before && l.revealAt <= s.lifetime);
  const fresco = layFresco(s, stats.delivered);
  return { fresco, earned, total, newBest, missionsDone: done, unlockedDistricts, revealed };
}

/** Doubles the tesserae of a finished run (rewarded ad). */
export function doubleRun(s: SaveData, r: RunResult) {
  r.earned.forEach((n, i) => (s.tesserae[i] += n));
  s.lifetime += r.total;
  r.earned = r.earned.map((n) => n * 2);
  r.total *= 2;
}

export function claimMission(s: SaveData, id: string): number {
  const m = s.missions.list.find((x) => x.id === id);
  if (!m || m.claimed || m.progress < m.goal) return 0;
  m.claimed = true;
  grantSpread(s, m.reward);
  return m.reward;
}

/** Spreads a generic tesserae reward over the unlocked materials, weakest first. */
export function grantSpread(s: SaveData, amount: number) {
  const n = 4;
  for (let k = 0; k < amount; k++) {
    let min = 0;
    for (let i = 1; i < n; i++) if (s.tesserae[i] < s.tesserae[min]) min = i;
    s.tesserae[min]++;
  }
  s.lifetime += amount;
}

export function canBuild(s: SaveData, l: Landmark): boolean {
  if (s.built.includes(l.id)) return false;
  if (l.premium) return s.purchases.patron;
  if (s.lifetime < l.revealAt) return false;
  return l.cost.every((c, i) => s.tesserae[i] >= c);
}

export function build(s: SaveData, l: Landmark): boolean {
  if (!canBuild(s, l)) return false;
  l.cost.forEach((c, i) => (s.tesserae[i] -= c));
  s.built.push(l.id);
  return true;
}
