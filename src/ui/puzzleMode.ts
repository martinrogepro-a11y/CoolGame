import { audio } from '../core/audio';
import { haptics } from '../core/haptics';
import { dayKey, hashString } from '../core/rng';
import { MATERIALS, type Palette } from '../game/content';
import { applyLevel, doubleRun, persist, save, type LevelResult } from '../meta/save';
import { ads } from '../monetization/ads';
import { PICTURES } from '../puzzle/pictures';
import { generateLevel, type Level, PuzzleState } from '../puzzle/puzzle';
import { drawPictureThumb, PuzzleRenderer } from '../puzzle/puzzleRender';
import { t, type Key } from './i18n';
import { icon } from './icons';

export interface PuzzleHost {
  ui: HTMLElement;
  canvas: HTMLCanvasElement;
  pal(): Palette;
  colorblind(): boolean;
  toast(msg: string): void;
  modal(html: string): void;
  closeModal(): void;
  goHome(): void;
  afterRewards(r: LevelResult): void;
}

const cache = new Map<string, Level>();

/** Level L uses picture L mod count; later albums reuse pictures with new layouts. */
export function levelAt(index: number): Level {
  const key = `L${index}`;
  let lv = cache.get(key);
  if (!lv) {
    lv = generateLevel(PICTURES[index % PICTURES.length], 1 + Math.floor(index / PICTURES.length));
    cache.set(key, lv);
  }
  return lv;
}

