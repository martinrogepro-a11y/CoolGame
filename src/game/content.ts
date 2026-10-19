/** Static game content: materials, visual palettes and districts (maps). */

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

export interface Palette {
  id: string;
  bg: string;
  dots: string;
  water: string;
  waterLine: string;
  rock: string;
  rockInk: string;
  belt: string;
  beltLine: string;
  ink: string;
  sub: string;
  card: string;
  fog: string;
  dark: boolean;
}

export const PALETTES: readonly Palette[] = [
  {
    id: 'paper', bg: '#F2ECE2', dots: '#D8CEBE', water: '#BDD3D1', waterLine: '#A7C3C1',
    rock: '#DDD3C3', rockInk: '#C4B7A3', belt: '#34333A', beltLine: '#6B6A74', ink: '#29282E',
    sub: '#8C8579', card: '#FBF8F3', fog: 'rgba(242,236,226,0.78)', dark: false,
  },
  {
    id: 'night', bg: '#1C2030', dots: '#2E3447', water: '#25324A', waterLine: '#30405C',
    rock: '#2A3043', rockInk: '#394058', belt: '#D9D3C7', beltLine: '#9C978C', ink: '#EEE9DF',
    sub: '#8E93A6', card: '#252A3C', fog: 'rgba(28,32,48,0.8)', dark: true,
  },
  {
    id: 'sakura', bg: '#F7EBEA', dots: '#E5D2D1', water: '#CADDE6', waterLine: '#B4CDD9',
    rock: '#E9D7D4', rockInk: '#D5BDB9', belt: '#4A3943', beltLine: '#7D6872', ink: '#3A2D34',
    sub: '#9C8790', card: '#FFF8F7', fog: 'rgba(247,235,234,0.78)', dark: false,
  },
  {
    id: 'blueprint', bg: '#1E3A61', dots: '#2D4E7C', water: '#294F82', waterLine: '#3561A0',
    rock: '#264673', rockInk: '#34598C', belt: '#EAF0F8', beltLine: '#A9BCD6', ink: '#F3F6FB',
    sub: '#9DB2CF', card: '#244572', fog: 'rgba(30,58,97,0.8)', dark: true,
  },
  {
    id: 'dune', bg: '#EEDFC4', dots: '#D9C6A5', water: '#B9D0C6', waterLine: '#A3C0B4',
    rock: '#DCC7A2', rockInk: '#C8AF85', belt: '#3D3227', beltLine: '#75644F', ink: '#33291F',
    sub: '#8F7C62', card: '#FAF2E4', fog: 'rgba(238,223,196,0.78)', dark: false,
  },
];

export function paletteById(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

export type TerrainStyle = 'coast' | 'peaks' | 'delta' | 'archipelago';

export interface District {
  id: string;
  terrain: TerrainStyle;
  /** Week at which each material becomes available (index = material id). */
  colorWeeks: number[];
  startBelts: number;
  startBridges: number;
  /** Lifetime tesserae needed to unlock. */
  unlockAt: number;
  /** Difficulty multiplier on demand. */
  pace: number;
}

export const DISTRICTS: readonly District[] = [
  { id: 'coast', terrain: 'coast', colorWeeks: [0, 1, 3, 6], startBelts: 16, startBridges: 1, unlockAt: 0, pace: 1 },
  { id: 'peaks', terrain: 'peaks', colorWeeks: [0, 1, 2, 5, 9], startBelts: 18, startBridges: 0, unlockAt: 400, pace: 1.05 },
  { id: 'delta', terrain: 'delta', colorWeeks: [0, 1, 2, 4, 8], startBelts: 16, startBridges: 4, unlockAt: 1200, pace: 1.1 },
  { id: 'archipelago', terrain: 'archipelago', colorWeeks: [0, 1, 2, 4, 6], startBelts: 14, startBridges: 4, unlockAt: 3000, pace: 1.15 },
];

export function districtById(id: string): District {
  return DISTRICTS.find((d) => d.id === id) ?? DISTRICTS[0];
}
