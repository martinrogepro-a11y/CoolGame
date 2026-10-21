import { ambience } from '../core/ambience';
import { audio } from '../core/audio';
import { haptics } from '../core/haptics';
import { hashString, Rng } from '../core/rng';
import { CityRenderer, drawLandmarkThumb, layoutCity, nightFactor } from '../city/cityRender';
import { DISTRICTS, districtById, MATERIALS, PALETTES, paletteById, type Palette } from '../game/content';
import { Renderer } from '../game/render';
import { Sim, TUNING, type SimEvent, type UpgradeId } from '../game/sim';
import { generateTerrain, T } from '../game/terrain';
import { FRESCOES, type Fresco, frescoNeeds, frescoProgress } from '../meta/frescoes';
import { LANDMARKS, type Landmark } from '../meta/landmarks';
import {
  applyRun, build, canBuild, claimMission, dailyDistrict, dailySeed, districtUnlocked, doubleRun, grantSpread,
  persist, refreshDaily, save, type Mission, type RunResult,
} from '../meta/save';
import { ads } from '../monetization/ads';
import { IAP } from '../monetization/config';
import { iap } from '../monetization/iap';
import { drawFresco } from './frescoRender';
import { t, type Key } from './i18n';
import { levelAt, PuzzleMode, scheduleReminders } from './puzzleMode';
import { notifications } from '../core/services';
import { drawPictureThumb } from '../puzzle/puzzleRender';
import { CHEST_STARS, type LevelResult } from '../meta/save';
import { chapterOf } from '../puzzle/chapters';
import { icon } from './icons';

type Screen = 'home' | 'game' | 'city' | 'collection' | 'shop' | 'settings' | 'puzzle' | 'levels' | 'endless';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const sq = (c: number) => `<i class="sq" style="background:${MATERIALS[c].color}"></i>`;

const UPGRADE_ICON: Record<UpgradeId, string> = {
  belts: icon.belt,
  bridges: icon.bridge,
  overdrive: icon.fast,
  quarry: icon.play,
  patience: icon.calendar,
};

export class App {
  private ui: HTMLElement;
  private board: HTMLCanvasElement;
  private cityCanvas: HTMLCanvasElement;
  private renderer: Renderer;
  private city: CityRenderer;
  private screen: Screen = 'home';
  private sim: Sim | null = null;
  private runDaily = false;
  private runDistrict = 'coast';
  private timeScale = 1;
  private paused = false;
  private eraseMode = false;
  private last = performance.now();
  private result: RunResult | null = null;
  private doubled = false;
  private homeIdx = 0;
  private tutorial = -1;
  private hintTimer = 0;
  private hud: Record<string, HTMLElement> = {};
  private hudCache: Record<string, string | number> = {};
  private pointer: number | null = null;
  private cityDrag: { x: number; y: number; px: number; py: number } | null = null;
  private puzzle: PuzzleMode;
  private frescoDirty = true;
  private frescoToasted = false;

