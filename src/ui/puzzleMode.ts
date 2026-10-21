import { analytics } from '../core/analytics';
import { ambience } from '../core/ambience';
import { audio, music } from '../core/audio';
import { haptics } from '../core/haptics';
import { dayKey } from '../core/rng';
import { notifications, review, shareText } from '../core/services';
import { MATERIALS, type Palette } from '../game/content';
import {
  applyLevel, CHEST_STARS, claimAlbum, doubleRun, openChest, persist, save, type ChestReward, type LevelResult,
} from '../meta/save';
import { restoredIn } from '../meta/village';
import { ads } from '../monetization/ads';
import { chapterOf, CHAPTERS, firstLevelOf, LEVEL_COUNT } from '../puzzle/chapters';
import { dailyLevel, isHard, levelAt } from '../puzzle/levels';
import { PuzzleState } from '../puzzle/puzzle';
import type { ThemeId } from '../puzzle/scene';
import { drawPictureThumb, PuzzleRenderer } from '../puzzle/puzzleRender';
import { t, type Key } from './i18n';
import { icon } from './icons';

export { levelAt } from '../puzzle/levels';

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

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const sq = (c: number) => `<i class="sq" style="background:${MATERIALS[c].color}"></i>`;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const EMOJI = ['🟥', '🟦', '🟩', '🟨', '🟪', '⬜'];

/** Timeline of the solve ceremony, in seconds after the last canal is linked. */
const CEREMONY = { reveal: 0.55, revealDur: 1.4, glint: 2.05, glintDur: 0.8, sheet: 2.75 };

