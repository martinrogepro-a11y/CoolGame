import { ambience } from '../core/ambience';
import { audio } from '../core/audio';
import { haptics } from '../core/haptics';
import { notifications } from '../core/services';
import { MATERIALS, PALETTES, paletteById, type Palette } from '../game/content';
import {
  CHEST_STARS, claimMission, grantSpread, HINT_PACK, type LevelResult, type Mission, persist, refreshDaily, save, tradeForHints,
} from '../meta/save';
import { isComplete, nextRestoration, PLACES, type PlaceId, restore, restoredIn, VILLAGES } from '../meta/village';
import { ads } from '../monetization/ads';
import { IAP } from '../monetization/config';
import { iap } from '../monetization/iap';
import { chapterOf, CHAPTERS, firstLevelOf } from '../puzzle/chapters';
import { drawPictureThumb } from '../puzzle/puzzleRender';
import { t, type Key } from './i18n';
import { icon } from './icons';
import { levelAt, PuzzleMode, scheduleReminders } from './puzzleMode';

type Screen = 'home' | 'collection' | 'shop' | 'settings' | 'puzzle' | 'levels' | 'village';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const sq = (c: number) => `<i class="sq" style="background:${MATERIALS[c].color}"></i>`;

export class App {
  private ui: HTMLElement;
  private board: HTMLCanvasElement;
  private screen: Screen = 'home';
  private last = performance.now();
  private frames = 0;
  private pending = 0;
  private lastTouch = performance.now();
  private pal: Palette;
  private puzzle: PuzzleMode;

