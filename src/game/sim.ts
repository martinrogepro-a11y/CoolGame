import { hashString, Rng } from '../core/rng';
import type { District } from './content';
import { generateTerrain, T } from './terrain';

/** Directions: 0 = N, 1 = E, 2 = S, 3 = W. */
export type Dir = 0 | 1 | 2 | 3;
export const DX = [0, 1, 0, -1] as const;
export const DY = [-1, 0, 1, 0] as const;
export const opposite = (d: Dir): Dir => ((d + 2) & 3) as Dir;

export const TUNING = {
  W: 9,
  H: 14,
  START_W: 5,
  START_H: 7,
  SPACING: 0.5,
  BELT_SPEED: 1.5,
  EMIT_PERIOD: 2.4,
  SOURCE_BUFFER: 3,
  STOCK_CAP: 2,
  ORDER_START: 12,
  ORDER_MIN: 5.5,
  ORDER_DECAY: 0.012,
  OVERFLOW_AT: 4,
  OVERFLOW_TIME: 28,
  OVERFLOW_DRAIN: 10,
  WEEK: 45,
  SITE_SPAWN_START: 18,
  SITE_SPAWN_MIN: 8,
  SITE_SPAWN_RAMP: 0.02,
  SITES_PER_SOURCE: 2.2,
  WEEK_BONUS_BELTS: 4,
  /** A free bridge every N weeks. */
  WEEK_BONUS_BRIDGE_EVERY: 2,
  MAX_OUTS: 3,
} as const;

export interface Item {
  id: number;
  color: number;
  /** Progress through the current cell, 0 = entry edge, 0.5 = centre, 1 = exit edge. */
  p: number;
  /** Side of the cell the item entered from (-1 when spawned in place). */
  from: Dir | -1;
  /** Side the item will leave by (-1 when the cell is a dead end). */
  out: Dir | -1;
  target: number;
}

export interface Cell {
  terrain: T;
  belt: boolean;
  outs: Dir[];
  items: Item[];
  rr: number;
  /** Seconds since the belt was placed, for the build animation. */
  age: number;
  /** Overpass carrying a second, straight belt over this one (costs a bridge). */
  cross: { dir: Dir; items: Item[] } | null;
}

export interface Source {
  id: number;
  x: number;
  y: number;
  color: number;
  outs: Dir[];
  buffer: number;
  timer: number;
  rr: number;
  age: number;
}

export interface Site {
  id: number;
  x: number;
  y: number;
  color: number;
  pending: number;
  stock: number;
  incoming: number;
  orderTimer: number;
  overflow: number;
  age: number;
  delivered: number;
  bump: number;
}

export type UpgradeId = 'belts' | 'bridges' | 'overdrive' | 'quarry' | 'patience';

export type SimEvent =
  | { type: 'deliver'; x: number; y: number; color: number; site: number; combo: number }
  | { type: 'recycle'; x: number; y: number; color: number }
  | { type: 'spawnSite' | 'spawnSource'; x: number; y: number; color: number }
  | { type: 'week'; week: number }
  | { type: 'unlock'; color: number }
  | { type: 'warn'; site: number }
  | { type: 'over'; site: number }
  | { type: 'place'; x: number; y: number; bridge: boolean }
  | { type: 'erase'; x: number; y: number }
  | { type: 'denied'; reason: 'belts' | 'bridges' };

export type SimState = 'playing' | 'upgrade' | 'over';

interface StrokeNode {
  i: number;
  kind: 'anchor' | 'placed' | 'terminal' | 'cross';
}

export interface SimOptions {
  district: District;
  seed: number;
  /** Gentler first run: slower overflow during the first weeks. */
  gentle?: boolean;
}

export interface RunStats {
  score: number;
  weeks: number;
  delivered: number[];
  bridgesUsed: number;
  beltsPlaced: number;
  bestCombo: number;
  time: number;
}