export function dailyLevel(day = dayKey()): Level {
  const key = `D${day}`;
  let lv = cache.get(key);
  if (!lv) {
    const h = hashString('pz' + day);
    // Daily puzzles come from the larger pictures, with a layout nobody has seen.
    const pool = PICTURES.filter((p) => p.rows.length >= 7);
    lv = generateLevel(pool[h % pool.length], 1000 + (h % 9973));
    cache.set(key, lv);
  }
  return lv;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const sq = (c: number) => `<i class="sq" style="background:${MATERIALS[c].color}"></i>`;

export class PuzzleMode {
  private st: PuzzleState | null = null;
  private renderer: PuzzleRenderer;
  private levelIndex = 0;
  private daily = false;
  private hintsUsed = 0;
  private solvedAt = -1;
  private result: LevelResult | null = null;
  private doubled = false;
  private pointer: number | null = null;
  private fillToast = false;
  private hud: Record<string, HTMLElement> = {};

  constructor(private host: PuzzleHost) {
    this.renderer = new PuzzleRenderer(host.canvas, host.pal());
    const cellOf = (e: PointerEvent) => {
      const r = host.canvas.getBoundingClientRect();
      return this.renderer.cellAt(e.clientX - r.left, e.clientY - r.top, this.st!.n);
    };
    host.canvas.addEventListener('pointerdown', (e) => {
      if (!this.st || this.solvedAt >= 0 || this.pointer !== null) return;
      audio.unlock();
      const c = cellOf(e);
      if (c.i < 0 || this.st.begin(c.i) < 0) return;
      this.pointer = e.pointerId;
      host.canvas.setPointerCapture(e.pointerId);
      haptics.tick();
    });
    host.canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.pointer || !this.st) return;
      const c = cellOf(e);
      if (c.i < 0 || !c.inner) return;
      const k = this.st.drawingPath;
      const wasConnected = k >= 0 && this.st.isConnected(k);
      if (this.st.extend(c.i)) {
        audio.place();
        haptics.tick();
        if (!wasConnected && this.st.isConnected(k)) {
          audio.deliver(this.st.pathColor(k) % 5, this.st.connectedCount());
          haptics.success();
          this.renderer.pulse(k);
        }
      }
    });
    const up = (e: PointerEvent) => {
      if (e.pointerId !== this.pointer || !this.st) return;
      this.pointer = null;
      this.st.end();
      this.checkSolved();
    };
    host.canvas.addEventListener('pointerup', up);
    host.canvas.addEventListener('pointercancel', up);
    if (import.meta.env.DEV) {
      // Test hook for the Playwright smoke test: screen position of each cell and the solution.
      (window as unknown as Record<string, unknown>).__pz = () => {
        const st = this.st;
        if (!st) return null;
        const r = this.renderer;
        const n = st.n;
        const at = (i: number) => [r.ox + ((i % n) + 0.5) * r.cell, r.oy + (Math.floor(i / n) + 0.5) * r.cell];
        return { solution: st.level.solution.map((p) => p.map(at)), solved: st.solved() };
      };
    }
  }

  get active(): boolean {
    return this.st !== null;
  }

  // ---------------------------------------------------------------- lifecycle

  start(index: number, daily = false) {
    this.levelIndex = index;
    this.daily = daily;
    const lv = daily ? dailyLevel() : levelAt(index);
    this.st = new PuzzleState(lv);
    this.hintsUsed = 0;
    this.solvedAt = -1;
    this.result = null;
    this.doubled = false;
    this.fillToast = false;
    this.renderer.reveal = 0;
    this.host.ui.innerHTML = this.hudHtml();
    this.hud = {};
    this.host.ui.querySelectorAll<HTMLElement>('[data-h]').forEach((el) => (this.hud[el.dataset.h!] = el));
    this.renderer.pal = this.host.pal();
    this.renderer.colorblind = this.host.colorblind();
    this.renderer.resize();
    requestAnimationFrame(() => {
      const top = this.host.ui.querySelector('.hud-top')?.getBoundingClientRect().bottom ?? 90;
      const bottom = this.host.ui.querySelector('.hud-bottom')?.getBoundingClientRect().top ?? window.innerHeight - 100;
      this.renderer.insets = { top: top + 16, bottom: window.innerHeight - bottom + 16 };
      this.renderer.layout(lv.n);
    });
    this.renderer.layout(lv.n);
    if (!daily && index === 0) this.showTip(t('pz_tut1'));
    else if (!daily && index === 1) this.showTip(t('pz_tut2'));
  }

  stop() {
    this.st = null;
    this.pointer = null;
  }

  resize() {
    if (!this.st) return;
    this.renderer.resize();
    this.renderer.layout(this.st.n);
  }

  frame(dt: number) {
    if (!this.st) return;
    if (this.solvedAt >= 0) {
      this.solvedAt += dt;
      this.renderer.reveal = Math.min(1, Math.max(0, (this.solvedAt - 0.5) / 1.4));
      if (this.solvedAt > 2.1 && !this.result) this.finish();
    }
    this.renderer.draw(this.st, dt);
    this.updateHud();
  }

  private checkSolved() {
    const st = this.st!;
    if (st.solved()) {
      this.solvedAt = 0;
      audio.week();
      haptics.success();
      this.host.ui.querySelector('.tip')?.remove();
      return;
    }
    if (!this.fillToast && st.connectedCount() === st.level.pairs.length) {
      this.fillToast = true;
      this.host.toast(t('pz_fill'));
      haptics.warning();
    }
  }

  private finish() {
    const st = this.st!;
    const perfect = st.perfect(this.hintsUsed);
    this.result = applyLevel(save, this.levelIndex, st.level.colors, perfect, this.daily);
    persist(true);
    audio.reward();
    this.host.afterRewards(this.result);
    this.showWin();
  }

  // ---------------------------------------------------------------- UI

  private title(): string {
    return this.daily ? t('daily') : t('pz_level', { n: this.levelIndex + 1 });
  }

  private hudHtml(): string {
    return `
      <div class="hud-top">
        <button class="icon-btn" data-a="pz-home" aria-label="${t('home')}">${icon.back}</button>
        <div class="score pz-title"><span>${esc(this.title())}</span><small data-h="progress"></small></div>
        <button class="icon-btn pz-hint" data-a="pz-hint" aria-label="${t('pz_hint')}">${icon.bulb}<b data-h="hints">${save.hints}</b></button>
      </div>
      <div class="hud-bottom pz-bottom">
        <button class="tool" data-a="pz-reset" aria-label="${t('restart')}">${icon.reset}</button>
        <div class="spacer"></div>
        <div class="res pz-pairs" data-h="pairs"></div>
      </div>`;
  }

  private updateHud() {
    const st = this.st!;
    const pct = Math.round((st.filledCount() / (st.n * st.n)) * 100);
    const txt = `${st.n}×${st.n} · ${pct}%`;
    if (this.hud.progress && this.hud.progress.textContent !== txt) this.hud.progress.textContent = txt;
    const pairs = `${icon.belt}<span>${st.connectedCount()}/${st.level.pairs.length}</span>`;
    if (this.hud.pairs && this.hud.pairs.dataset.v !== pairs) {
      this.hud.pairs.dataset.v = pairs;
      this.hud.pairs.innerHTML = pairs;
    }
    const h = String(save.hints);
    if (this.hud.hints && this.hud.hints.textContent !== h) this.hud.hints.textContent = h;
  }

  private showTip(text: string) {
    this.host.ui.querySelector('.tip')?.remove();
    const el = document.createElement('div');
    el.className = 'hint tip';
    el.textContent = text;
    this.host.ui.appendChild(el);
  }

  private showWin() {
    const st = this.st!;
    const r = this.result!;
    const perfect = st.perfect(this.hintsUsed);
    const stars = [0, 1, 2].map((k) => `<i class="star ${k === 0 || perfect ? 'on' : ''}">★</i>`).join('');
    const chips = r.earned.map((n, c) => (n > 0 ? `<span class="t">${sq(c)}${n}</span>` : '')).join('');
    const canDouble = !this.doubled && r.total > 0 && ads.rewardedAvailable();
    this.host.modal(`
      <div class="stars">${stars}</div>
      <h2>${t(`pic_${st.level.id}` as Key)}</h2>
      <p>${esc(this.title())}${perfect ? ` · ${t('pz_perfect')}` : ''}</p>
      <div class="earned">${chips || '—'}</div>
      <div class="stack">
        ${this.daily ? '' : `<button class="btn primary" data-a="pz-next">${icon.play} ${t('pz_next')}</button>`}
        ${canDouble ? `<button class="btn" data-a="pz-double">${icon.video} ${t('doubleAd')}</button>` : ''}
        <div class="row2"><button class="btn" data-a="pz-home">${t('home')}</button><button class="btn" data-a="pz-levels">${t('pz_levels')}</button></div>
      </div>`);
    // Let the finished mosaic show above the sheet: shrink the board into the space left.
    this.host.ui.querySelector('.modal')?.classList.add('modal-low');
    const sheet = this.host.ui.querySelector('.sheet');
    if (sheet) {
      this.renderer.insets = { top: this.renderer.insets.top, bottom: window.innerHeight - sheet.getBoundingClientRect().top + 12 };
      this.renderer.layout(st.n);
    }
  }

  async action(a: string, v: string): Promise<boolean> {
    const st = this.st;
    switch (a) {
      case 'pz-hint': {
        if (!st || this.solvedAt >= 0) return true;
        if (save.hints <= 0) {
          const ok = await ads.rewarded(t('pz_hint'));
          if (!ok) {
            this.host.toast(t('adUnavailable'));
            return true;
          }
          save.hints += 1;
        }
        save.hints--;
        persist();
        this.hintsUsed++;
        const k = st.hint();
        if (k >= 0) {
          this.renderer.pulse(st.paths.length - 1);
          haptics.success();
        }
        this.checkSolved();
        return true;
      }
      case 'pz-reset':
        if (st && this.solvedAt < 0) {
          st.reset();
          haptics.light();
        }
        return true;
      case 'pz-next':
        this.host.closeModal();
        void ads.maybeInterstitial();
        this.start(this.levelIndex + 1);
        return true;
      case 'pz-double': {
        if (!this.result) return true;
        const ok = await ads.rewarded(t('doubleAd'));
        if (!ok) {
          this.host.toast(t('adUnavailable'));
          return true;
        }
        doubleRun(save, this.result);
        this.doubled = true;
        persist(true);
        audio.reward();
        this.showWin();
        return true;
      }
      case 'pz-play': {
        const idx = Number(v);
        this.host.closeModal();
        this.start(Number.isFinite(idx) ? idx : save.puzzle.next);
        return true;
      }
      case 'pz-daily':
        this.start(0, true);
        return true;
      case 'pz-home':
        if (this.result) void ads.maybeInterstitial();
        this.host.closeModal();
        this.stop();
        this.host.goHome();
        return true;
      case 'pz-levels':
        this.host.closeModal();
        if (this.result) void ads.maybeInterstitial();
        this.stop();
        this.showLevels();
        return true;
    }
    return false;
  }

  /** Level map: solved levels show their mosaic, the next one is highlighted. */
  showLevels() {
    const total = Math.max(PICTURES.length, Math.ceil((save.puzzle.next + 1) / PICTURES.length) * PICTURES.length);
    const items: string[] = [];
    for (let i = 0; i < total; i++) {
      const stars = save.puzzle.stars[i] ?? 0;
      const open = i <= save.puzzle.next;
      const cls = i === save.puzzle.next ? 'current' : open ? '' : 'locked';
      items.push(`<button class="lvl ${cls}" data-a="${open ? 'pz-play' : ''}" data-v="${i}" ${open ? '' : 'disabled'}>
        <canvas data-lvl="${i}" data-solved="${stars > 0 ? 1 : 0}"></canvas>
        <span>${i + 1}</span><small>${stars === 3 ? '★★★' : stars ? '★' : open ? '' : icon.lock}</small></button>`);
    }
    this.host.ui.innerHTML = `
      <div class="screen">
        <div class="topbar">
          <button class="icon-btn" data-a="pz-home" aria-label="${t('home')}">${icon.back}</button>
          <h2>${t('pz_levels')}<br><small>${save.puzzle.stars.filter(Boolean).length} · ${save.puzzle.stars.filter((s) => s === 3).length} ★★★</small></h2>
        </div>
        <div class="levels">${items.join('')}</div>
      </div>`;
    requestAnimationFrame(() => {
      this.host.ui.querySelectorAll<HTMLCanvasElement>('canvas[data-lvl]').forEach((c) => {
        const lv = levelAt(Number(c.dataset.lvl));
        drawPictureThumb(c, lv.colors, lv.n, c.dataset.solved === '1', this.host.pal());
      });
      this.host.ui.querySelector('.lvl.current')?.scrollIntoView({ block: 'center' });
    });
  }
}
