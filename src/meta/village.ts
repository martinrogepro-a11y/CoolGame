/**
 * The meta loop, in the spirit of Royal Match or Homescapes: the stars won in levels
 * restore the village of each place, one visible change at a time. A sleepy, faded
 * village comes back to life: the fountain flows again, flowers bloom, the lighthouse
 * shines, boats return. Every restoration shows up in the scenery behind the levels and
 * the home screen, so progress is something you see, not a number.
 */

export type PlaceId = 'garden' | 'harbour' | 'market' | 'night' | 'deep';

export interface Restoration {
  /** Scene element it brings back (see scene.ts). */
  id: string;
  /** Stars it costs. */
  cost: number;
}

export const VILLAGES: Record<PlaceId, Restoration[]> = {
  garden: [
    { id: 'paint', cost: 1 },
    { id: 'fountain', cost: 2 },
    { id: 'flowers', cost: 2 },
    { id: 'trees', cost: 3 },
    { id: 'greenhouse', cost: 3 },
    { id: 'ducks', cost: 4 },
  ],
  harbour: [
    { id: 'paint', cost: 2 },
    { id: 'crates', cost: 2 },
    { id: 'lighthouse', cost: 3 },
    { id: 'boats', cost: 4 },
    { id: 'gulls', cost: 4 },
  ],
  market: [
    { id: 'paint', cost: 2 },
    { id: 'stalls', cost: 3 },
    { id: 'fruit', cost: 3 },
    { id: 'garlands', cost: 3 },
    { id: 'belltower', cost: 4 },
    { id: 'gondola', cost: 4 },
  ],
  night: [
    { id: 'lights', cost: 2 },
    { id: 'lamps', cost: 3 },
    { id: 'garlands', cost: 3 },
    { id: 'fireflies', cost: 4 },
    { id: 'gondola', cost: 5 },
  ],
  deep: [
    { id: 'columns', cost: 3 },
    { id: 'coral', cost: 3 },
    { id: 'seaweed', cost: 4 },
    { id: 'fish', cost: 5 },
  ],
};

export const PLACES = Object.keys(VILLAGES) as PlaceId[];

export interface VillageSave {
  /** Stars to spend. */
  stars: number;
  /** Restored elements, as "place.id". */
  done: string[];
}

export const key = (place: PlaceId, id: string) => `${place}.${id}`;

/** Restored element ids of one place. */
export function restoredIn(v: VillageSave, place: PlaceId): Set<string> {
  const pre = `${place}.`;
  return new Set(v.done.filter((d) => d.startsWith(pre)).map((d) => d.slice(pre.length)));
}

/** The next element to restore in a place (always in order: each step is a small story). */
export function nextRestoration(v: VillageSave, place: PlaceId): Restoration | null {
  return VILLAGES[place].find((r) => !v.done.includes(key(place, r.id))) ?? null;
}

export function isComplete(v: VillageSave, place: PlaceId): boolean {
  return nextRestoration(v, place) === null;
}

/** Spends stars on the next restoration of `place`. Returns it, or null if not affordable. */
export function restore(v: VillageSave, place: PlaceId): Restoration | null {
  const r = nextRestoration(v, place);
  if (!r || v.stars < r.cost) return null;
  v.stars -= r.cost;
  v.done.push(key(place, r.id));
  return r;
}