export class Sim {
  readonly w = TUNING.W;
  readonly h = TUNING.H;
  readonly cells: Cell[];
  readonly sources: Source[] = [];
  readonly sites: Site[] = [];
  readonly sourceAt: Int16Array;
  readonly siteAt: Int16Array;
  readonly district: District;
  readonly rng: Rng;
  bounds = { x0: 0, y0: 0, x1: 0, y1: 0 };
  state: SimState = 'playing';
  time = 0;
  week = 0;
  weekTimer = 0;
  belts: number;
  bridges: number;
  speedMul = 1;
  emitMul = 1;
  patienceMul = 1;
  overdrives = 0;
  unlocked = 0;
  offer: UpgradeId[] = [];
  continued = false;
  events: SimEvent[] = [];
  stats: RunStats;
  combo = 0;
  comboTimer = 0;
  private reach: number[][] = [];
  private graphDirty = true;
  private nextId = 1;
  private siteSpawnTimer = 6;
  private stroke: StrokeNode[] | null = null;
  private gentle: boolean;
  private warned = new Set<number>();

  constructor(opts: SimOptions) {
    this.district = opts.district;
    this.rng = new Rng(opts.seed);
    this.gentle = !!opts.gentle;
    // Terrain is fixed per district (players learn the map); spawns vary with the seed.
    const terrain = generateTerrain(opts.district.terrain, this.w, this.h, new Rng(hashString(opts.district.id)));
    this.cells = Array.from(terrain, (t) => ({ terrain: t as T, belt: false, outs: [], items: [], rr: 0, age: 0, cross: null }));
    this.sourceAt = new Int16Array(this.w * this.h).fill(-1);
    this.siteAt = new Int16Array(this.w * this.h).fill(-1);
    this.belts = opts.district.startBelts;
    this.bridges = opts.district.startBridges;
    this.stats = { score: 0, weeks: 0, delivered: [0, 0, 0, 0, 0], bridgesUsed: 0, beltsPlaced: 0, bestCombo: 0, time: 0 };
    const x0 = Math.floor((this.w - TUNING.START_W) / 2);
    const y0 = Math.floor((this.h - TUNING.START_H) / 2);
    this.bounds = { x0, y0, x1: x0 + TUNING.START_W - 1, y1: y0 + TUNING.START_H - 1 };
    this.openingLayout();
    this.unlocked = 1;
    this.unlockColors();
  }

  // ---------------------------------------------------------------- helpers

  idx(x: number, y: number): number {
    return y * this.w + x;
  }

  inBounds(x: number, y: number): boolean {
    const b = this.bounds;
    return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
  }

  neighbor(i: number, d: Dir): number {
    const x = (i % this.w) + DX[d];
    const y = Math.floor(i / this.w) + DY[d];
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    return y * this.w + x;
  }

  private dirBetween(a: number, b: number): Dir | -1 {
    const ax = a % this.w, ay = Math.floor(a / this.w);
    const bx = b % this.w, by = Math.floor(b / this.w);
    for (let d = 0 as Dir; d < 4; d++) if (ax + DX[d] === bx && ay + DY[d] === by) return d;
    return -1;
  }

  /** Outputs of a belt cell or a source, or null when the cell has none. */
  outsOf(i: number): Dir[] | null {
    if (this.cells[i].belt) return this.cells[i].outs;
    const s = this.sourceAt[i];
    return s >= 0 ? this.sources[s].outs : null;
  }

  /** Directions from which other belts/sources feed cell i. */
  /** Sides from which belts/sources feed the main lane of cell i (overpasses included as feeders). */
  insOf(i: number): Dir[] {
    const res: Dir[] = [];
    const own = this.cells[i].cross;
    for (let d = 0 as Dir; d < 4; d++) {
      if (own && d === opposite(own.dir)) continue; // that input belongs to the overpass
      const n = this.neighbor(i, d);
      if (n < 0) continue;
      const o = this.outsOf(n);
      if ((o && o.includes(opposite(d))) || this.cells[n].cross?.dir === opposite(d)) res.push(d);
    }
    return res;
  }

  /** The cell an item leaving i by d really lands in, skipping over overpasses. */
  landing(i: number, d: Dir): number {
    let n = this.neighbor(i, d);
    while (n >= 0 && this.cells[n].cross?.dir === d) n = this.neighbor(n, d);
    return n;
  }

  isFree(i: number): boolean {
    const c = this.cells[i];
    return c.terrain === T.Land && !c.belt && this.sourceAt[i] < 0 && this.siteAt[i] < 0;
  }

