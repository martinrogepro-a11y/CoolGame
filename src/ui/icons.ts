/** Minimal inline SVG icon set (stroke icons, 24px grid). */
const wrap = (d: string, fill = false) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="${fill ? 'currentColor' : 'none'}" stroke="${fill ? 'none' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const icon = {
  pause: wrap('<rect x="6" y="5" width="4" height="14" rx="1.5"/><rect x="14" y="5" width="4" height="14" rx="1.5"/>', true),
  play: wrap('<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/>', true),
  gear: wrap('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
  city: wrap('<path d="M3 21h18"/><path d="M5 21V10l5-3v14"/><path d="M10 21V4l9 4v13"/><path d="M14 10h1M14 14h1M14 18h1"/>'),
  grid: wrap('<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>'),
  bag: wrap('<path d="M6 7h12l1 14H5L6 7z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/>'),
  eraser: wrap('<path d="M16 3l5 5-11 11H5l-2-2a2 2 0 0 1 0-2.8L16 3z"/><path d="M10 19h10"/><path d="M9 10l5 5"/>'),
  fast: wrap('<path d="M4 6l7 6-7 6V6z"/><path d="M13 6l7 6-7 6V6z"/>', true),
  back: wrap('<path d="M15 5l-7 7 7 7"/>'),
  left: wrap('<path d="M15 6l-6 6 6 6"/>'),
  right: wrap('<path d="M9 6l6 6-6 6"/>'),
  flame: wrap('<path d="M12 22c4.4 0 7-2.9 7-6.8 0-3.4-2.3-5.8-4.2-8.2-.5 1.9-1.5 3.1-2.8 3.5C12.4 7 11 4.2 8.5 2c.3 3.4-3.5 6.5-3.5 11.2C5 18.4 7.6 22 12 22z"/>', true),
  lock: wrap('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  video: wrap('<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>'),
  check: wrap('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  belt: wrap('<path d="M3 7h18M3 17h18"/><path d="M5 12c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0"/>'),
  bridge: wrap('<path d="M3 6h18v4H3z"/><path d="M4 10v10M20 10v10"/><path d="M8 20v-4a4 4 0 0 1 8 0v4"/>'),
  close: wrap('<path d="M6 6l12 12M18 6L6 18"/>'),
  gift: wrap('<rect x="3" y="9" width="18" height="12" rx="2"/><path d="M12 9v12M3 13h18"/><path d="M12 9c-2-4-6-4-6-1.5S10 9 12 9zm0 0c2-4 6-4 6-1.5S14 9 12 9z"/>'),
  frame: wrap('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>'),
  bulb: wrap('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>'),
  reset: wrap('<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4h4"/>'),
  share: wrap('<path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>'),
  calendar: wrap('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
};