  constructor(root: HTMLElement) {
    root.innerHTML = '<canvas id="board"></canvas><div id="ui"></div>';
    this.board = root.querySelector('#board')!;
    this.ui = root.querySelector('#ui')!;
    this.pal = paletteById(save.palette);
    this.puzzle = new PuzzleMode({
      ui: this.ui,
      canvas: this.board,
      pal: () => this.pal,
      colorblind: () => save.settings.colorblind,
      toast: (m) => this.toast(m),
      modal: (h) => this.modal(h),
      closeModal: () => this.closeModal(),
      goHome: () => this.go('home'),
      afterRewards: (r) => this.levelToasts(r),
    });
    this.applySettings();
    this.ui.addEventListener('click', (e) => {
      const el = (e.target as Element).closest<HTMLElement>('[data-a]');
      if (!el) return;
      audio.unlock();
      audio.tap();
      void this.action(el.dataset.a!, el.dataset.v ?? '');
    });
    window.addEventListener('resize', () => this.puzzle.resize());
    for (const ev of ['pointerdown', 'pointermove'] as const) window.addEventListener(ev, () => (this.lastTouch = performance.now()), { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        refreshDaily(save);
        if (this.screen === 'home') this.go('home');
      }
    });
    this.go('home');
    requestAnimationFrame((n) => this.frame(n));
    if (import.meta.env.DEV) {
      // Test hook: open a level directly (used by the Playwright screenshots).
      (window as unknown as Record<string, unknown>).__pzPlay = (i: number) => this.action('pz-play', String(i));
    }
  }

  // ---------------------------------------------------------------- setup

  private applySettings() {
    const pal = (this.pal = paletteById(save.palette));
    const r = document.documentElement.style;
    r.setProperty('--bg', pal.bg);
    r.setProperty('--card', pal.card);
    r.setProperty('--ink', pal.ink);
    r.setProperty('--sub', pal.sub);
    r.setProperty('--line', pal.dots);
    r.setProperty('--accent', pal.accent);
    r.setProperty('--accent-ink', pal.accentInk);
    document.documentElement.classList.toggle('dark', pal.dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', pal.bg);
    audio.setEnabled(save.settings.sound);
    haptics.setEnabled(save.settings.haptics);
    document.documentElement.lang = t('play') === 'Jouer' ? 'fr' : 'en';
  }

  // ---------------------------------------------------------------- navigation

  private go(screen: Screen) {
    if (screen !== this.screen) this.wipe();
    this.screen = screen;
    if (screen !== 'puzzle') this.puzzle.stop();
    // Each place has its soundscape, in levels and (softer) behind the home screen.
    if (screen !== 'home' && screen !== 'puzzle' && screen !== 'levels' && screen !== 'village') ambience.stop();
    this.board.style.display = screen === 'puzzle' || screen === 'home' || screen === 'village' ? 'block' : 'none';
    if (screen === 'home' || screen === 'village') requestAnimationFrame(() => this.puzzle.resizeAmbient());
    switch (screen) {
      case 'home': this.ui.innerHTML = this.homeHtml(); this.drawHomeLevel(); break;
      case 'levels': this.puzzle.showLevels(); break;
      case 'collection': this.ui.innerHTML = this.collectionHtml(); this.drawAlbums(); break;
      case 'shop': this.ui.innerHTML = this.shopHtml(); break;
      case 'settings': this.ui.innerHTML = this.settingsHtml(); break;
      case 'village': this.ui.innerHTML = this.villageHtml(); break;
    }
    // Light text over the dark places (night, sunken city).
    const shown = screen === 'village' ? this.place : screen === 'home' ? chapterOf(save.puzzle.next).chapter.id : '';
    this.ui.classList.toggle('pz-dark', shown === 'night' || shown === 'deep');
  }

  /**
   * The game's signature transition: the new screen appears as a mosaic of tesserae
   * that turn and fall away in a diagonal wave.
   */
  private wipe() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const host = this.ui.parentElement;
    if (!host) return;
    host.querySelector('.mosaic-wipe')?.remove();
    const cols = 8;
    const rows = Math.ceil((cols * window.innerHeight) / window.innerWidth);
    const colors = [...MATERIALS.map((m) => m.color), this.pal.card, this.pal.card];
    const el = document.createElement('div');
    el.className = 'mosaic-wipe';
    el.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    el.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    let html = '';
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        html += `<i style="background:${colors[(r * 5 + c * 3 + ((r * c) % 4)) % colors.length]};animation-delay:${(r + c) * 16}ms"></i>`;
    el.innerHTML = html;
    host.appendChild(el);
    setTimeout(() => el.remove(), (rows + cols) * 16 + 500);
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
        if (this.screen !== 'puzzle') this.wipe();
        this.screen = 'puzzle';
        this.board.style.display = 'block';
      }
      if (a === 'pz-levels') {
        if (this.screen !== 'levels') this.wipe();
        this.screen = 'levels';
        this.board.style.display = 'none';
      }
      await this.puzzle.action(a, v);
      return;
    }
    switch (a) {
      case 'go': this.go(v as Screen); break;
      case 'village': {
        this.place = (v || chapterOf(save.puzzle.next).chapter.id) as PlaceId;
        this.go('village');
        break;
      }
      case 'v-restore': this.restoreNext(); break;
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
      case 'trade': {
        if (!tradeForHints(save)) return this.toast(t('tradeShort', { n: HINT_PACK.cost }));
        persist(true);
        audio.reward();
        this.toast(t('tradeDone', { n: HINT_PACK.hints }));
        this.go('shop');
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

  // ---------------------------------------------------------------- frame loop

  private frame(now: number) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    // When nobody touches the screen and nothing on the board is moving, the gentle
    // ambient animation runs at half rate: smooth enough, and half the battery.
    this.frames++;
    this.pending += dt;
    const idle = now - this.lastTouch > 2500 && !(this.screen === 'puzzle' && this.puzzle.busy);
    if (idle && this.frames % 2) {
      requestAnimationFrame((n) => this.frame(n));
      return;
    }
    const step = Math.min(0.1, this.pending);
    this.pending = 0;
    this.render(step);
    requestAnimationFrame((n) => this.frame(n));
  }

  private render(dt: number) {
    if (this.screen === 'village') this.puzzle.villageView(dt, this.place);
    else if (this.screen === 'home') this.puzzle.ambient(dt);
    else if (this.screen === 'puzzle') this.puzzle.frame(dt);
  }

  // ---------------------------------------------------------------- home

  private wallet(): string {
    return `<div class="wallet">${save.tesserae
      .map((n, c) => (c < 4 || n > 0 ? `<span class="t">${sq(c)}${n}</span>` : ''))
      .join('')}</div>`;
  }

  private missionText(m: Mission): string {
    return t(`m_${m.kind}` as Key, { n: m.goal });
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
      drawPictureThumb(c, lv.colors, lv.n, false, this.pal);
    });
  }

  private levelToasts(r: LevelResult) {
    for (const m of r.missionsDone) this.toast(`✓ ${this.missionText(m)}`);
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
          ${this.villageCardHtml()}
        </div>
        ${gift}
        <div class="section-title">${t('missions')}</div>
        <div class="card" style="padding:0">${missions}</div>
        <div class="nav">
          <button data-a="village">${icon.city}${t('village')}</button>
          <button data-a="go" data-v="collection">${icon.grid}${t('collection')}</button>
          <button data-a="go" data-v="shop">${icon.bag}${t('shop')}</button>
        </div>
      </div>`;
  }

  /** Place shown on the village screen. */
  private place: PlaceId = 'garden';

  private placeOpen(p: PlaceId): boolean {
    const ci = CHAPTERS.findIndex((c) => c.id === p);
    return ci >= 0 && save.puzzle.next >= firstLevelOf(ci);
  }

  private villageCardHtml(): string {
    const place = chapterOf(save.puzzle.next).chapter.id as PlaceId;
    const next = nextRestoration(save.village, place);
    const ready = !!next && save.village.stars >= next.cost;
    const sub = next ? `${t(`v_${place}_${next.id}` as Key)} · ★${next.cost}` : t('v_doneAll', { p: t(`ch_${place}` as Key) });
    return `<button class="card mini village-mini ${ready ? 'ready' : ''}" data-a="village"><span class="ic">${icon.city}</span><b>${t('village')} <em>★ ${save.village.stars}</em></b><small>${esc(sub)}</small></button>`;
  }

  /** The village of a place: its scene, large, and the list of things to bring back. */
  private villageHtml(): string {
    const p = this.place;
    const done = restoredIn(save.village, p);
    const list = VILLAGES[p];
    const next = nextRestoration(save.village, p);
    const open = this.placeOpen(p);
    const tabs = PLACES.map((q, i) => {
      const o = this.placeOpen(q);
      return `<button class="vtab ${q === p ? 'on' : ''} ${isComplete(save.village, q) ? 'full' : ''}" data-a="${o ? 'village' : ''}" data-v="${q}" ${o ? '' : 'disabled'}>${o ? ['I', 'II', 'III', 'IV', 'V'][i] : icon.lock}</button>`;
    }).join('');
    const rows = list
      .map((r) => {
        const isDone = done.has(r.id);
        const isNext = next?.id === r.id;
        const state = isDone ? `<span class="vstate done">${icon.check}</span>` : `<span class="vstate">★${r.cost}</span>`;
        return `<div class="vrow ${isDone ? 'done' : isNext ? 'next' : 'later'}"><span class="txt"><b>${t(`v_${p}_${r.id}` as Key)}</b>
          ${isDone ? `<small>${t(`v_${p}_${r.id}_d` as Key)}</small>` : ''}</span>${state}</div>`;
      })
      .join('');
    let action = '';
    if (!open) action = `<p class="note">${t('v_locked')}</p>`;
    else if (next && save.village.stars >= next.cost)
      action = `<button class="btn primary big" data-a="v-restore">${t('v_restore')} · ★${next.cost}</button>`;
    else if (next)
      action = `<p class="note">${t('v_need')}</p><button class="btn primary big" data-a="pz-play" data-v="${save.puzzle.next}">${icon.play} ${t('play')}</button>`;
    else action = `<p class="note">${t('v_doneAll', { p: t(`ch_${p}` as Key) })}</p>`;
    return `
      <div class="screen village">
        <div class="topbar">
          <button class="icon-btn" data-a="go" data-v="home" aria-label="${t('home')}">${icon.back}</button>
          <h2 class="vtitle">${t(`ch_${p}` as Key)}<br><small>${t('v_progress', { n: done.size, m: list.length })}</small></h2>
          <span class="chip star"><i>★</i><b>${save.village.stars}</b></span>
        </div>
        <div class="vtabs">${tabs}</div>
        <div class="spacer"></div>
        <div class="card vsheet">${rows}${action}</div>
      </div>`;
  }

  private restoreNext() {
    const p = this.place;
    if (!this.placeOpen(p)) return;
    const r = restore(save.village, p);
    if (!r) return;
    for (const m of save.missions.list) if (m.kind === 'restore' && !m.claimed) m.progress = Math.min(m.goal, m.progress + 1);
    let extra = '';
    if (isComplete(save.village, p)) {
      save.hints += 3;
      extra = t('v_reward', { n: 3 });
    }
    persist();
    audio.reward();
    haptics.success();
    this.go('village');
    this.flash();
    this.toast(t(`v_${p}_${r.id}_d` as Key));
    if (extra) setTimeout(() => this.toast(extra), 1600);
  }

  /** A soft bloom of light over the scene when something comes back to life. */
  private flash() {
    const el = document.createElement('div');
    el.className = 'restore-flash';
    this.ui.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  /** The pictures revealed so far, chapter by chapter, and the palettes. */
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
    let first = 0;
    const albums = CHAPTERS.map((ch) => {
      const start = first;
      first += ch.pictures.length;
      const solved = ch.pictures.filter((_, k) => (save.puzzle.stars[start + k] ?? 0) > 0).length;
      const items = ch.pictures
        .map((id, k) => {
          const done = (save.puzzle.stars[start + k] ?? 0) > 0;
          return `<div class="frame"><canvas data-pic="${start + k}" data-solved="${done ? 1 : 0}"></canvas><span>${done ? esc(t(`pic_${id}` as Key)) : '?'}</span></div>`;
        })
        .join('');
      return `<div class="section-title">${t(`ch_${ch.id}` as Key)} · ${solved}/${ch.pictures.length}</div><div class="gallery">${items}</div>`;
    }).join('');
    const total = save.puzzle.stars.filter(Boolean).length;
    return `
      <div class="screen">
        <div class="topbar">
          <button class="icon-btn" data-a="go" data-v="home" aria-label="${t('home')}">${icon.back}</button>
          <h2>${t('collection')}<br><small>${total} ${t('pz_pictures')}</small></h2>
        </div>
        ${albums}
        <div class="section-title">${t('palettes')}</div>
        <div class="card" style="padding:0 4px">${pals}</div>
      </div>`;
  }

  private drawAlbums() {
    requestAnimationFrame(() => {
      this.ui.querySelectorAll<HTMLCanvasElement>('canvas[data-pic]').forEach((c) => {
        const lv = levelAt(Number(c.dataset.pic));
        drawPictureThumb(c, lv.colors, lv.n, c.dataset.solved === '1', this.pal);
      });
    });
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
        ${this.wallet()}
        <div class="card shop-item"><span class="ic">${icon.bulb}</span>
          <span class="txt"><b>${t('trade', { n: HINT_PACK.hints })}</b><small>${t('trade_d')}</small></span>
          <button class="btn primary" data-a="trade">${HINT_PACK.cost} ${sq(0)}</button></div>
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
        <div class="credits" data-a="dev-tap">${s.dev ? '🛠 Mode dev · ' : ''}Canalia v${__APP_VERSION__}</div>
      </div>`;
  }
}