  // ---------------------------------------------------------------- spawning

  private unlockColors() {
    const weeks = this.district.colorWeeks;
    let n = 0;
    for (let c = 0; c < weeks.length; c++) if (weeks[c] <= this.week) n = c + 1;
    while (this.unlocked < n) {
      const c = this.unlocked++;
      this.events.push({ type: 'unlock', color: c });
      const src = this.spawnSource(c);
      if (src) this.spawnSite(c, src);
    }
  }

  private openingLayout() {
    const src = this.spawnSource(0, true);
    if (src) this.spawnSite(0, src);
  }

  /** Picks a free cell, away from other entities, optionally at a target distance from an anchor. */
  private findSpot(anchor?: { x: number; y: number }, minDist = 2, maxDist = 99, central = false, colorHint = -1): number {
    const b = this.bounds;
    let best = -1;
    let bestScore = -Infinity;
    for (let tries = 0; tries < 80; tries++) {
      const x = this.rng.int(b.x0, b.x1 + 1);
      const y = this.rng.int(b.y0, b.y1 + 1);
      const i = this.idx(x, y);
      if (!this.isFree(i)) continue;
      let crowd = 0;
      for (let yy = y - 1; yy <= y + 1; yy++)
        for (let xx = x - 1; xx <= x + 1; xx++) {
          if (xx < 0 || yy < 0 || xx >= this.w || yy >= this.h) continue;
          const j = this.idx(xx, yy);
          if (this.sourceAt[j] >= 0 || this.siteAt[j] >= 0) crowd++;
        }
      if (crowd > 0) continue;
      let score = this.rng.next();
      if (!this.landLinked(i, colorHint)) score -= 3;
      if (anchor) {
        const d = Math.abs(anchor.x - x) + Math.abs(anchor.y - y);
        if (d < minDist || d > maxDist) score -= 5;
      }
      if (central) {
        const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
        score -= (Math.abs(x - cx) + Math.abs(y - cy)) * 0.6;
      }
      // Encourage spreading out: prefer cells with few belts around.
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    return best;
  }

  /**
   * True if cell i shares a land region (ignoring belts) with a quarry/workshop of the
   * given colour, so new spawns don't start out cut off by water or rocks.
   */
  private landLinked(i: number, color: number): boolean {
    if (color < 0) return true;
    const targets = new Set<number>();
    for (const s of this.sources) if (s.color === color) targets.add(this.idx(s.x, s.y));
    for (const s of this.sites) if (s.color === color) targets.add(this.idx(s.x, s.y));
    if (targets.size === 0) return true;
    const seen = new Uint8Array(this.w * this.h);
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const cur = stack.pop()!;
      if (targets.has(cur)) return true;
      for (let d = 0 as Dir; d < 4; d++) {
        const n = this.neighbor(cur, d);
        if (n < 0 || seen[n] || this.cells[n].terrain !== T.Land) continue;
        const x = n % this.w, y = Math.floor(n / this.w);
        if (!this.inBounds(x, y)) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    return false;
  }

  private spawnSource(color: number, central = false): Source | null {
    const sameColorSite = this.sites.find((s) => s.color === color);
    const i = this.findSpot(sameColorSite, 3, 6, central, this.week < 3 ? color : -1);
    if (i < 0) return null;
    const src: Source = {
      id: this.sources.length, x: i % this.w, y: Math.floor(i / this.w), color,
      outs: [], buffer: 1, timer: TUNING.EMIT_PERIOD, rr: 0, age: 0,
    };
    this.sources.push(src);
    this.sourceAt[i] = src.id;
    this.graphDirty = true;
    this.events.push({ type: 'spawnSource', x: src.x, y: src.y, color });
    return src;
  }

  private spawnSite(color: number, near?: { x: number; y: number }): Site | null {
    const hint = this.week < 3 ? color : -1;
    const i = near ? this.findSpot(near, 3, 5, false, hint) : this.findSpot(undefined, 2, 99, false, hint);
    if (i < 0) return null;
    const site: Site = {
      id: this.sites.length, x: i % this.w, y: Math.floor(i / this.w), color,
      pending: 1, stock: 0, incoming: 0, orderTimer: TUNING.ORDER_START, overflow: 0, age: 0, delivered: 0, bump: 0,
    };
    this.sites.push(site);
    this.siteAt[i] = site.id;
    this.graphDirty = true;
    this.events.push({ type: 'spawnSite', x: site.x, y: site.y, color });
    return site;
  }

  /** Chooses the colour most in need of a new workshop / quarry. */
  private colorForNewSite(): number {
    const counts = new Array(this.unlocked).fill(0);
    for (const s of this.sites) counts[s.color]++;
    const srcCounts = new Array(this.unlocked).fill(0);
    for (const s of this.sources) srcCounts[s.color]++;
    // Weighted pick that favours colours with spare quarry capacity.
    const weights = counts.map((c, k) => Math.max(0.2, srcCounts[k] * TUNING.SITES_PER_SOURCE - c));
    let r = this.rng.next() * weights.reduce((a, b) => a + b, 0);
    for (let k = 0; k < weights.length; k++) {
      r -= weights[k];
      if (r <= 0) return k;
    }
    return this.unlocked - 1;
  }

  private director(dt: number) {
    this.siteSpawnTimer -= dt;
    if (this.siteSpawnTimer <= 0) {
      const interval = Math.max(TUNING.SITE_SPAWN_MIN, TUNING.SITE_SPAWN_START - this.time * TUNING.SITE_SPAWN_RAMP);
      this.siteSpawnTimer = interval / this.district.pace;
      const color = this.colorForNewSite();
      const site = this.spawnSite(color);
      if (site) {
        const sites = this.sites.filter((s) => s.color === color).length;
        const srcs = this.sources.filter((s) => s.color === color).length;
        if (sites > srcs * TUNING.SITES_PER_SOURCE) this.spawnSource(color);
      }
    }
  }

  private growBounds() {
    const b = this.bounds;
    const growH = b.y1 - b.y0 + 1 < this.h;
    if (growH) {
      if (this.week % 2 === 1 ? b.y0 > 0 : b.y1 >= this.h - 1) b.y0 = Math.max(0, b.y0 - 1);
      else b.y1 = Math.min(this.h - 1, b.y1 + 1);
    }
    if (this.week % 2 === 0 || !growH) {
      if (b.x1 - b.x0 + 1 < this.w) {
        if ((this.week >> 1) % 2 === 0 ? b.x0 > 0 : b.x1 >= this.w - 1) b.x0 = Math.max(0, b.x0 - 1);
        else b.x1 = Math.min(this.w - 1, b.x1 + 1);
      }
    }
  }

  // ---------------------------------------------------------------- routing

  private rebuildReach() {
    const n = this.w * this.h;
    this.reach = Array.from({ length: n }, () => []);
    for (const s of this.sites) {
      const start = this.idx(s.x, s.y);
      const seen = new Uint8Array(n);
      seen[start] = 1;
      const queue = [start];
      while (queue.length) {
        const cur = queue.shift()!;
        for (let d = 0 as Dir; d < 4; d++) {
          let nb = this.neighbor(cur, d);
          while (nb >= 0 && this.cells[nb].cross?.dir === opposite(d)) nb = this.neighbor(nb, d);
          if (nb < 0 || seen[nb]) continue;
          const o = this.outsOf(nb);
          if (!o || !o.includes(opposite(d))) continue;
          seen[nb] = 1;
          this.reach[nb].push(s.id);
          if (this.cells[nb].belt) queue.push(nb);
        }
      }
    }
    this.graphDirty = false;
  }

  /** How much a site wants an item of the given colour right now. */
  private desire(s: Site, color: number): number {
    if (s.color !== color) return 0;
    const need = s.pending + TUNING.STOCK_CAP - s.stock - s.incoming;
    return 1 + Math.max(0, need);
  }

  /** Picks the output for an item leaving cell i, and the site it now aims for. */
  private route(i: number, outs: Dir[], color: number, rrHolder: { rr: number }): { out: Dir | -1; target: number } {
    if (outs.length === 0) return { out: -1, target: -1 };
    if (this.graphDirty) this.rebuildReach();
    let bestScore = -1;
    const cands: { out: Dir; target: number }[] = [];
    for (const d of outs) {
      const nb = this.landing(i, d);
      let score = 0;
      let target = -1;
      if (nb >= 0) {
        const site = this.siteAt[nb];
        const list = site >= 0 ? [site] : this.cells[nb].belt ? this.reach[nb] : [];
        for (const sid of list) {
          const v = this.desire(this.sites[sid], color);
          if (v > score) {
            score = v;
            target = sid;
          }
        }
      }
      if (score > bestScore) {
        bestScore = score;
        cands.length = 0;
      }
      if (score === bestScore) cands.push({ out: d, target });
    }
    return cands[rrHolder.rr++ % cands.length];
  }

  private retarget(item: Item, target: number) {
    if (item.target >= 0 && this.sites[item.target]) this.sites[item.target].incoming--;
    item.target = target;
    if (target >= 0) this.sites[target].incoming++;
  }

  private dropItem(item: Item, x: number, y: number) {
    this.retarget(item, -1);
    this.events.push({ type: 'recycle', x, y, color: item.color });
  }

  // ---------------------------------------------------------------- update

  step(dt: number) {
    if (this.state !== 'playing') return;
    this.time += dt;
    this.stats.time = this.time;
    if (this.graphDirty) this.rebuildReach();

    this.weekTimer += dt;
    if (this.weekTimer >= TUNING.WEEK) {
      this.weekTimer -= TUNING.WEEK;
      this.week++;
      this.stats.weeks = this.week;
      this.belts += TUNING.WEEK_BONUS_BELTS;
      if (this.week % TUNING.WEEK_BONUS_BRIDGE_EVERY === 0) this.bridges++;
      this.growBounds();
      this.unlockColors();
      this.offer = this.rollUpgrades();
      this.state = 'upgrade';
      this.events.push({ type: 'week', week: this.week });
    }

    this.director(dt);
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    for (const c of this.cells) if (c.belt) c.age += dt;
    this.updateSources(dt);
    this.updateBelts(dt);
    this.updateSites(dt);
  }

  private updateSources(dt: number) {
    for (const s of this.sources) {
      s.age += dt;
      s.timer -= dt * this.emitMul;
      if (s.timer <= 0) {
        s.timer += TUNING.EMIT_PERIOD;
        if (s.buffer < TUNING.SOURCE_BUFFER) s.buffer++;
      }
      if (s.buffer <= 0 || s.outs.length === 0) continue;
      const i = this.idx(s.x, s.y);
      const { out, target } = this.route(i, s.outs, s.color, s);
      if (out === -1) continue;
      const nb = this.neighbor(i, out);
      if (nb < 0) continue;
      if (this.siteAt[nb] >= 0) {
        const site = this.sites[this.siteAt[nb]];
        if (this.isFull(site, s.color)) continue;
        s.buffer--;
        this.accept(site, s.color);
        continue;
      }
      const cell = this.cells[nb];
      if (!cell.belt || !this.hasRoom(this.laneOf(nb, out))) continue;
      s.buffer--;
      const item: Item = { id: this.nextId++, color: s.color, p: 0, from: opposite(out), out: -1, target: -1 };
      this.retarget(item, target);
      this.enterCell(nb, item, out);
    }
  }

  private hasRoom(lane: Item[]): boolean {
    if (lane.length === 0) return true;
    return lane[lane.length - 1].p >= TUNING.SPACING;
  }

  /** Lane of cell i that an item travelling in direction d enters. */
  private laneOf(i: number, d: Dir): Item[] {
    const c = this.cells[i];
    return c.cross && c.cross.dir === d ? c.cross.items : c.items;
  }

  private enterCell(i: number, item: Item, d: Dir) {
    const cell = this.cells[i];
    if (cell.cross && cell.cross.dir === d) {
      item.out = d;
      cell.cross.items.push(item);
      return;
    }
    if (cell.outs.length > 1) {
      const r = this.route(i, cell.outs, item.color, cell);
      item.out = r.out;
      this.retarget(item, r.target);
    } else {
      item.out = cell.outs.length ? cell.outs[0] : -1;
    }
    cell.items.push(item);
  }

  private updateBelts(dt: number) {
    const v = TUNING.BELT_SPEED * this.speedMul * dt;
    for (let i = 0; i < this.cells.length; i++) {
      const cell = this.cells[i];
      if (!cell.belt) continue;
      if (cell.items.length) this.advanceLane(i, cell.items, false, v);
      if (cell.cross?.items.length) this.advanceLane(i, cell.cross.items, true, v);
    }
  }

  private advanceLane(i: number, items: Item[], overpass: boolean, v: number) {
    const cell = this.cells[i];
    for (let k = 0; k < items.length; k++) {
      const it = items[k];
      if (!overpass && it.out === -1 && cell.outs.length > 0) {
        const r = cell.outs.length > 1 ? this.route(i, cell.outs, it.color, cell) : { out: cell.outs[0], target: it.target };
        it.out = r.out;
        this.retarget(it, r.target);
      }
      const limit = k === 0 ? (it.out === -1 ? 0.5 : 1) : items[k - 1].p - TUNING.SPACING;
      if (it.p < limit) it.p = Math.min(limit, it.p + v);
    }
    const front = items[0];
    if (front.out === -1 || front.p < 1) return;
    const nb = this.neighbor(i, front.out);
    if (nb < 0) return;
    if (this.siteAt[nb] >= 0) {
      const site = this.sites[this.siteAt[nb]];
      if (this.isFull(site, front.color)) return; // line backs up until the workshop needs more
      items.shift();
      if (front.target >= 0) this.sites[front.target].incoming--;
      front.target = -1;
      this.accept(site, front.color);
      return;
    }
    const next = this.cells[nb];
    if (!next.belt) {
      // Belt ahead was removed: re-route (overpass items simply wait).
      if (!overpass) front.out = -1;
      return;
    }
    if (!this.hasRoom(this.laneOf(nb, front.out))) return;
    items.shift();
    front.p = 0;
    front.from = opposite(front.out);
    this.enterCell(nb, front, front.out);
  }

  /** A matching item waits at the door of a workshop that has no room for it. */
  private isFull(site: Site, color: number): boolean {
    return site.color === color && site.pending === 0 && site.stock >= TUNING.STOCK_CAP;
  }

  private accept(site: Site, color: number) {
    if (site.color !== color) {
      this.events.push({ type: 'recycle', x: site.x, y: site.y, color });
      return;
    }
    if (site.pending > 0) site.pending--;
    else site.stock++;
    site.delivered++;
    site.bump = 1;
    this.stats.score++;
    this.stats.delivered[color]++;
    this.combo++;
    this.comboTimer = 2.5;
    this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo);
    this.events.push({ type: 'deliver', x: site.x, y: site.y, color, site: site.id, combo: this.combo });
  }

  private updateSites(dt: number) {
    const gentle = this.gentle && this.week < 2 ? 2 : 1;
    for (const s of this.sites) {
      s.age += dt;
      s.bump = Math.max(0, s.bump - dt * 4);
      s.orderTimer -= dt * this.district.pace;
      if (s.orderTimer <= 0) {
        s.orderTimer += Math.max(TUNING.ORDER_MIN, TUNING.ORDER_START - s.age * TUNING.ORDER_DECAY);
        if (s.stock > 0) s.stock--;
        else s.pending++;
      }
      if (s.pending >= TUNING.OVERFLOW_AT) {
        s.overflow += dt / (TUNING.OVERFLOW_TIME * this.patienceMul * gentle);
        if (s.overflow > 0.5 && !this.warned.has(s.id)) {
          this.warned.add(s.id);
          this.events.push({ type: 'warn', site: s.id });
        }
        if (s.overflow >= 1) {
          s.overflow = 1;
          this.state = 'over';
          this.events.push({ type: 'over', site: s.id });
          return;
        }
      } else {
        s.overflow = Math.max(0, s.overflow - dt / TUNING.OVERFLOW_DRAIN);
        if (s.overflow < 0.3) this.warned.delete(s.id);
      }
    }
  }

  // ---------------------------------------------------------------- upgrades / continue

  private rollUpgrades(): UpgradeId[] {
    const pool: UpgradeId[] = ['belts', 'quarry', 'patience'];
    if (this.cells.some((c) => c.terrain === T.Water)) pool.push('bridges');
    if (this.overdrives < 3) pool.push('overdrive');
    this.rng.shuffle(pool);
    return pool.slice(0, 2);
  }

  chooseUpgrade(id: UpgradeId) {
    if (this.state !== 'upgrade') return;
    switch (id) {
      case 'belts': this.belts += 10; break;
      case 'bridges': this.bridges += 2; break;
      case 'overdrive': this.speedMul *= 1.25; this.overdrives++; break;
      case 'quarry': this.emitMul *= 1.2; break;
      case 'patience': this.patienceMul *= 1.3; break;
    }
    this.offer = [];
    this.state = 'playing';
  }

  /** Second chance (rewarded ad): calms every workshop down. */
  revive() {
    if (this.state !== 'over' || this.continued) return;
    this.continued = true;
    for (const s of this.sites) {
      s.overflow = 0;
      s.pending = Math.min(s.pending, 1);
    }
    this.warned.clear();
    this.belts += 6;
    this.state = 'playing';
  }

  // ---------------------------------------------------------------- building

  get drawing(): boolean {
    return this.stroke !== null;
  }

  strokeCells(): number[] {
    return this.stroke ? this.stroke.map((n) => n.i) : [];
  }

  beginStroke(x: number, y: number): boolean {
    if (this.state === 'over' || x < 0 || y < 0 || x >= this.w || y >= this.h || !this.inBounds(x, y)) return false;
    const i = this.idx(x, y);
    if (this.sourceAt[i] < 0 && !this.cells[i].belt) return false;
    this.stroke = [{ i, kind: 'anchor' }];
    return true;
  }

  /** Extends the current stroke toward (x, y), stepping through intermediate cells. */
  extendStroke(x: number, y: number) {
    if (!this.stroke) return;
    x = Math.max(0, Math.min(this.w - 1, x));
    y = Math.max(0, Math.min(this.h - 1, y));
    const target = this.idx(x, y);
    for (let guard = 0; guard < 32; guard++) {
      const last = this.stroke[this.stroke.length - 1].i;
      if (last === target) return;
      const lx = last % this.w, ly = Math.floor(last / this.w);
      const dx = x - lx, dy = y - ly;
      let next: number;
      if (Math.abs(dx) >= Math.abs(dy)) next = this.idx(lx + Math.sign(dx), ly);
      else next = this.idx(lx, ly + Math.sign(dy));
      if (!this.extendAdjacent(next)) {
        // Try the other axis before giving up (lets the path slide around obstacles).
        const alt = Math.abs(dx) >= Math.abs(dy) ? (dy !== 0 ? this.idx(lx, ly + Math.sign(dy)) : -1) : dx !== 0 ? this.idx(lx + Math.sign(dx), ly) : -1;
        if (alt < 0 || !this.extendAdjacent(alt)) return;
      }
    }
  }

  private extendAdjacent(n: number): boolean {
    const s = this.stroke!;
    const last = s[s.length - 1];
    if (s.length >= 2 && s[s.length - 2].i === n) {
      this.backtrack();
      return true;
    }
    if (s.some((node) => node.i === n)) return false;
    const nx = n % this.w, ny = Math.floor(n / this.w);
    if (!this.inBounds(nx, ny)) return false;
    const d = this.dirBetween(last.i, n);
    if (d === -1) return false;
    if (last.kind === 'terminal') {
      // Dragging straight through a belt we just merged into: turn the merge into an overpass.
      if (!this.tryOverpass(s, d)) return false;
      return this.extendAdjacent(n);
    }
    // From an overpass the path must continue straight; the link is implicit.
    const outs = last.kind === 'cross' ? null : this.outsOf(last.i);
    if (last.kind === 'cross') {
      if (this.cells[last.i].cross!.dir !== d) return false;
    } else if (!outs || outs.includes(d) || outs.length >= TUNING.MAX_OUTS) return false;
    const target = this.cells[n];
    if (this.siteAt[n] >= 0 || target.belt) {
      if (target.belt && target.outs.includes(opposite(d))) return false;
      if (target.cross && (target.cross.dir === d || target.cross.dir === opposite(d))) return false;
      outs?.push(d);
      s.push({ i: n, kind: 'terminal' });
      this.graphDirty = true;
      return true;
    }
    if (this.sourceAt[n] >= 0 || target.terrain === T.Rock) return false;
    const water = target.terrain === T.Water;
    if (water ? this.bridges <= 0 : this.belts <= 0) {
      this.events.push({ type: 'denied', reason: water ? 'bridges' : 'belts' });
      return false;
    }
    if (water) {
      this.bridges--;
      this.stats.bridgesUsed++;
    } else {
      this.belts--;
      this.stats.beltsPlaced++;
    }
    target.belt = true;
    target.outs = [];
    target.age = 0;
    target.rr = 0;
    target.cross = null;
    outs?.push(d);
    s.push({ i: n, kind: 'placed' });
    this.graphDirty = true;
    this.events.push({ type: 'place', x: nx, y: ny, bridge: water });
    return true;
  }

  private backtrack() {
    const s = this.stroke!;
    const node = s.pop()!;
    const prev = s[s.length - 1];
    const d = this.dirBetween(prev.i, node.i) as Dir;
    if (node.kind === 'placed') this.removeBelt(node.i, false);
    else if (node.kind === 'cross') {
      this.removeOverpass(node.i);
      this.disconnect(prev.i, d);
    } else if (prev.kind !== 'cross') this.disconnect(prev.i, d);
    this.graphDirty = true;
  }

  /**
   * Converts the terminal merge at the end of the stroke into an overpass when the
   * belt underneath runs straight across the drag direction and a bridge is available.
   */
  private tryOverpass(s: StrokeNode[], d: Dir): boolean {
    const node = s[s.length - 1];
    const prev = s[s.length - 2];
    const cell = this.cells[node.i];
    if (!cell.belt || cell.cross || cell.terrain === T.Water) return false;
    if (this.dirBetween(prev.i, node.i) !== d) return false;
    if (cell.outs.length !== 1 || cell.outs[0] === d || cell.outs[0] === opposite(d)) return false;
    const ins = this.insOf(node.i).filter((x) => x !== opposite(d));
    if (ins.some((x) => x !== opposite(cell.outs[0]))) return false;
    if (this.bridges <= 0) {
      this.events.push({ type: 'denied', reason: 'bridges' });
      return false;
    }
    this.bridges--;
    this.stats.bridgesUsed++;
    cell.cross = { dir: d, items: [] };
    node.kind = 'cross';
    this.graphDirty = true;
    const x = node.i % this.w, y = Math.floor(node.i / this.w);
    this.events.push({ type: 'place', x, y, bridge: true });
    return true;
  }

  private removeOverpass(i: number) {
    const cell = this.cells[i];
    if (!cell.cross) return;
    const x = i % this.w, y = Math.floor(i / this.w);
    for (const it of cell.cross.items) this.dropItem(it, x, y);
    cell.cross = null;
    this.bridges++;
    this.graphDirty = true;
  }

  /** Removes output d of cell i; items that were heading that way re-route. */
  private disconnect(i: number, d: Dir) {
    const o = this.outsOf(i);
    if (!o) return;
    const k = o.indexOf(d);
    if (k >= 0) o.splice(k, 1);
    if (this.cells[i].belt) for (const it of this.cells[i].items) if (it.out === d) it.out = -1;
  }

  endStroke() {
    this.stroke = null;
  }

  /** Removes the belt at (x, y). Returns true if something was erased. */
  erase(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    const i = this.idx(x, y);
    if (!this.cells[i].belt) return false;
    this.removeBelt(i, true);
    return true;
  }

  private removeBelt(i: number, event: boolean) {
    const cell = this.cells[i];
    const x = i % this.w, y = Math.floor(i / this.w);
    this.removeOverpass(i);
    for (const it of cell.items) this.dropItem(it, x, y);
    cell.items = [];
    cell.belt = false;
    cell.outs = [];
    if (cell.terrain === T.Water) this.bridges++;
    else this.belts++;
    // Disconnect anything that was feeding this cell.
    for (let d = 0 as Dir; d < 4; d++) {
      const nb = this.neighbor(i, d);
      if (nb >= 0) this.disconnect(nb, opposite(d));
    }
    this.graphDirty = true;
    if (event) this.events.push({ type: 'erase', x, y });
  }

  drainEvents(): SimEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
}
