/**
 * Pixel pictures hidden in puzzle levels. Legend: r clay, b slate, g jade, y saffron,
 * p plum, . stone background. Order does not matter: chapters pick pictures by id.
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
  { id: 'balloon', rows: ['...rrr...', '.rryyyrr.', 'rryyyyyrr', 'rryyyyyrr', '.rryyyrr.', '..rrrrr..', '....b....', '...bbb...', '...bbb...'] },
  { id: 'tulip', rows: ['......', '.p.p.p', '.ppppp', '..ppp.', '...g..', '.ggg..'] },
  { id: 'apple', rows: ['...g..', '..g...', '.rrrr.', 'rrrrrr', 'rrrrrr', '.rr.r.'] },
  { id: 'snail', rows: ['......', '.yyy..', 'yy.y..', 'yyy.y.', '.yyyyr', 'rrrrrr'] },
  { id: 'leaf', rows: ['....gg', '..gggg', '.gggyg', '.ggygg', '.gygg.', 'y.gg..'] },
  { id: 'anchor', rows: ['...b...', '..b.b..', '...b...', '.bbbbb.', '...b...', 'b..b..b', '.bbbbb.'] },
  { id: 'shell', rows: ['...p...', '..ppp..', '.pyppy.', 'ppypypp', 'pypppyp', '.ppppp.', '..ppp..'] },
  { id: 'crab', rows: ['r.....r', 'rr...rr', '.r.b.r.', '..rrr..', '.rrrrr.', 'rrrrrrr', 'r.r.r.r'] },
  { id: 'jellyfish', rows: ['..ppp..', '.ppppp.', 'ppbpbpp', 'ppppppp', '.p.p.p.', 'p.p.p.p', '.p.p.p.'] },
  { id: 'octopus', rows: ['..ppp..', '.ppppp.', '.pyppy.', '.ppppp.', 'p.ppp.p', '.p.p.p.', 'p..p..p'] },
  { id: 'island', rows: ['...gg...', '..g..g..', '...gg...', '....r...', '....r...', '..yyyy..', '.yyyyyy.', 'bbbbbbbb'] },
  { id: 'cup', rows: ['..y.y..', '...y...', '.rrrrr.', '.rrrrrr', '.rrrr.r', '.rrrrr.', 'bbbbbbb'] },
  { id: 'cake', rows: ['...rr...', '...yy...', '.pppppp.', 'pppppppp', 'yyyyyyyy', 'pppppppp', 'yyyyyyyy', 'bbbbbbbb'] },
  { id: 'pear', rows: ['....g...', '...gg...', '...yy...', '..yyyy..', '..yyyy..', '.yyyyyy.', '.yyyyyy.', '..yyyy..'] },
  { id: 'teapot', rows: ['...yy...', '..bbbb..', 'b.bbbbbb', 'bbbbbb.b', '.bbbbb.b', '.bbbbbbb', '.bbbbbb.', '..yyyy..'] },
  { id: 'strawberry', rows: ['.g.gg.g.', '..gggg..', '.rrrrrr.', 'rryrrrrr', 'rrrrryrr', '.rryrrr.', '..rrrr..', '...rr...'] },
  { id: 'owl', rows: ['b......b', 'bbbbbbbb', 'byybbyyb', 'byrbbryb', 'bbbyybbb', '.bbbbbb.', '.bpppb..', '..y..y..'] },
  { id: 'rocket', rows: ['....r....', '...rrr...', '...bbb...', '...bpb...', '...bbb...', '..rbbbr..', '.rrbbbrr.', '...yyy...', '....y....'] },
  { id: 'lantern', rows: ['...bbb...', '..bbbbb..', '.byyyyyb.', '.byyyyyb.', '.byyryyb.', '.byyyyyb.', '.byyyyyb.', '..bbbbb..', '...bbb...'] },
  { id: 'umbrella', rows: ['....p....', '..ppppp..', '.ppppppp.', 'ppppppppp', 'p.p.b.p.p', '....b....', '....b....', '..b.b....', '...b.....'] },
  { id: 'castle', rows: ['b.b...b.b', 'bbb.y.bbb', 'bbbbbbbbb', 'bybbbbbyb', 'bbbbbbbbb', 'bbbbrbbbb', 'bbbrrrbbb', 'bbbrrrbbb', 'ggggggggg'] },
  { id: 'penguin', rows: ['...bbb...', '..bbbbb..', '.bb.b.bb.', '.bbbybbb.', 'bb.....bb', 'bb.....bb', '.b.....b.', '..b...b..', '.yy...yy.'] },
];

const CODE: Record<string, number> = { r: 0, b: 1, g: 2, y: 3, p: 4, '.': 5 };

/** Colour index per cell (0-4 materials, 5 stone background). */
export function pictureColors(p: Picture): number[] {
  return p.rows.join('').split('').map((ch) => CODE[ch] ?? 5);
}

export function pictureById(id: string): Picture {
  const p = PICTURES.find((x) => x.id === id);
  if (!p) throw new Error(`unknown picture ${id}`);
  return p;
}