export class PuzzleMode {
  private st: PuzzleState | null = null;
  private renderer: PuzzleRenderer;
  private levelIndex = 0;
  private daily = false;
  private hintsUsed = 0;
  private solvedAt = -1;
  private revealPlayed = false;
  private result: LevelResult | null = null;
  private doubled = false;
  private pointer: number | null = null;
  private fillToast = false;
  private startedAt = 0;
  private elapsed = 0;
  private albumDone: string | null = null;
  private askNotif = false;
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
      if (save.settings.music) music.start();
      const c = cellOf(e);
      if (c.i < 0 || this.st.begin(c.i) < 0) return;
      this.renderer.demo = null;
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
          audio.flow(this.st.pathColor(k), this.st.connectedCount());
          haptics.success();
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
    this.revealPlayed = false;
    this.result = null;
    this.doubled = false;
    this.fillToast = false;
    this.albumDone = null;
    this.askNotif = false;
    this.startedAt = performance.now();
    analytics.track('level_start', { level: index, daily, picture: lv.id, size: lv.n });
    this.renderer.reveal = 0;
    this.renderer.glint = 0;
    this.renderer.title = t(`pic_${lv.id}` as Key);
    this.renderer.demo = !daily && index === 0 ? lv.solution[0] : null;
    // Each chapter has its own mood around the board; the daily puzzle rotates through them.
    // The daily puzzle takes the place (and the mechanic) of its picture's chapter.
    const home = daily ? CHAPTERS.find((c) => c.pictures.includes(lv.id)) : chapterOf(index).chapter;
    const theme = (home?.id ?? 'garden') as ThemeId;
    this.renderer.scene.theme = theme;
    this.renderer.scene.seed = (daily ? 999 : index) + 1;
    this.renderer.scene.scale = 1;
    this.renderer.scene.restored = restoredIn(save.village, theme);
    if (save.settings.ambience) {
      ambience.play(theme);
      ambience.setVolume(1);
    }
    this.host.ui.classList.toggle('pz-dark', theme === 'night' || theme === 'deep');
    this.host.ui.innerHTML = this.hudHtml();
    this.hud = {};
    this.host.ui.querySelectorAll<HTMLElement>('[data-h]').forEach((el) => (this.hud[el.dataset.h!] = el));
    this.renderer.pal = this.host.pal();
    this.renderer.colorblind = this.host.colorblind();
    this.renderer.resize();
    const layout = () => {
      const top = this.host.ui.querySelector('.hud-top')?.getBoundingClientRect().bottom ?? 90;
      const bottom = this.host.ui.querySelector('.hud-bottom')?.getBoundingClientRect().top ?? window.innerHeight - 100;
      this.renderer.insets = { top: top + 40, bottom: window.innerHeight - bottom + 16 };
      this.renderer.layout(lv.n);
    };
    layout();
    requestAnimationFrame(layout);
    if (!daily) {
      const { chapter, ci, li, encore } = chapterOf(index);
      if (li === 0) this.showChapterCard(ci, chapter.id, encore);
      if (index === 0) this.showTip(t('pz_tut1'));
      else if (index === 1) this.showTip(t('pz_tut2'));
      else if (li === 0 && ci > 0 && lv.features) this.showTip(t(`pz_mech_${chapter.id}` as Key));
    }
  }

  /** Home backdrop: the scene of the chapter the player is in. */
  ambient(dt: number) {
    const { chapter } = chapterOf(save.puzzle.next);
    if (this.renderer.scene.theme !== chapter.id || this.renderer.scene.seed !== 7 || this.renderer.scene.scale !== 0.55) {
      this.renderer.scene.theme = chapter.id as ThemeId;
      this.renderer.scene.seed = 7;
      this.renderer.scene.scale = 0.55;
      this.renderer.scene.restored = restoredIn(save.village, chapter.id as ThemeId);
      this.renderer.pal = this.host.pal();
      this.renderer.resize();
    }
    if (save.settings.ambience && save.settings.sound) {
      ambience.play(chapter.id as ThemeId);
      ambience.setVolume(0.55);
    }
    this.renderer.drawAmbient(dt, 0.42);
  }

  /** The village screen: the place's scene, large, with its soundscape. */
  villageView(dt: number, place: ThemeId) {
    const sc = this.renderer.scene;
    const restored = restoredIn(save.village, place);
    if (sc.theme !== place || sc.seed !== 7 || sc.scale !== 0.85 || [...restored].join() !== [...sc.restored].join()) {
      sc.theme = place;
      sc.seed = 7;
      sc.scale = 0.85;
      sc.restored = restored;
      this.renderer.resize();
    }
    if (save.settings.ambience && save.settings.sound) {
      ambience.play(place);
      ambience.setVolume(0.8);
    }
    this.renderer.drawAmbient(dt, 0.36);
  }

  resizeAmbient() {
    this.renderer.resize();
  }

  stop() {
    this.host.ui.classList.remove('pz-dark');
    this.st = null;
    this.pointer = null;
    music.stop();
  }

  resize() {
    this.renderer.resize();
    if (this.st) this.renderer.layout(this.st.n);
  }

  frame(dt: number) {
    if (!this.st) return;
    if (this.solvedAt >= 0) {
      this.solvedAt += dt;
      const s = this.solvedAt;
      if (s >= CEREMONY.reveal && !this.revealPlayed) {
        this.revealPlayed = true;
        audio.reveal(CEREMONY.revealDur);
      }
      this.renderer.reveal = Math.min(1, Math.max(0, (s - CEREMONY.reveal) / CEREMONY.revealDur));
      this.renderer.glint = Math.min(1, Math.max(0, (s - CEREMONY.glint) / CEREMONY.glintDur));
      if (s > CEREMONY.sheet && !this.result) this.finish();
    }
    this.renderer.draw(this.st, dt);
    this.updateHud();
  }

  private checkSolved() {
    const st = this.st!;
    if (st.solved()) {
      this.solvedAt = 0;
      this.elapsed = (performance.now() - this.startedAt) / 1000;
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
    analytics.track(this.daily ? 'daily_complete' : 'level_complete', {
      level: this.levelIndex, seconds: Math.round(this.elapsed), hints: this.hintsUsed, perfect, moves: st.moves,
    });
    if (!this.daily) {
      // Album: all ten pictures of the chapter solved.
      const { chapter, ci, encore } = chapterOf(this.levelIndex);
      const first = firstLevelOf(ci) + encore * LEVEL_COUNT;
      const complete = chapter.pictures.every((_, k) => (save.puzzle.stars[first + k] ?? 0) > 0);
      if (encore === 0 && complete && claimAlbum(save, chapter.id, chapter.reward)) {
        this.albumDone = chapter.id;
        analytics.track('album_complete', { chapter: chapter.id });
      }
      // Ask for a store rating at a happy moment, once: a perfect solve after some play.
      if (perfect && this.levelIndex >= 9 && !save.asked.review) {
        save.asked.review = true;
        void review.request();
      }
      // Soft-ask for notifications after the player has clearly enjoyed a few levels.
      this.askNotif = this.levelIndex >= 4 && !save.asked.notifications;
    }
    persist(true);
    audio.reward();
    this.host.afterRewards(this.result);
    this.showWin();
  }

  // ---------------------------------------------------------------- UI

  private title(): string {
    return this.daily ? t('daily') : t('pz_level', { n: this.levelIndex + 1 });
  }

  private subtitle(): string {
    if (this.daily) return '';
    const { chapter } = chapterOf(this.levelIndex);
    return t(`ch_${chapter.id}` as Key);
  }

  private hudHtml(): string {
    const hard = !this.daily && isHard(this.levelIndex);
    return `
      <div class="hud-top">
        <button class="icon-btn" data-a="pz-home" aria-label="${t('home')}">${icon.back}</button>
        <div class="score pz-title"><span>${esc(this.title())}</span><small data-h="progress"></small>
          ${hard ? `<em class="hard">${t('pz_hard')}</em>` : ''}</div>
        <button class="icon-btn pz-hint" data-a="pz-hint" aria-label="${t('pz_hint')}">${icon.bulb}<b data-h="hints">${save.hints}</b></button>
      </div>
      <div class="hud-bottom pz-bottom">
        <button class="tool" data-a="pz-reset" aria-label="${t('restart')}">${icon.reset}</button>
        ${save.settings.dev ? `<button class="tool dev-solve" data-a="pz-devsolve" aria-label="Solve">⏭</button>` : ''}
        <div class="spacer"></div>
        <div class="res pz-pairs" data-h="pairs"></div>
      </div>`;
  }

  private updateHud() {
    const st = this.st!;
    const pct = Math.round((st.filledCount() / (st.n * st.n)) * 100);
    const sub = this.subtitle();
    const txt = `${sub ? sub + ' · ' : ''}${pct}%`;
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

  /** Title card when entering a chapter, like turning the page of a book. */
  private showChapterCard(ci: number, id: string, encore: number) {
    const el = document.createElement('div');
    el.className = 'chapter-card';
    el.innerHTML = `<small>${t('pz_chapter')} ${ROMAN[ci] ?? ci + 1}${encore ? ` · ${t('pz_encore', { n: encore })}` : ''}</small><b>${t(`ch_${id}` as Key)}</b><span>${t(`ch_${id}_d` as Key)}</span>`;
    this.host.ui.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  private shareTextFor(): string {
    const st = this.st!;
    const n = st.n;
    const perfect = st.perfect(this.hintsUsed);
    const mm = Math.floor(this.elapsed / 60);
    const ss = String(Math.round(this.elapsed % 60)).padStart(2, '0');
    const rows: string[] = [];
    for (let y = 0; y < n; y++) rows.push(st.level.colors.slice(y * n, y * n + n).map((c) => EMOJI[c] ?? '⬜').join(''));
    return `Canalia · ${t('daily')} ${dayKey()}\n${perfect ? '★★★' : '★'} · ${mm}:${ss}\n${rows.join('\n')}\n#Canalia`;
  }

  private showWin() {
    const st = this.st!;
    const r = this.result!;
    const perfect = st.perfect(this.hintsUsed);
    const stars = [0, 1, 2].map((k) => `<i class="star ${k === 0 || perfect ? 'on' : ''}">★</i>`).join('');
    const chips = r.earned.map((n, c) => (n > 0 ? `<span class="t">${sq(c)}${n}</span>` : '')).join('');
    const canDouble = !this.doubled && r.total > 0 && ads.rewardedAvailable();
    const chestPct = Math.min(100, Math.round((save.puzzle.chest / CHEST_STARS) * 100));
    const chestReady = save.puzzle.chest >= CHEST_STARS;
    const chest = `<button class="chest-row ${chestReady ? 'ready' : ''}" data-a="${chestReady ? 'pz-chest' : ''}">
        <span class="ic">${icon.gift}</span><span class="txt"><b>${chestReady ? t('pz_chestOpen') : t('pz_chest')}</b>
        <span class="bar"><i style="width:${chestPct}%"></i></span></span><small>${Math.min(save.puzzle.chest, CHEST_STARS)}/${CHEST_STARS} ★</small></button>`;
    const album = this.albumDone
      ? `<div class="album-done">${icon.check}<span><b>${t('pz_albumDone', { c: t(`ch_${this.albumDone}` as Key) })}</b><small>${t('pz_albumReward', { n: CHAPTERS.find((c) => c.id === this.albumDone)!.reward.hints })}</small></span></div>`
      : '';
    // One extra card at most, so the revealed picture keeps its space.
    const notif = this.askNotif && !this.albumDone && !chestReady
      ? `<div class="soft-ask"><span>${t('notif_ask')}</span><div class="row2"><button class="btn" data-a="pz-notif-no">${t('notif_later')}</button><button class="btn primary" data-a="pz-notif-yes">${t('notif_yes')}</button></div></div>`
      : '';
    const last = !this.daily && this.levelIndex + 1 >= LEVEL_COUNT && chapterOf(this.levelIndex + 1).encore > chapterOf(this.levelIndex).encore;
    this.host.modal(`
      <div class="stars">${stars}</div>
      <h2 class="display">${esc(t(`pic_${st.level.id}` as Key))}</h2>
      <p>${esc(this.title())}${this.subtitle() ? ` · ${esc(this.subtitle())}` : ''}${perfect ? ` · ${t('pz_perfect')}` : ''}</p>
      <div class="earned">${chips || '—'}</div>
      ${album}
      ${chest}
      ${notif}
      <div class="stack">
        ${this.daily ? `<button class="btn primary" data-a="pz-share">${icon.share} ${t('pz_share')}</button>` : `<button class="btn primary" data-a="pz-next">${icon.play} ${last ? t('pz_encoreStart') : t('pz_next')}</button>`}
        ${canDouble ? `<button class="btn" data-a="pz-double">${icon.video} ${t('doubleAd')}</button>` : ''}
        <div class="row2"><button class="btn" data-a="pz-home">${t('home')}</button><button class="btn" data-a="pz-levels">${t('pz_journey')}</button></div>
      </div>`);
    // Let the finished mosaic show above the sheet: shrink the board into the space left.
    this.host.ui.querySelector('.modal')?.classList.add('modal-low');
    const sheet = this.host.ui.querySelector('.sheet');
    if (sheet) {
      this.renderer.insets = { top: this.renderer.insets.top, bottom: window.innerHeight - sheet.getBoundingClientRect().top + 12 };
      this.renderer.layout(st.n);
    }
  }

  private chestModal(r: ChestReward) {
    this.host.modal(`
      <div class="chest-burst">${icon.gift}</div>
      <h2 class="display">${t('pz_chestTitle')}</h2>
      <div class="earned"><span class="t">${icon.bulb} +${r.hints}</span><span class="t">${sq(0)}${sq(1)} +${r.tesserae}</span></div>
      ${r.palette ? `<p>${t('pz_chestPalette', { p: t(`pal_${r.palette}` as Key) })}</p>` : ''}
      <div class="stack"><button class="btn primary" data-a="pz-chest-ok">${t('collect')}</button></div>`);
  }

  async action(a: string, v: string): Promise<boolean> {
    const st = this.st;
    switch (a) {
      case 'pz-devsolve': {
        if (!st || this.solvedAt >= 0) return true;
        this.renderer.demo = null;
        while (st.hint() >= 0);
        this.checkSolved();
        return true;
      }
      case 'pz-devjump':
        this.host.ui.querySelector(`#ch-${v}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        return true;
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
        analytics.track('hint_used', { level: this.levelIndex, daily: this.daily });
        this.renderer.demo = null;
        const k = st.hint();
        if (k >= 0) {
          this.renderer.pulse(st.paths.length - 1);
          audio.flow(st.pathColor(st.paths.length - 1), st.connectedCount());
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
      case 'pz-chest': {
        const r = openChest(save, Date.now());
        if (!r) return true;
        analytics.track('chest_open', { hints: r.hints, palette: r.palette ?? '' });
        persist(true);
        audio.reward();
        haptics.success();
        this.chestModal(r);
        return true;
      }
      case 'pz-chest-ok':
        if (this.result && this.st) this.showWin();
        else {
          this.host.closeModal();
          this.showLevels();
        }
        return true;
      case 'pz-share': {
        const res = await shareText(this.shareTextFor());
        analytics.track('share', { how: res });
        if (res === 'copied') this.host.toast(t('pz_copied'));
        return true;
      }
      case 'pz-notif-yes': {
        save.asked.notifications = true;
        this.askNotif = false;
        save.settings.notifications = await notifications.enable();
        analytics.track('notif_opt_in', { granted: save.settings.notifications });
        if (save.settings.notifications) await scheduleReminders();
        persist();
        this.showWin();
        return true;
      }
      case 'pz-notif-no':
        save.asked.notifications = true;
        this.askNotif = false;
        persist();
        this.showWin();
        return true;
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
        if (!this.result && st) analytics.track('level_quit', { level: this.levelIndex, filled: st.filledCount(), seconds: Math.round((performance.now() - this.startedAt) / 1000) });
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

  /** The journey: chapters as album pages; solved pictures show their mosaic. */
  showLevels() {
    const dev = !!save.settings.dev;
    const rounds = Math.floor(save.puzzle.next / LEVEL_COUNT) + 1;
    const chestReady = save.puzzle.chest >= CHEST_STARS;
    const parts: string[] = [];
    for (let round = 0; round < rounds; round++) {
      CHAPTERS.forEach((ch, ci) => {
        const first = round * LEVEL_COUNT + firstLevelOf(ci);
        if (first > save.puzzle.next && round > 0) return;
        const solved = ch.pictures.filter((_, k) => (save.puzzle.stars[first + k] ?? 0) > 0).length;
        const locked = !dev && first > save.puzzle.next;
        const claimed = round === 0 && save.puzzle.albums.includes(ch.id);
        const items = ch.pictures
          .map((_, k) => {
            const i = first + k;
            const stars = save.puzzle.stars[i] ?? 0;
            const open = dev || i <= save.puzzle.next;
            const cls = i === save.puzzle.next ? 'current' : open ? '' : 'locked';
            return `<button class="lvl ${cls}" data-a="${open ? 'pz-play' : ''}" data-v="${i}" ${open ? '' : 'disabled'}>
              <canvas data-lvl="${i}" data-solved="${stars > 0 ? 1 : 0}"></canvas>
              <span>${i + 1}</span><small>${stars === 3 ? '★★★' : stars ? '★' : open ? (isHard(i) ? `<em class="hard">${t('pz_hard')}</em>` : '') : icon.lock}</small></button>`;
          })
          .join('');
        parts.push(`<section class="chapter ${locked ? 'locked' : ''}" ${round === 0 ? `id="ch-${ci}"` : ''}>
          <header><span class="num">${ROMAN[ci]}</span><span class="txt"><b>${t(`ch_${ch.id}` as Key)}${round ? ` · ${t('pz_encore', { n: round })}` : ''}</b>
          <small>${t(`ch_${ch.id}_d` as Key)}</small></span>
          <span class="album-state ${claimed ? 'done' : ''}">${claimed ? icon.check : `${solved}/${ch.pictures.length}`}</span></header>
          <div class="album">${items}</div></section>`);
      });
    }
    this.host.ui.innerHTML = `
      <div class="screen">
        <div class="topbar">
          <button class="icon-btn" data-a="pz-home" aria-label="${t('home')}">${icon.back}</button>
          <h2 class="display">${t('pz_journey')}<br><small>${save.puzzle.stars.filter(Boolean).length} ${t('pz_pictures')} · ${save.puzzle.stars.filter((s) => s === 3).length} ★★★</small></h2>
        </div>
        <button class="card chest-row ${chestReady ? 'ready' : ''}" data-a="${chestReady ? 'pz-chest' : ''}">
          <span class="ic">${icon.gift}</span><span class="txt"><b>${chestReady ? t('pz_chestOpen') : t('pz_chest')}</b>
          <span class="bar"><i style="width:${Math.min(100, Math.round((save.puzzle.chest / CHEST_STARS) * 100))}%"></i></span></span>
          <small>${Math.min(save.puzzle.chest, CHEST_STARS)}/${CHEST_STARS} ★</small></button>
        ${dev ? `<div class="dev-jump">🛠 ${CHAPTERS.map((ch, ci) => `<button class="btn" data-a="pz-devjump" data-v="${ci}">${ROMAN[ci]} · ${t(`ch_${ch.id}` as Key)}</button>`).join('')}</div>` : ''}
        ${parts.join('')}
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

/** Schedules tomorrow's gentle reminders (daily puzzle, streak). */
export async function scheduleReminders() {
  await notifications.schedule(
    { dailyTitle: t('notif_daily_t'), dailyBody: t('notif_daily_b'), streakTitle: t('notif_streak_t'), streakBody: t('notif_streak_b', { n: save.streak.count }) },
    save.streak.lastDay === dayKey(),
  );
}
