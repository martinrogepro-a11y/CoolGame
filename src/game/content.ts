/** Static game content: materials (canal colours and their glyphs) and visual palettes. */

export type Glyph = 'circle' | 'square' | 'triangle' | 'diamond' | 'plus';

export interface Material {
  id: number;
  key: string;
  color: string;
  glyph: Glyph;
}

export const MATERIALS: readonly Material[] = [
  { id: 0, key: 'clay', color: '#D2694A', glyph: 'circle' },
  { id: 1, key: 'slate', color: '#3F5E9A', glyph: 'square' },
  { id: 2, key: 'jade', color: '#4E9A74', glyph: 'triangle' },
  { id: 3, key: 'saffron', color: '#E0A332', glyph: 'diamond' },
  { id: 4, key: 'plum', color: '#8A4F8C', glyph: 'plus' },
];

/** Draws a material's glyph (shapes for colour-blind players). */
export function drawGlyph(g: CanvasRenderingContext2D, glyph: Glyph, x: number, y: number, r: number) {
  g.beginPath();
  switch (glyph) {
    case 'circle':
      g.arc(x, y, r * 0.8, 0, Math.PI * 2);
      break;
    case 'square':
      g.rect(x - r * 0.7, y - r * 0.7, r * 1.4, r * 1.4);
      break;
    case 'triangle':
      g.moveTo(x, y - r * 0.9);
      g.lineTo(x + r * 0.85, y + r * 0.65);
      g.lineTo(x - r * 0.85, y + r * 0.65);
      g.closePath();
      break;
    case 'diamond':
      g.moveTo(x, y - r);
      g.lineTo(x + r * 0.8, y);
      g.lineTo(x, y + r);
      g.lineTo(x - r * 0.8, y);
      g.closePath();
      break;
    case 'plus': {
      const a = r * 0.32;
      g.rect(x - a, y - r * 0.9, a * 2, r * 1.8);
      g.rect(x - r * 0.9, y - a, r * 1.8, a * 2);
      break;
    }
  }
  g.fill();
}

export interface Palette {
  id: string;
  bg: string;
  dots: string;
  water: string;
  waterLine: string;
  rock: string;
  rockInk: string;
  /** Water flowing in the player's canals (vivid, distinct from natural water). */
  canal: string;
  /** Stone edging of canals and aqueducts. */
  canalEdge: string;
  foam: string;
  ink: string;
  sub: string;
  card: string;
  fog: string;
  dark: boolean;
  /** Main buttons: a colour of the place (harbour blue, terracotta...), never black. */
  accent: string;
  accentInk: string;
}

export const PALETTES: readonly Palette[] = [
  {
    id: 'paper', bg: '#F2ECE2', dots: '#D8CEBE', water: '#BDD3D1', waterLine: '#A7C3C1',
    rock: '#DDD3C3', rockInk: '#C4B7A3', canal: '#4FA3B5', canalEdge: '#C9B79B', foam: 'rgba(255,255,255,0.75)', ink: '#2E2A26',
    sub: '#7A7064', card: '#FBF8F3', fog: 'rgba(242,236,226,0.78)', dark: false, accent: '#1F4A5E', accentInk: '#FBF6EC',
  },
  {
    id: 'night', bg: '#1C2030', dots: '#2E3447', water: '#25324A', waterLine: '#30405C',
    rock: '#2A3043', rockInk: '#394058', canal: '#3E95A8', canalEdge: '#4A5370', foam: 'rgba(220,240,255,0.55)', ink: '#EEE9DF',
    sub: '#8E93A6', card: '#252A3C', fog: 'rgba(28,32,48,0.8)', dark: true, accent: '#E3B25A', accentInk: '#241C10',
  },
  {
    id: 'sakura', bg: '#F7EBEA', dots: '#E5D2D1', water: '#CADDE6', waterLine: '#B4CDD9',
    rock: '#E9D7D4', rockInk: '#D5BDB9', canal: '#5FA9C0', canalEdge: '#D9BFB8', foam: 'rgba(255,255,255,0.75)', ink: '#3A2D34',
    sub: '#8A7480', card: '#FFF8F7', fog: 'rgba(247,235,234,0.78)', dark: false, accent: '#A9504A', accentInk: '#FFF8F7',
  },
  {
    id: 'blueprint', bg: '#1E3A61', dots: '#2D4E7C', water: '#294F82', waterLine: '#3561A0',
    rock: '#264673', rockInk: '#34598C', canal: '#8ED0F0', canalEdge: '#4F75AC', foam: 'rgba(255,255,255,0.75)', ink: '#F3F6FB',
    sub: '#9DB2CF', card: '#244572', fog: 'rgba(30,58,97,0.8)', dark: true, accent: '#F3C969', accentInk: '#1E2A40',
  },
  {
    id: 'dune', bg: '#EEDFC4', dots: '#D9C6A5', water: '#B9D0C6', waterLine: '#A3C0B4',
    rock: '#DCC7A2', rockInk: '#C8AF85', canal: '#3F9DA6', canalEdge: '#C2A577', foam: 'rgba(255,255,255,0.75)', ink: '#33291F',
    sub: '#7C6A51', card: '#FAF2E4', fog: 'rgba(238,223,196,0.78)', dark: false, accent: '#2F5F63', accentInk: '#FAF2E4',
  },
];

export function paletteById(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}