  constructor(root: HTMLElement) {
    root.innerHTML = '<canvas id="board"></canvas><canvas id="city"></canvas><div id="ui"></div>';
    this.board = root.querySelector('#board')!;
    this.cityCanvas = root.querySelector('#city')!;
    this.ui = root.querySelector('#ui')!;
    const pal = paletteById(save.palette);
    this.renderer = new Renderer(this.board, pal);
    this.city = new CityRenderer(this.cityCanvas, pal);
    this.homeIdx = Math.max(0, DISTRICTS.findIndex((d) => d.id === save.district));
    this.puzzle = new PuzzleMode({
      ui: this.ui,
      canvas: this.board,
      pal: () => this.renderer.pal,
      colorblind: () => save.settings.colorblind,
      toast: (m) => this.toast(m),
      modal: (h) => this.modal(h),
      closeModal: () => this.closeModal(),
      goHome: () => this.go('home'),
      afterRewards: (r) => this.levelToasts(r),
    });
    this.applySettings();
    this.bindInput();
    window.addEventListener('resize', () => {
      this.renderer.resize();
      this.city.resize();
      this.puzzle.resize();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.screen === 'game' && this.sim?.state === 'playing') this.setPaused(true);
      if (!document.hidden) {
        refreshDaily(save);
        if (this.screen === 'home') this.go('home');
      }
    });
    this.go('home');
    requestAnimationFrame((n) => this.frame(n));
    if (import.meta.env.DEV) {
      // Test hook: screen positions of the first quarry/workshop (used by the Playwright smoke test).
      const w = window as unknown as Record<string, unknown>;
      w.__dbg = () => {
        const s = this.sim;
        if (!s) return null;
        const r = this.renderer;
        const at = (p: { x: number; y: number }) => [r.ox + (p.x + 0.5) * r.cell, r.oy + (p.y + 0.5) * r.cell];
        return { src: at(s.sources[0]), site: at(s.sites[0]), sites: s.sites.map(at), sources: s.sources.map(at), score: s.stats.score, state: s.state };
      };
      w.__sim = () => this.sim;
      w.__pzPlay = (i: number) => this.action('pz-play', String(i));
    }
  }

  // ---------------------------------------------------------------- setup

  private applySettings() {
    const pal = paletteById(save.palette);
    this.renderer.pal = pal;
    this.renderer.colorblind = save.settings.colorblind;
    this.city.pal = pal;
    const r = document.documentElement.style;
    r.setProperty('--bg', pal.bg);
    r.setProperty('--card', pal.card);
    r.setProperty('--ink', pal.ink);
    r.setProperty('--sub', pal.sub);
    r.setProperty('--line', pal.dots);
    r.setProperty('--accent', pal.ink);
    r.setProperty('--accent-ink', pal.card);
    document.documentElement.classList.toggle('dark', pal.dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', pal.bg);
    audio.setEnabled(save.settings.sound);
    haptics.setEnabled(save.settings.haptics);
    document.documentElement.lang = t('play') === 'Jouer' ? 'fr' : 'en';
  }

  private bindInput() {
    this.ui.addEventListener('click', (e) => {
      const el = (e.target as Element).closest<HTMLElement>('[data-a]');
      if (!el) return;
      audio.unlock();
      audio.tap();
      void this.action(el.dataset.a!, el.dataset.v ?? '');
    });

    const cellAt = (e: PointerEvent) => {
      const r = this.board.getBoundingClientRect();
      return this.renderer.screenToCell(e.clientX - r.left, e.clientY - r.top);
    };
    this.board.addEventListener('pointerdown', (e) => {
      const sim = this.sim;
      if (this.screen !== 'game' || !sim || sim.state !== 'playing' || this.paused || this.pointer !== null) return;
      audio.unlock();
      const c = cellAt(e);
      this.pointer = e.pointerId;
      this.board.setPointerCapture(e.pointerId);
      if (this.eraseMode) sim.erase(c.x, c.y);
      else sim.beginStroke(c.x, c.y);
    });
    this.board.addEventListener('pointermove', (e) => {
      const sim = this.sim;
      if (e.pointerId !== this.pointer || !sim) return;
      const c = cellAt(e);
      // Only register a cell once the finger is well inside it: avoids corner jitter.
      const inner = Math.abs(c.fx - c.x - 0.5) < 0.38 && Math.abs(c.fy - c.y - 0.5) < 0.38;
      if (this.eraseMode) {
        if (inner) sim.erase(c.x, c.y);
      } else if (sim.drawing && inner) sim.extendStroke(c.x, c.y);
    });
    const up = (e: PointerEvent) => {
      if (e.pointerId !== this.pointer) return;
      this.pointer = null;
      this.sim?.endStroke();
    };
    this.board.addEventListener('pointerup', up);
    this.board.addEventListener('pointercancel', up);

    // City: one finger pans, two fingers pinch-zoom.
    const touches = new Map<number, { x: number; y: number }>();
    let pinch0 = 0;
    let zoom0 = 1;
    this.cityCanvas.addEventListener('pointerdown', (e) => {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.cityCanvas.setPointerCapture(e.pointerId);
      if (touches.size === 1) this.cityDrag = { x: e.clientX, y: e.clientY, px: this.city.panX, py: this.city.panY };
      if (touches.size === 2) {
        const [a, b] = [...touches.values()];
        pinch0 = Math.hypot(a.x - b.x, a.y - b.y);
        zoom0 = this.city.zoom;
        this.cityDrag = null;
      }
    });
    this.cityCanvas.addEventListener('pointermove', (e) => {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2 && pinch0 > 0) {
        const [a, b] = [...touches.values()];
        this.city.zoom = Math.max(0.6, Math.min(2.4, (zoom0 * Math.hypot(a.x - b.x, a.y - b.y)) / pinch0));
      } else if (this.cityDrag) {
        this.city.panX = this.cityDrag.px + e.clientX - this.cityDrag.x;
        this.city.panY = this.cityDrag.py + e.clientY - this.cityDrag.y;
      }
    });
    const cityUp = (e: PointerEvent) => {
      touches.delete(e.pointerId);
      this.cityDrag = null;
      pinch0 = 0;
    };
    this.cityCanvas.addEventListener('pointerup', cityUp);
    this.cityCanvas.addEventListener('pointercancel', cityUp);
    this.cityCanvas.addEventListener(
      'wheel',
      (e) => {
        this.city.zoom = Math.max(0.6, Math.min(2.4, this.city.zoom * (e.deltaY > 0 ? 0.92 : 1.08)));
      },
      { passive: true },
    );
  }

  // ---------------------------------------------------------------- navigation

  private go(screen: Screen) {
    this.screen = screen;
    if (screen !== 'puzzle') this.puzzle.stop();
    // Each place has its soundscape, in levels and (softer) behind the home screen.
    if (screen !== 'home' && screen !== 'puzzle' && screen !== 'levels') ambience.stop();
    this.board.style.display = screen === 'game' || screen === 'puzzle' || screen === 'home' ? 'block' : 'none';
    if (screen === 'home') requestAnimationFrame(() => this.puzzle.resizeAmbient());
    this.cityCanvas.style.display = screen === 'city' ? 'block' : 'none';
    this.hud = {};
    this.hudCache = {};
    switch (screen) {
      case 'home': this.ui.innerHTML = this.homeHtml(); this.drawHomeLevel(); break;
      case 'endless': this.ui.innerHTML = this.endlessHtml(); this.drawDistrictPreview(); this.drawFrescoes(); break;
      case 'levels': this.puzzle.showLevels(); break;
      case 'game': this.ui.innerHTML = this.hudHtml(); this.bindHud(); break;
      case 'city': this.ui.innerHTML = this.cityHtml(); this.city.resize(); this.city.setCity(save.lifetime, save.built); this.drawThumbs(); break;
      case 'collection': this.ui.innerHTML = this.collectionHtml(); this.drawThumbs(); this.drawFrescoes(); break;
      case 'shop': this.ui.innerHTML = this.shopHtml(); break;
      case 'settings': this.ui.innerHTML = this.settingsHtml(); break;
    }
    if (screen === 'game') this.renderer.resize();
  }

  private toast(msg: string) {
    let wrap = this.ui.querySelector('.toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      this.ui.appendChild(wrap);
    }
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3300);
  }

  private modal(html: string) {
    this.closeModal();
    const m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = `<div class="sheet">${html}</div>`;
    this.ui.appendChild(m);
  }

  private closeModal() {
    this.ui.querySelectorAll('.modal').forEach((m) => m.remove());
  }

  // ---------------------------------------------------------------- actions

  private async action(a: string, v: string) {
    if (a.startsWith('pz-')) {
      if (a === 'pz-play' || a === 'pz-daily') {
        this.screen = 'puzzle';
        this.board.style.display = 'block';
        this.cityCanvas.style.display = 'none';
      }
      if (a === 'pz-levels') {
        this.screen = 'levels';
        this.board.style.display = 'none';
      }
      await this.puzzle.action(a, v);
      return;
    }
    switch (a) {
      case 'go': this.go(v as Screen); break;
      case 'prev': this.homeIdx = (this.homeIdx + DISTRICTS.length - 1) % DISTRICTS.length; this.go('endless'); break;
      case 'next': this.homeIdx = (this.homeIdx + 1) % DISTRICTS.length; this.go('endless'); break;
      case 'play': {
        const d = DISTRICTS[this.homeIdx];
        if (!districtUnlocked(save, d.id)) return this.toast(t('locked', { n: d.unlockAt }));
        save.district = d.id;
        persist();
        this.startRun(d.id, false);
        break;
      }
      case 'daily': this.startRun(dailyDistrict(), true); break;
      case 'pause': this.setPaused(true); break;
      case 'resume': this.setPaused(false); break;
      case 'quit': this.closeModal(); this.endRunAndLeave('home'); break;
      case 'restart': this.closeModal(); this.finalize(); this.startRun(this.runDistrict, this.runDaily); break;
      case 'erase': this.eraseMode = !this.eraseMode; this.hud.erase?.classList.toggle('on', this.eraseMode); break;
      case 'speed': this.timeScale = this.timeScale === 1 ? 2 : 1; this.hud.speedLbl.textContent = `${this.timeScale}×`; this.hud.speed.classList.toggle('on', this.timeScale > 1); break;
      case 'upgrade': {
        this.sim?.chooseUpgrade(v as UpgradeId);
        this.closeModal();
        haptics.light();
        if (this.tutorial === 1) this.showHint('tut3', 7);
        break;
      }
      case 'revive': {
        const ok = await ads.rewarded(t('continueAd'));
        if (!ok) return this.toast(t('adUnavailable'));
        this.sim?.revive();
        this.renderer.focusSite = -1;
        this.closeModal();
        audio.reward();
        break;
      }
      case 'double': {
        this.finalize();
        const ok = await ads.rewarded(t('doubleAd'));
        if (!ok) return this.toast(t('adUnavailable'));
        if (this.result && !this.doubled) {
          doubleRun(save, this.result);
          this.doubled = true;
          persist(true);
          audio.reward();
          this.showGameOver();
        }
        break;
      }
      case 'again': this.endRunAndLeave('again'); break;
      case 'home': this.endRunAndLeave('home'); break;
      case 'claim': {
        const n = claimMission(save, v);
        if (n) {
          persist();
          audio.reward();
          haptics.success();
          this.toast(`+${n}`);
          this.go('home');
        }
        break;
      }
      case 'gift':
      case 'gift2': {
        if (a === 'gift2') {
          const ok = await ads.rewarded(t('collectX2'));
          if (!ok) return this.toast(t('adUnavailable'));
          grantSpread(save, save.gift);
        }
        grantSpread(save, save.gift);
        save.gift = 0;
        persist(true);
        audio.reward();
        this.go('home');
        break;
      }
      case 'build': {
        const l = LANDMARKS.find((x) => x.id === v);
        if (l && build(save, l)) {
          persist(true);
          audio.reward();
          haptics.success();
          const from = this.screen;
          this.go('city');
          this.city.celebrate(l.id);
          if (from !== 'city') this.toast(t(`lm_${l.id}` as Key));
        }
        break;
      }
      case 'palette': save.palette = v; persist(); this.applySettings(); this.go('collection'); break;
      case 'buy': {
        const ok = await iap.buy(v);
        if (ok) {
          this.toast(t('thanks'));
          audio.reward();
          this.applySettings();
          this.go('shop');
        }
        break;
      }
      case 'restore': await iap.restore(); this.go('shop'); break;
      case 'dev-tap': {
        // Hidden developer mode (like Android's): 5 quick taps on the version line.
        const now = performance.now();
        this.devTaps = now - this.devTapAt < 600 ? this.devTaps + 1 : 1;
        this.devTapAt = now;
        if (this.devTaps >= 5) {
          this.devTaps = 0;
          save.settings.dev = !save.settings.dev;
          persist();
          this.go('settings');
          this.toast(save.settings.dev ? '🛠 Mode dev activé : tous les niveaux sont ouverts' : 'Mode dev désactivé');
        }
        break;
      }
      case 'toggle': {
        const k = v as 'sound' | 'music' | 'ambience' | 'haptics' | 'colorblind' | 'notifications';
        save.settings[k] = !save.settings[k];
        if (k === 'ambience' && !save.settings.ambience) ambience.stop();
        if (k === 'notifications') {
          save.asked.notifications = true;
          if (save.settings.notifications) {
            save.settings.notifications = await notifications.enable();
            if (save.settings.notifications) await scheduleReminders();
          } else await notifications.disable();
        }
        persist();
        this.applySettings();
        this.go('settings');
        break;
      }
      case 'lang': save.settings.lang = v as 'auto' | 'en' | 'fr'; persist(); this.applySettings(); this.go('settings'); break;
      case 'privacy': await ads.showPrivacyOptions(); break;
    }
  }

  // ---------------------------------------------------------------- run lifecycle

  private startRun(districtId: string, daily: boolean) {
    const district = districtById(districtId);
    const firstRun = !save.tutorialDone;
    const seed = daily ? dailySeed() : (Math.random() * 2 ** 31) | 0;
    this.sim = new Sim({ district, seed, gentle: firstRun });
    this.runDistrict = districtId;
    this.runDaily = daily;
    this.result = null;
    this.doubled = false;
    this.frescoDirty = true;
    this.frescoToasted = false;
    this.timeScale = 1;
    this.paused = false;
    this.eraseMode = false;
    this.renderer.resetCamera();
    this.renderer.hint = null;
    this.tutorial = firstRun ? 0 : -1;
    this.go('game');
    if (firstRun) {
      const s = this.sim;
      this.renderer.hint = { from: s.sources[0], to: s.sites[0] };
      this.showHint('tut1', 0);
    }
  }

  /** Applies the run's rewards exactly once. */
  private finalize() {
    if (!this.sim || this.result) return;
    this.result = applyRun(save, this.sim.stats, this.runDistrict, this.runDaily);
    save.tutorialDone = true;
    persist(true);
    for (const m of this.result.missionsDone) this.toast(`✓ ${this.missionText(m)}`);
    for (const d of this.result.unlockedDistricts) this.toast(t('unlockedDistrict', { d: t(`d_${d}` as Key) }));
    for (const l of this.result.revealed) this.toast(t('revealed', { l: t(`lm_${l.id}` as Key) }));
  }

  private endRunAndLeave(next: 'home' | 'again') {
    this.finalize();
    void ads.maybeInterstitial();
    if (next === 'again') this.startRun(this.runDistrict, this.runDaily);
    else {
      this.sim = null;
      this.go('home');
    }
  }

  private setPaused(p: boolean) {
    this.paused = p;
    if (p) {
      this.modal(`<h2>${t('paused')}</h2><p>${esc(this.districtName())}</p>
        <div class="stack">
          <button class="btn primary" data-a="resume">${icon.play} ${t('resume')}</button>
          <div class="row2"><button class="btn" data-a="restart">${t('restart')}</button><button class="btn" data-a="quit">${t('quit')}</button></div>
        </div>`);
    } else this.closeModal();
  }

  private districtName(): string {
    return this.runDaily ? t('daily') : t(`d_${this.runDistrict}` as Key);
  }

  private showHint(key: Key, seconds: number) {
    this.ui.querySelector('.hint')?.remove();
    const el = document.createElement('div');
    el.className = 'hint';
    el.textContent = t(key);
    this.ui.appendChild(el);
    this.hintTimer = seconds;
  }

  private tickTutorial(dt: number) {
    const sim = this.sim!;
    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) this.ui.querySelector('.hint')?.remove();
    }
    if (this.tutorial === 0 && sim.sources[0].outs.length > 0 && !sim.drawing) {
      this.tutorial = 1;
      this.renderer.hint = null;
      this.showHint('tut2', 6);
    }
  }

  // ---------------------------------------------------------------- frame loop

  private frame(now: number) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.screen === 'game' && this.sim) {
      const sim = this.sim;
      if (!this.paused && sim.state === 'playing') {
        let remaining = dt * this.timeScale;
        while (remaining > 1e-6 && sim.state === 'playing') {
          const h = Math.min(1 / 60, remaining);
          sim.step(h);
          remaining -= h;
        }
      }
      const events = sim.drainEvents();
      this.renderer.onEvents(events);
      this.handleEvents(events);
      if (this.tutorial >= 0) this.tickTutorial(dt);
      this.renderer.draw(sim, dt);
      this.updateHud();
    } else if (this.screen === 'home') {
      this.puzzle.ambient(dt);
    } else if (this.screen === 'puzzle') {
      this.puzzle.frame(dt);
    } else if (this.screen === 'city') {
      this.city.draw(dt);
    }
    requestAnimationFrame((n) => this.frame(n));
  }

  private handleEvents(events: SimEvent[]) {
    for (const e of events) {
      switch (e.type) {
        case 'deliver': audio.deliver(e.color, e.combo); haptics.tick(); this.frescoDirty = true; break;
        case 'place': audio.place(); haptics.tick(); break;
        case 'erase': audio.erase(); haptics.light(); break;
        case 'denied': {
          audio.denied();
          haptics.medium();
          const el = e.reason === 'belts' ? this.hud.beltsBox : this.hud.bridgesBox;
          el?.classList.remove('shake');
          void el?.offsetWidth;
          el?.classList.add('shake');
          break;
        }
        case 'spawnSite': case 'spawnSource': audio.spawn(e.color); break;
        case 'unlock': this.toast(t('newMat', { m: t(`mat_${MATERIALS[e.color].key}` as Key) })); break;
        case 'warn': audio.warn(); haptics.warning(); break;
        case 'week': audio.week(); haptics.success(); this.showUpgrade(); break;
        case 'over':
          audio.over();
          haptics.warning();
          this.pointer = null;
          this.sim?.endStroke();
          setTimeout(() => this.showGameOver(), 1200);
          break;
      }
    }
  }

  // ---------------------------------------------------------------- HUD

  private hudHtml(): string {
    const hasWater = this.sim!.cells.some((c) => c.terrain === T.Water);
    return `
      <div class="hud-top">
        <button class="icon-btn" data-a="pause" aria-label="${t('paused')}">${icon.pause}</button>
        <div class="score"><span data-h="score">0</span><small data-h="label"></small></div>
        ${FRESCOES[save.fresco.idx] ? '<canvas class="hud-fresco" data-h="fresco" aria-hidden="true"></canvas>' : ''}
        <div class="week" aria-label="week">
          <svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" fill="none" stroke="var(--line)" stroke-width="4"/>
          <circle data-h="ring" cx="22" cy="22" r="19" fill="none" stroke="var(--ink)" stroke-width="4" stroke-linecap="round" stroke-dasharray="119.4" stroke-dashoffset="119.4"/></svg>
          <span data-h="week">1</span>
        </div>
      </div>
      <div class="hud-bottom">
        <div class="res" data-h="beltsBox">${icon.belt}<span data-h="belts">0</span></div>
        ${hasWater ? `<div class="res" data-h="bridgesBox">${icon.bridge}<span data-h="bridges">0</span></div>` : ''}
        <div class="spacer"></div>
        <button class="tool" data-a="erase" data-h="erase" aria-label="${t('erase')}">${icon.eraser}</button>
        <button class="tool" data-a="speed" data-h="speed" aria-label="speed"><span class="lbl" data-h="speedLbl">1×</span></button>
      </div>`;
  }

  private bindHud() {
    this.ui.querySelectorAll<HTMLElement>('[data-h]').forEach((el) => (this.hud[el.dataset.h!] = el));
    this.hud.label.textContent = this.districtName();
    requestAnimationFrame(() => {
      const top = this.ui.querySelector('.hud-top')!.getBoundingClientRect().bottom;
      const bottom = this.ui.querySelector('.hud-bottom')!.getBoundingClientRect().top;
      this.renderer.insets = { top: top + 12, bottom: window.innerHeight - bottom + 12 };
    });
  }

  private setHud(key: string, value: string | number) {
    if (this.hudCache[key] === value || !this.hud[key]) return;
    this.hudCache[key] = value;
    this.hud[key].textContent = String(value);
  }

  private updateHud() {
    const sim = this.sim!;
    if (this.frescoDirty) {
      this.frescoDirty = false;
      this.drawHudFresco();
    }
    this.setHud('score', sim.stats.score);
    this.setHud('week', sim.week + 1);
    this.setHud('belts', sim.belts);
    this.setHud('bridges', sim.bridges);
    const off = (119.4 * (1 - sim.weekTimer / TUNING.WEEK)).toFixed(1);
    if (this.hudCache.ring !== off && this.hud.ring) {
      this.hudCache.ring = off;
      this.hud.ring.setAttribute('stroke-dashoffset', off);
    }
  }

  private showUpgrade() {
    const sim = this.sim!;
    if (sim.state !== 'upgrade' || sim.offer.length === 0) return;
    const cards = sim.offer
      .map((u) => `<button class="upgrade" data-a="upgrade" data-v="${u}"><span class="ic">${UPGRADE_ICON[u]}</span><b>${t(`up_${u}` as Key)}</b><small>${t(`up_${u}_d` as Key)}</small></button>`)
      .join('');
    this.modal(`<h2>${t('weekDone', { n: sim.week })}</h2><p>${t('weekBonus', { n: TUNING.WEEK_BONUS_BELTS })}</p><div class="upgrades">${cards}</div>`);
  }

  // ---------------------------------------------------------------- frescoes

  /** The fresco the current run is filling, with tiles laid before the run and by the run so far. */
  private runFresco(): { f: Fresco; filled: number[]; fresh: number[] } | null {
    const base = this.result ? this.result.fresco.before : save.fresco;
    const f = FRESCOES[base.idx];
    if (!f || !this.sim) return null;
    const need = frescoNeeds(f);
    const fresh = need.map((n, c) => Math.max(0, Math.min(this.sim!.stats.delivered[c], n - base.filled[c])));
    return { f, filled: base.filled, fresh };
  }

  private drawHudFresco() {
    const canvas = this.hud.fresco as HTMLCanvasElement | undefined;
    const rf = this.runFresco();
    if (!canvas || !rf) return;
    drawFresco(canvas, rf.f, this.renderer.pal, { filled: rf.filled, fresh: rf.fresh, anim: 1 });
    const done = frescoProgress(rf.f, rf.filled.map((n, c) => n + rf.fresh[c])) >= 1;
    if (done && !this.frescoToasted) {
      this.frescoToasted = true;
      this.toast(`${t('frescoDone')} ${t(`fr_${rf.f.id}` as Key)}`);
      audio.reward();
      haptics.success();
    }
  }

  private frescoCard(f: Fresco, filled: number[], cls: string): string {
    const pct = Math.round(frescoProgress(f, filled) * 100);
    const left = frescoNeeds(f).reduce((a, n, c) => a + Math.max(0, n - filled[c]), 0);
    return `<button class="card fresco-card ${cls}" data-a="go" data-v="collection">
      <canvas data-fresco="${f.id}"></canvas>
      <span class="txt"><b>${t('fresco')} · ${t(`fr_${f.id}` as Key)}</b><small>${pct}% · ${t('frescoLeft', { n: left })}</small>
      <span class="bar"><i style="width:${pct}%"></i></span></span></button>`;
  }

  /** Draws every fresco canvas currently in the UI from its data attributes. */
  private drawFrescoes() {
    requestAnimationFrame(() => {
      this.ui.querySelectorAll<HTMLCanvasElement>('canvas[data-fresco]').forEach((c) => {
        const f = FRESCOES.find((x) => x.id === c.dataset.fresco);
        if (!f) return;
        const idx = FRESCOES.indexOf(f);
        const done = save.frescoesDone.includes(f.id);
        const filled = done ? frescoNeeds(f) : idx === save.fresco.idx ? save.fresco.filled : [0, 0, 0, 0, 0];
        drawFresco(c, f, this.renderer.pal, { filled, hidden: !done && idx > save.fresco.idx });
      });
    });
  }

  /** Lays this run's tiles into the big fresco of the end screen, one after another. */
  private animateEndFresco() {
    const canvas = this.ui.querySelector<HTMLCanvasElement>('canvas.fresco-big');
    const rf = this.runFresco();
    if (!canvas || !rf) return;
    const t0 = performance.now();
    const total = rf.fresh.reduce((a, b) => a + b, 0);
    const dur = Math.min(2200, 600 + total * 18);
    let lastTick = 0;
    const step = (now: number) => {
      if (!canvas.isConnected) return;
      const a = Math.min(1, (now - t0) / dur);
      drawFresco(canvas, rf.f, this.renderer.pal, { filled: rf.filled, fresh: rf.fresh, anim: a });
      if (a - lastTick > 0.08 && a < 1) {
        lastTick = a;
        haptics.tick();
      }
      if (a < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  private showGameOver() {
    const sim = this.sim;
    if (!sim || this.screen !== 'game') return;
    const stats = sim.stats;
    const key = this.runDaily ? 'daily' : this.runDistrict;
    const best = Math.max(save.best[key] ?? 0, stats.score);
    const newBest = this.result ? this.result.newBest : stats.score > (save.best[key] ?? 0) && stats.score > 0;
    const earned = this.result ? this.result.earned : stats.delivered.map((n) => Math.round(n * (save.purchases.patron ? 1.5 : 1)));
    const canRevive = !sim.continued && !this.result && ads.rewardedAvailable();
    const canDouble = !this.doubled && earned.some((n) => n > 0) && ads.rewardedAvailable();
    const chips = earned.map((n, c) => (n > 0 ? `<span class="t">${sq(c)}${n}</span>` : '')).join('');
    const rf = this.runFresco();
    let frescoBlock = '';
    if (rf) {
      const after = rf.filled.map((n, c) => n + rf.fresh[c]);
      const done = frescoProgress(rf.f, after) >= 1;
      const laid = rf.fresh.reduce((a, b) => a + b, 0);
      const next = FRESCOES[FRESCOES.indexOf(rf.f) + 1];
      const sub = done
        ? `<span class="badge">${t('frescoDone')}</span><small>${t('frescoReward', { n: 100, f: next ? t(`fr_${next.id}` as Key) : '—' })}</small>`
        : `<small>${t('frescoLaid', { n: laid })} · ${Math.round(frescoProgress(rf.f, after) * 100)}%</small>`;
      frescoBlock = `<div class="fresco-end"><canvas class="fresco-big"></canvas><b>${t(`fr_${rf.f.id}` as Key)}</b>${sub}</div>`;
    }
    this.modal(`
      <h2>${t('gameOver')}</h2>
      <p>${esc(this.districtName())} · ${t('week', { n: sim.week + 1 })}</p>
      <div class="big-score">${stats.score}</div>
      ${newBest ? `<span class="badge">${t('newBest')}</span>` : `<p style="margin:6px 0 0">${t('best', { n: best })}</p>`}
      ${frescoBlock}
      <div class="earned">${chips || '—'}</div>
      <div class="stack">
        ${canRevive ? `<button class="btn gold" data-a="revive">${icon.video} ${t('continueAd')}</button>` : ''}
        ${canDouble ? `<button class="btn" data-a="double">${icon.video} ${t('doubleAd')}</button>` : ''}
        <div class="row2"><button class="btn" data-a="home">${t('home')}</button><button class="btn primary" data-a="again">${t('again')}</button></div>
      </div>`);
    this.animateEndFresco();
  }

  // ---------------------------------------------------------------- home

  private wallet(): string {
    return `<div class="wallet">${save.tesserae
      .map((n, c) => (c < 4 || n > 0 ? `<span class="t">${sq(c)}${n}</span>` : ''))
      .join('')}</div>`;
  }

  private missionText(m: Mission): string {
    const c = m.color !== undefined ? t(`mat_${MATERIALS[m.color].key}` as Key) : '';
    return t(`m_${m.kind}` as Key, { n: m.goal, c });
  }

  private levelCardHtml(): string {
    const next = save.puzzle.next;
    const lv = levelAt(next);
    const { chapter, ci, li } = chapterOf(next);
    const chest = Math.min(100, Math.round((save.puzzle.chest / CHEST_STARS) * 100));
    return `<button class="card level-card" data-a="pz-play" data-v="${next}">
        <canvas class="next-pic"></canvas>
        <span class="txt"><small>${t('pz_chapter')} ${['I', 'II', 'III', 'IV', 'V', 'VI'][ci] ?? ci + 1} · ${t(`ch_${chapter.id}` as Key)}</small><b>${t('pz_level', { n: next + 1 })}</b>
        <small>${lv.n}×${lv.n} · ${li + 1}/${chapter.pictures.length}</small></span>
        <span class="go">${icon.play}</span></button>
      <button class="card chest-row ${save.puzzle.chest >= CHEST_STARS ? 'ready' : ''}" data-a="pz-levels">
        <span class="ic">${icon.gift}</span><span class="txt"><b>${t('pz_journey')}</b><span class="bar"><i style="width:${chest}%"></i></span></span>
        <small>${Math.min(save.puzzle.chest, CHEST_STARS)}/${CHEST_STARS} ★</small></button>`;
  }

  private drawHomeLevel() {
    requestAnimationFrame(() => {
      const c = this.ui.querySelector<HTMLCanvasElement>('canvas.next-pic');
      if (!c) return;
      const lv = levelAt(save.puzzle.next);
      drawPictureThumb(c, lv.colors, lv.n, false, this.renderer.pal);
    });
  }

  private levelToasts(r: LevelResult) {
    for (const m of r.missionsDone) this.toast(`✓ ${this.missionText(m)}`);
    for (const d of r.unlockedDistricts) this.toast(t('unlockedDistrict', { d: t(`d_${d}` as Key) }));
    for (const l of r.revealed) this.toast(t('revealed', { l: t(`lm_${l.id}` as Key) }));
  }

  /** The endless "Current" mode: district picker, fresco in progress. */
  private endlessHtml(): string {
    const d = DISTRICTS[this.homeIdx];
    const unlocked = districtUnlocked(save, d.id);
    const best = save.best[d.id] ?? 0;
    return `
      <div class="screen">
        <div class="topbar">
          <button class="icon-btn" data-a="go" data-v="home" aria-label="${t('home')}">${icon.back}</button>
          <h2>${t('endless')}<br><small>${t('endless_d')}</small></h2>
        </div>
        <div class="district">
          <button class="icon-btn" data-a="prev" aria-label="prev">${icon.left}</button>
          <div class="card ${unlocked ? '' : 'locked'}">
            <canvas class="preview"></canvas>
            <span><h2>${t(`d_${d.id}` as Key)}</h2>
            <small>${unlocked ? t('best', { n: best }) : `${icon.lock} ${t('locked', { n: d.unlockAt })}`}</small></span>
          </div>
          <button class="icon-btn" data-a="next" aria-label="next">${icon.right}</button>
        </div>
        <button class="big-btn" data-a="play" ${unlocked ? '' : 'disabled'}>${unlocked ? icon.play : icon.lock} ${t('play')}</button>
        ${FRESCOES[save.fresco.idx] ? this.frescoCard(FRESCOES[save.fresco.idx], save.fresco.filled, '') : ''}
        <p class="note">${t('endless_how')}</p>
      </div>`;
  }

  private homeHtml(): string {
    refreshDaily(save);
    const tiles = [0, 1, 2, 3, 3, 0, 1, 2, 2, 3, 0, 1]
      .map((c, k) => `<i style="background:${MATERIALS[c].color};animation-delay:${k * 40}ms"></i>`)
      .join('');
    const missions = save.missions.list
      .map((m) => {
        const done = m.progress >= m.goal;
        const right = m.claimed
          ? `<span class="reward">${icon.check}</span>`
          : done
            ? `<button class="btn primary" data-a="claim" data-v="${m.id}">${t('claim')} +${m.reward}</button>`
            : `<span class="reward">+${m.reward}</span>`;
        return `<div class="mission"><div class="txt"><span>${esc(this.missionText(m))}</span>
          <div class="bar"><i style="width:${Math.round((m.progress / m.goal) * 100)}%"></i></div></div>${right}</div>`;
      })
      .join('');
    const daily = save.daily.played ? t('pz_dailyDone') : t('dailyNew');
    const gift = save.gift > 0
      ? `<div class="card gift"><span class="ic">${icon.gift}</span><b>${t('gift', { n: save.gift })}</b>
          <button class="btn" data-a="gift">${t('collect')}</button><button class="btn gold" data-a="gift2">${icon.video}×2</button></div>`
      : '';
    return `
      <div class="screen">
        <div class="row">
          <span class="chip flame">${icon.flame}<b>${save.streak.count}</b></span>
          <div class="spacer"></div>
          <button class="icon-btn" data-a="go" data-v="settings" aria-label="${t('settings')}">${icon.gear}</button>
        </div>
        <div class="logo"><div class="tiles">${tiles}</div><h1>CANALIA</h1><p>${t('tagline')}</p></div>
        ${this.levelCardHtml()}
        <div class="duo">
          <button class="card mini" data-a="pz-daily"><span class="ic gold">${icon.calendar}</span><b>${t('daily')}</b><small>${esc(daily)}</small></button>
          <button class="card mini" data-a="go" data-v="endless"><span class="ic">${icon.belt}</span><b>${t('endless')}</b><small>${t('endless_d')}</small></button>
        </div>
        ${gift}
        <div class="section-title">${t('missions')}</div>
        <div class="card" style="padding:0">${missions}</div>
        <div class="nav">
          <button data-a="go" data-v="city">${icon.city}${t('city')}</button>
          <button data-a="go" data-v="collection">${icon.grid}${t('collection')}</button>
          <button data-a="go" data-v="shop">${icon.bag}${t('shop')}</button>
        </div>
      </div>`;
  }

  private drawDistrictPreview() {
    const canvas = this.ui.querySelector<HTMLCanvasElement>('canvas.preview');
    if (!canvas) return;
    const d = DISTRICTS[this.homeIdx];
    const pal = this.renderer.pal;
    const w = TUNING.W, h = TUNING.H;
    const terrain = generateTerrain(d.terrain, w, h, new Rng(hashString(d.id)));
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const size = canvas.clientWidth || 120;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const g = canvas.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = pal.bg;
    g.fillRect(0, 0, size, size);
    const cell = size / h;
    const ox = (size - w * cell) / 2;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const v = terrain[y * w + x];
        if (v === T.Water) {
          g.fillStyle = pal.water;
          g.fillRect(ox + x * cell, y * cell, cell + 0.5, cell + 0.5);
        } else if (v === T.Rock) {
          g.fillStyle = pal.rockInk;
          g.beginPath();
          g.roundRect(ox + x * cell + 1, y * cell + 1, cell - 2, cell - 2, 2);
          g.fill();
        }
      }
    // A hint of a canal and tiles, as a signature.
    const rng = new Rng(hashString('pv' + d.id));
    const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(ox + (cx - 1.5) * cell, (cy - 1.5) * cell);
    g.lineTo(ox + (cx + 1.5) * cell, (cy - 1.5) * cell);
    g.lineTo(ox + (cx + 1.5) * cell, (cy + 1.5) * cell);
    g.strokeStyle = pal.canalEdge;
    g.lineWidth = cell * 0.55;
    g.stroke();
    g.strokeStyle = pal.canal;
    g.lineWidth = cell * 0.36;
    g.stroke();
    const c1 = MATERIALS[rng.int(0, 4)].color;
    g.fillStyle = c1;
    g.beginPath();
    g.arc(ox + (cx - 1.5) * cell, (cy - 1.5) * cell, cell * 0.45, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = pal.card;
    g.strokeStyle = c1;
    g.lineWidth = cell * 0.15;
    g.beginPath();
    g.roundRect(ox + (cx + 1) * cell, (cy + 1.1) * cell, cell, cell, cell * 0.2);
    g.fill();
    g.stroke();
  }

  // ---------------------------------------------------------------- city & collection

  private landmarkCard(l: Landmark): string {
    const built = save.built.includes(l.id);
    const revealed = l.premium ? true : save.lifetime >= l.revealAt;
    const name = revealed ? t(`lm_${l.id}` as Key) : '???';
    let body: string;
    if (built) body = `<button class="btn" disabled>${icon.check} ${t('built')}</button>`;
    else if (l.premium && !save.purchases.patron) body = `<small>${t('patron')}</small><button class="btn gold" data-a="go" data-v="shop">${icon.bag}</button>`;
    else if (!revealed) body = `<small>${t('hidden', { n: l.revealAt })}</small>`;
    else {
      const cost = l.cost
        .map((n, c) => (n > 0 ? `<span class="${save.tesserae[c] < n ? 'miss' : ''}">${sq(c)}${n}</span>` : ''))
        .join('');
      body = `<div class="cost">${cost || '—'}</div><button class="btn primary" data-a="build" data-v="${l.id}" ${canBuild(save, l) ? '' : 'disabled'}>${t('build')}</button>`;
    }
    return `<div class="lm"><canvas data-lm="${l.id}" data-locked="${revealed ? 0 : 1}"></canvas><span class="rar ${l.rarity}">${t(`r_${l.rarity}` as Key)}</span><b>${esc(name)}</b>${body}</div>`;
  }

  private drawThumbs() {
    requestAnimationFrame(() => {
      this.ui.querySelectorAll<HTMLCanvasElement>('canvas[data-lm]').forEach((c) => drawLandmarkThumb(c, c.dataset.lm!, c.dataset.locked === '1', this.renderer.pal));
    });
  }

  private cityHtml(): string {
    const houses = layoutCity(save.lifetime, save.built).filter((p) => p.kind === 'house').length;
    const list = LANDMARKS.filter((l) => !save.built.includes(l.id) && (l.premium ? save.purchases.patron : save.lifetime >= l.revealAt))
      .sort((a, b) => Number(canBuild(save, b)) - Number(canBuild(save, a)));
    return `
      <div class="screen transparent ${nightFactor() > 0.5 ? 'night' : ''}">
        <div class="topbar">
          <button class="icon-btn" data-a="go" data-v="home" aria-label="${t('home')}">${icon.back}</button>
          <h2>${t('city')}<br><small>${save.lifetime ? t('cityStats', { h: houses, l: save.built.length }) : t('cityEmpty')}</small></h2>
        </div>
        ${this.wallet()}
        <div class="city-sheet">${list.map((l) => this.landmarkCard(l)).join('')}</div>
      </div>`;
  }

  private collectionHtml(): string {
    const pals = PALETTES.map((p: Palette) => {
      const owned = save.palettes.includes(p.id);
      const using = save.palette === p.id;
      const right = using
        ? `<button class="btn" disabled>${t('inUse')}</button>`
        : owned
          ? `<button class="btn primary" data-a="palette" data-v="${p.id}">${t('use')}</button>`
          : `<span>${icon.lock}</span>`;
      const how = owned ? '' : `<small>${t(`palHow_${p.id}` as Key)}</small>`;
      return `<div class="pal"><span class="sw"><i style="background:${p.bg}"></i><i style="background:${p.water}"></i><i style="background:${p.canal}"></i><i style="background:${p.card}"></i></span>
        <span class="txt"><b>${t(`pal_${p.id}` as Key)}</b>${how}</span>${right}</div>`;
    }).join('');
    const built = LANDMARKS.filter((l) => save.built.includes(l.id)).length;
    return `
      <div class="screen">
        <div class="topbar">
          <button class="icon-btn" data-a="go" data-v="home" aria-label="${t('home')}">${icon.back}</button>
          <h2>${t('collection')}<br><small>${t('landmarks')} ${built}/${LANDMARKS.length}</small></h2>
        </div>
        ${this.wallet()}
        <div class="section-title">${t('frescoes')} ${save.frescoesDone.length}/${FRESCOES.length}</div>
        <div class="gallery">${FRESCOES.map((f, i) => {
          const done = save.frescoesDone.includes(f.id);
          const known = done || i <= save.fresco.idx;
          const label = known ? t(`fr_${f.id}` as Key) : '???';
          const sub = done ? icon.check : i === save.fresco.idx ? `${Math.round(frescoProgress(f, save.fresco.filled) * 100)}%` : icon.lock;
          return `<div class="frame"><canvas data-fresco="${f.id}"></canvas><span>${esc(label)}</span><small>${sub}</small></div>`;
        }).join('')}</div>
        ${FRESCOES[save.fresco.idx] ? '' : `<p class="note">${t('frescoAll')}</p>`}
        <div class="section-title">${t('landmarks')}</div>
        <div class="coll-grid">${LANDMARKS.map((l) => this.landmarkCard(l)).join('')}</div>
        <div class="section-title">${t('palettes')}</div>
        <div class="card" style="padding:0 4px">${pals}</div>
      </div>`;
  }

  // ---------------------------------------------------------------- shop & settings

  private shopHtml(): string {
    const P = IAP.products;
    const item = (id: string, ic: string, title: Key, desc: Key, owned: boolean, hero = false) => `
      <div class="card shop-item ${hero ? 'hero' : ''}"><span class="ic">${ic}</span>
        <span class="txt"><b>${t(title)}</b><small>${t(desc)}</small></span>
        ${owned ? `<button class="btn" disabled>${icon.check}</button>` : `<button class="btn ${hero ? 'gold' : 'primary'}" data-a="buy" data-v="${id}">${esc(iap.price(id))}</button>`}
      </div>`;
    return `
      <div class="screen">
        <div class="topbar">
          <button class="icon-btn" data-a="go" data-v="home" aria-label="${t('home')}">${icon.back}</button>
          <h2>${t('shop')}</h2>
        </div>
        ${item(P.patron, icon.flame, 'patron', 'patron_d', save.purchases.patron, true)}
        ${item(P.noAds, icon.close, 'noAds', 'noAds_d', save.purchases.noAds)}
        ${item(P.tesseraeS, icon.grid, 'tilesS', 'tilesS_d', false)}
        ${item(P.tesseraeL, icon.gift, 'tilesL', 'tilesL_d', false)}
        <button class="link" data-a="restore">${t('restore')}</button>
      </div>`;
  }

  private devTaps = 0;
  private devTapAt = 0;

  private settingsHtml(): string {
    const s = save.settings;
    const tog = (k: 'sound' | 'music' | 'ambience' | 'haptics' | 'colorblind' | 'notifications', label: Key) =>
      `<div class="setting"><span>${t(label)}</span><button class="toggle ${s[k] ? 'on' : ''}" data-a="toggle" data-v="${k}" aria-pressed="${s[k]}"></button></div>`;
    const seg = (['auto', 'en', 'fr'] as const).map((l) => `<button class="${s.lang === l ? 'on' : ''}" data-a="lang" data-v="${l}">${l === 'auto' ? 'Auto' : l.toUpperCase()}</button>`).join('');
    return `
      <div class="screen">
        <div class="topbar">
          <button class="icon-btn" data-a="go" data-v="home" aria-label="${t('home')}">${icon.back}</button>
          <h2>${t('settings')}</h2>
        </div>
        <div class="card" style="padding:0 14px">
          ${tog('sound', 'sound')}
          ${tog('music', 'music')}
          ${tog('ambience', 'ambienceSetting')}
          ${tog('haptics', 'haptics')}
          ${tog('notifications', 'notifSetting')}
          ${tog('colorblind', 'colorblind')}
          <div class="setting"><span>${t('language')}</span><div class="seg">${seg}</div></div>
          <div class="setting"><span>${t('privacy')}</span><button class="btn" data-a="privacy">›</button></div>
        </div>
        <div class="credits" data-a="dev-tap">${s.dev ? '🛠 Mode dev · ' : ''}Canalia v${__APP_VERSION__} · ${save.runs} runs · ${save.lifetime} tesserae</div>
      </div>`;
  }
}
