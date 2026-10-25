/**
 * Inline SVG icons (24px grid, 2px rounded strokes). The ones that name places of the game
 * are drawn from its world: a house for the village, mosaic tiles for the collection, a
 * market awning for the shop, a chest, a fountain feeding a house.
 */
const wrap = (d: string, fill = false) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="${fill ? 'currentColor' : 'none'}" stroke="${fill ? 'none' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const icon = {
  pause: wrap('<rect x="6" y="5" width="4" height="14" rx="1.5"/><rect x="14" y="5" width="4" height="14" rx="1.5"/>', true),
  play: wrap('<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/>', true),
  gear: wrap('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
  city: wrap('<path d="M4 11l8-6.5 8 6.5"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-4a2 2 0 0 1 4 0v4"/><path d="M15.5 6.5V4h2v4"/>'),
  grid: wrap('<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5" transform="rotate(-4 7.25 7.25)"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.5" transform="rotate(3 16.75 7.25)"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5" transform="rotate(3 7.25 16.75)"/><rect x="13" y="13" width="7.5" height="7.5" rx="1.5" fill="currentColor" transform="rotate(-3 16.75 16.75)"/>'),
  bag: wrap('<path d="M3.5 9.5L5.5 4h13l2 5.5"/><path d="M3.5 9.5a2.1 2.1 0 0 0 4.25 0a2.1 2.1 0 0 0 4.25 0a2.1 2.1 0 0 0 4.25 0a2.1 2.1 0 0 0 4.25 0"/><path d="M5 12v8h14v-8"/><path d="M10 20v-4.5h4V20"/>'),
  eraser: wrap('<path d="M16 3l5 5-11 11H5l-2-2a2 2 0 0 1 0-2.8L16 3z"/><path d="M10 19h10"/><path d="M9 10l5 5"/>'),
  fast: wrap('<path d="M4 6l7 6-7 6V6z"/><path d="M13 6l7 6-7 6V6z"/>', true),
  back: wrap('<path d="M15 5l-7 7 7 7"/>'),
  left: wrap('<path d="M15 6l-6 6 6 6"/>'),
  right: wrap('<path d="M9 6l6 6-6 6"/>'),
  flame: wrap('<path d="M12 22c4.4 0 7-2.9 7-6.8 0-3.4-2.3-5.8-4.2-8.2-.5 1.9-1.5 3.1-2.8 3.5C12.4 7 11 4.2 8.5 2c.3 3.4-3.5 6.5-3.5 11.2C5 18.4 7.6 22 12 22z"/>', true),
  lock: wrap('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  video: wrap('<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>'),
  check: wrap('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  belt: wrap('<circle cx="5.5" cy="18" r="2.5"/><path d="M8 18h3.5a4.5 4.5 0 0 0 4.5-4.5V12"/><path d="M12.5 9.5L16 6l3.5 3.5V12h-7z"/>'),
  bridge: wrap('<path d="M3 6h18v4H3z"/><path d="M4 10v10M20 10v10"/><path d="M8 20v-4a4 4 0 0 1 8 0v4"/>'),
  close: wrap('<path d="M6 6l12 12M18 6L6 18"/>'),
  gift: wrap('<path d="M4 11h16v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8z"/><path d="M4 11V9a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v2"/><rect x="10.25" y="9.5" width="3.5" height="4.5" rx="1"/>'),
  frame: wrap('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>'),
  bulb: wrap('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>'),
  reset: wrap('<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4h4"/>'),
  share: wrap('<path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>'),
  calendar: wrap('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M2.5 12h2M19.5 12h2M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>'),
  journey: wrap('<path d="M6 20.5c-2-3 4-4 4-7.5S5 9.5 7 6"/><circle cx="6" cy="20.5" r="0.6" fill="currentColor"/><path d="M13 15h5M15 11.5h4" opacity="0.5"/><path d="M12.5 3.5v8"/><path d="M12.5 3.5l6 2.2-6 2.2"/>'),
};

/** The Canalia mark: a canal running from a fountain round to a little house, on a harbour-blue tile. */
export const logoMark = `<svg class="mark" viewBox="0 0 64 64" aria-hidden="true"><rect x="2" y="4" width="60" height="58" rx="16" fill="#173A4A"/><rect x="2" y="2" width="60" height="57" rx="16" fill="#1F4A5E"/><path d="M43 19.5H27a10.5 10.5 0 0 0 0 21h16" fill="none" stroke="#C9B79B" stroke-width="11" stroke-linecap="round"/><path d="M43 19.5H27a10.5 10.5 0 0 0 0 21h16" fill="none" stroke="#5DB4C6" stroke-width="6.5" stroke-linecap="round"/><path d="M29 19.5h4M17.5 30v1M29 40.5h4" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" opacity="0.8"/><circle cx="46" cy="19.5" r="6.5" fill="#F2D9A6"/><circle cx="46" cy="19.5" r="3.6" fill="#5DB4C6"/><circle cx="46" cy="19.5" r="1.3" fill="#FFFFFF"/><path d="M40.5 39.5h11v8.5h-11z" fill="#F3E8D6"/><path d="M39 40.5l7.5-6.5 7.5 6.5z" fill="#C8573A"/><path d="M44.8 48v-3.3a1.7 1.7 0 0 1 3.4 0V48z" fill="#8A4A32"/></svg>`;
