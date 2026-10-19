/**
 * Pixel pictures hidden in puzzle levels. Legend: r clay, b slate, g jade, y saffron,
 * p plum, . stone background. Level order = difficulty order (grid grows).
 */

export interface Picture {
  id: string;
  rows: string[];
}

export const PICTURES: readonly Picture[] = [
  { id: 'heart', rows: ['.r.r.', 'rrrrr', 'rrrrr', '.rrr.', '..r..'] },
  { id: 'house', rows: ['..r..', '.rrr.', 'rrrrr', '.yby.', '.yby.'] },
  { id: 'tree', rows: ['.ggg.', 'ggggg', '.ggg.', '..r..', '..r..'] },
  { id: 'drop', rows: ['..b..', '.bbb.', 'bbbbb', 'bbbbb', '.bbb.'] },
  { id: 'mushroom', rows: ['.rrrr.', 'rryrrr', 'rrrryr', '..yy..', '..yy..', '......'] },
  { id: 'fish', rows: ['......', '.bbb.b', 'bybbbb', 'bbbbbb', '.bbb.b', '......'] },
  { id: 'sun', rows: ['y.yy.y', '.yyyy.', 'yyyyyy', 'yyyyyy', '.yyyy.', 'y.yy.y'] },
  { id: 'boat', rows: ['..r...', '..rr..', '..rrr.', '..y...', 'yyyyyy', 'bbbbbb'] },
  { id: 'cat', rows: ['y.....y', 'yy...yy', 'yyyyyyy', 'ygyyygy', 'yyyryyy', 'yyyyyyy', '.yyyyy.'] },
  { id: 'flower', rows: ['..ppp..', '.ppypp.', '..ppp..', '...g...', '.g.g.g.', '..ggg..', '...g...'] },
  { id: 'icecream', rows: ['..ppp..', '.ppppp.', '.pprpp.', '.ppppp.', '..yyy..', '..yyy..', '...y...'] },
  { id: 'fir', rows: ['...g...', '..ggg..', '.ggggg.', '..ggg..', '.ggggg.', 'ggggggg', '...r...'] },
  { id: 'moon', rows: ['bbbbbbb', 'bbyyybb', 'byybbbb', 'byybbyb', 'byybbbb', 'bbyyybb', 'bbbbbbb'] },
  { id: 'whale', rows: ['....b...', '...b.b..', '........', '.bbbbb..', 'bybbbbb.', 'bbbbbbbb', '.bbbbb.b', 'gggggggg'] },
  { id: 'fox', rows: ['r......r', 'rr....rr', 'rrrrrrrr', 'rbrrrrbr', 'rrrrrrrr', '.rrrrrr.', '..rbbr..', '...rr...'] },
  { id: 'lighthouse', rows: ['y..pp..y', '.yyyyyy.', 'y..pp..y', '...rr...', '...rr...', '..rrrr..', '.gggggg.', 'bbbbbbbb'] },
  { id: 'butterfly', rows: ['pp....pp', 'pyp..pyp', 'pppbbppp', '.ppbbpp.', '.ppbbpp.', 'pppbbppp', 'pyp..pyp', 'pp....pp'] },
  { id: 'turtle', rows: ['.........', '...ggg...', '..ggygg..', '.ggyggyg.', 'yggggggg.', '.ggygggg.', '..ggggg..', '.y.....y.', '.........'] },
  { id: 'balloon', rows: ['..rrrrr..', '.rryyyrr.', 'rrryyyrrr', 'rrryyyrrr', '.rryyyrr.', '..ryyyr..', '...b.b...', '...bbb...', '...bbb...'] },
  { id: 'penguin', rows: ['...bbb...', '..bbbbb..', '.bb.b.bb.', '.bbbybbb.', 'bb.....bb', 'bb.....bb', '.b.....b.', '..b...b..', '.yy...yy.'] },
];

const CODE: Record<string, number> = { r: 0, b: 1, g: 2, y: 3, p: 4, '.': 5 };

/** Colour index per cell (0-4 materials, 5 stone background). */
export function pictureColors(p: Picture): number[] {
  return p.rows.join('').split('').map((ch) => CODE[ch] ?? 5);
}
