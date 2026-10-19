/**
 * Landmarks are the long-term collection: monuments built in the player's city
 * with tesserae earned in runs. Each is drawn procedurally from primitives.
 */

export type Prim =
  | { k: 'box'; x: number; y: number; w: number; d: number; h: number; z?: number; c: number }
  | { k: 'cyl'; x: number; y: number; r: number; h: number; z?: number; c: number }
  | { k: 'roof'; x: number; y: number; w: number; d: number; h: number; z: number; c: number }
  | { k: 'cone'; x: number; y: number; r: number; h: number; z: number; c: number }
  | { k: 'dome'; x: number; y: number; r: number; z: number; c: number };

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Landmark {
  id: string;
  rarity: Rarity;
  /** Tesserae cost per material. */
  cost: number[];
  /** Lifetime tesserae needed before the blueprint is revealed. */
  revealAt: number;
  /** Footprint in city tiles (square). */
  size: 1 | 2;
  /** Primitives in tile units, origin at footprint corner. Colour index: 0-4 materials, 5 stone, 6 accent white, 7 dark. */
  shape: Prim[];
  /** Only obtainable from the premium pack or events. */
  premium?: boolean;
}

export const LANDMARKS: readonly Landmark[] = [
  {
    id: 'well', rarity: 'common', cost: [20, 0, 0, 0, 0], revealAt: 0, size: 1,
    shape: [
      { k: 'cyl', x: 0.5, y: 0.5, r: 0.28, h: 0.18, c: 5 },
      { k: 'box', x: 0.24, y: 0.46, w: 0.06, d: 0.08, h: 0.4, z: 0.18, c: 7 },
      { k: 'box', x: 0.7, y: 0.46, w: 0.06, d: 0.08, h: 0.4, z: 0.18, c: 7 },
      { k: 'roof', x: 0.18, y: 0.3, w: 0.64, d: 0.4, h: 0.18, z: 0.58, c: 0 },
    ],
  },
  {
    id: 'windmill', rarity: 'common', cost: [30, 15, 0, 0, 0], revealAt: 60, size: 1,
    shape: [
      { k: 'cyl', x: 0.5, y: 0.5, r: 0.26, h: 0.8, c: 6 },
      { k: 'cone', x: 0.5, y: 0.5, r: 0.3, h: 0.3, z: 0.8, c: 0 },
    ],
  },
  {
    id: 'bell_tower', rarity: 'common', cost: [10, 30, 10, 0, 0], revealAt: 150, size: 1,
    shape: [
      { k: 'box', x: 0.25, y: 0.25, w: 0.5, d: 0.5, h: 1.3, c: 6 },
      { k: 'box', x: 0.22, y: 0.22, w: 0.56, d: 0.56, h: 0.08, z: 1.3, c: 1 },
      { k: 'roof', x: 0.25, y: 0.25, w: 0.5, d: 0.5, h: 0.45, z: 1.38, c: 1 },
    ],
  },
  {
    id: 'greenhouse', rarity: 'rare', cost: [0, 20, 45, 0, 0], revealAt: 300, size: 2,
    shape: [
      { k: 'box', x: 0.3, y: 0.4, w: 1.4, d: 1.2, h: 0.45, c: 2 },
      { k: 'roof', x: 0.3, y: 0.4, w: 1.4, d: 1.2, h: 0.45, z: 0.45, c: 6 },
      { k: 'box', x: 0.9, y: 0.3, w: 0.2, d: 0.1, h: 0.3, c: 7 },
    ],
  },
  {
    id: 'lighthouse', rarity: 'rare', cost: [40, 40, 0, 10, 0], revealAt: 500, size: 1,
    shape: [
      { k: 'cyl', x: 0.5, y: 0.5, r: 0.3, h: 0.5, c: 6 },
      { k: 'cyl', x: 0.5, y: 0.5, r: 0.26, h: 0.5, z: 0.5, c: 0 },
      { k: 'cyl', x: 0.5, y: 0.5, r: 0.22, h: 0.5, z: 1.0, c: 6 },
      { k: 'cyl', x: 0.5, y: 0.5, r: 0.16, h: 0.18, z: 1.5, c: 3 },
      { k: 'cone', x: 0.5, y: 0.5, r: 0.2, h: 0.2, z: 1.68, c: 7 },
    ],
  },
  {
    id: 'aqueduct', rarity: 'rare', cost: [60, 30, 30, 0, 0], revealAt: 800, size: 2,
    shape: [
      { k: 'box', x: 0.15, y: 0.85, w: 0.22, d: 0.3, h: 0.7, c: 5 },
      { k: 'box', x: 0.89, y: 0.85, w: 0.22, d: 0.3, h: 0.7, c: 5 },
      { k: 'box', x: 1.63, y: 0.85, w: 0.22, d: 0.3, h: 0.7, c: 5 },
      { k: 'box', x: 0.1, y: 0.82, w: 1.8, d: 0.36, h: 0.16, z: 0.7, c: 0 },
    ],
  },
  {
    id: 'observatory', rarity: 'epic', cost: [30, 80, 0, 40, 0], revealAt: 1200, size: 2,
    shape: [
      { k: 'box', x: 0.35, y: 0.35, w: 1.3, d: 1.3, h: 0.5, c: 6 },
      { k: 'cyl', x: 1, y: 1, r: 0.5, h: 0.35, z: 0.5, c: 6 },
      { k: 'dome', x: 1, y: 1, r: 0.5, z: 0.85, c: 1 },
    ],
  },
  {
    id: 'pagoda', rarity: 'epic', cost: [50, 0, 60, 40, 0], revealAt: 1800, size: 1,
    shape: [
      { k: 'box', x: 0.22, y: 0.22, w: 0.56, d: 0.56, h: 0.35, c: 6 },
      { k: 'roof', x: 0.1, y: 0.1, w: 0.8, d: 0.8, h: 0.2, z: 0.35, c: 0 },
      { k: 'box', x: 0.27, y: 0.27, w: 0.46, d: 0.46, h: 0.3, z: 0.55, c: 6 },
      { k: 'roof', x: 0.15, y: 0.15, w: 0.7, d: 0.7, h: 0.2, z: 0.85, c: 0 },
      { k: 'box', x: 0.32, y: 0.32, w: 0.36, d: 0.36, h: 0.25, z: 1.05, c: 6 },
      { k: 'roof', x: 0.2, y: 0.2, w: 0.6, d: 0.6, h: 0.3, z: 1.3, c: 0 },
    ],
  },
  {
    id: 'clock_tower', rarity: 'epic', cost: [40, 40, 40, 40, 0], revealAt: 2500, size: 1,
    shape: [
      { k: 'box', x: 0.28, y: 0.28, w: 0.44, d: 0.44, h: 1.7, c: 5 },
      { k: 'box', x: 0.24, y: 0.24, w: 0.52, d: 0.52, h: 0.35, z: 1.25, c: 3 },
      { k: 'cone', x: 0.5, y: 0.5, r: 0.34, h: 0.6, z: 1.7, c: 1 },
    ],
  },
  {
    id: 'amphitheatre', rarity: 'legendary', cost: [120, 60, 60, 60, 30], revealAt: 4000, size: 2,
    shape: [
      { k: 'cyl', x: 1, y: 1, r: 0.9, h: 0.15, c: 5 },
      { k: 'cyl', x: 1, y: 1, r: 0.72, h: 0.15, z: 0.15, c: 0 },
      { k: 'cyl', x: 1, y: 1, r: 0.55, h: 0.15, z: 0.3, c: 5 },
      { k: 'cyl', x: 1, y: 1, r: 0.38, h: 0.05, z: 0.45, c: 3 },
    ],
  },
  {
    id: 'ziggurat', rarity: 'legendary', cost: [80, 80, 80, 80, 80], revealAt: 6000, size: 2,
    shape: [
      { k: 'box', x: 0.1, y: 0.1, w: 1.8, d: 1.8, h: 0.3, c: 3 },
      { k: 'box', x: 0.35, y: 0.35, w: 1.3, d: 1.3, h: 0.3, z: 0.3, c: 0 },
      { k: 'box', x: 0.6, y: 0.6, w: 0.8, d: 0.8, h: 0.3, z: 0.6, c: 2 },
      { k: 'box', x: 0.8, y: 0.8, w: 0.4, d: 0.4, h: 0.3, z: 0.9, c: 4 },
    ],
  },
  {
    id: 'golden_arch', rarity: 'legendary', cost: [0, 0, 0, 0, 0], revealAt: 0, size: 2, premium: true,
    shape: [
      { k: 'box', x: 0.2, y: 0.85, w: 0.3, d: 0.3, h: 1.1, c: 3 },
      { k: 'box', x: 1.5, y: 0.85, w: 0.3, d: 0.3, h: 1.1, c: 3 },
      { k: 'box', x: 0.15, y: 0.8, w: 1.7, d: 0.4, h: 0.3, z: 1.1, c: 3 },
      { k: 'cone', x: 1, y: 1, r: 0.18, h: 0.3, z: 1.4, c: 6 },
    ],
  },
];

export function landmarkById(id: string): Landmark | undefined {
  return LANDMARKS.find((l) => l.id === id);
}
