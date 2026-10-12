// Pixel Quest art: original pixel sprites as ASCII rows (one char per art
// pixel, '.' = transparent), a small 5x7 bitmap font, and helpers that merge
// runs into one SVG path per colour so each sprite is only a few DOM nodes.
import type { PqFrame } from './pixelQuestTimeline';

export const PQ_COLORS = {
  sky: '#63C8F7', sky2: '#86D6F8', sky3: '#A9E4FA', cloud: '#FFFFFF', cloudShade: '#D3F0FF',
  hill: '#7ED9A0', hillHi: '#A6EBC0', hillFar: '#9BE2B8', bush: '#3DBE74', bushHi: '#5FD48A', bushShade: '#2E9C5D',
  grass: '#4CC15A', grassHi: '#8BE36C', grassDark: '#2F9A46', dirt: '#C9824A', dirtShade: '#A5673A', pebble: '#E3A56C', dirtDeep: '#8E5530',
  outline: '#2B1D52', face: '#7C5CFF', hi: '#B6A4FF', shade: '#5638C8', white: '#FFFFFF', yellow: '#FFE66D', cyan: '#7CF2E4', pink: '#FF6F91',
} as const;

export const PQ_PALETTE: Record<string, string> = {
  O: '#3A2340', // hero outline (warm plum)
  F: '#F2B880', // caramel fur
  S: '#D48F57', // fur shade
  B: '#FFF1DC', // cream muzzle / belly
  P: '#FF9BB0', // inner ear
  E: '#2B1D52', // eye
  W: '#FFFFFF', // glint / sole
  N: '#FF6F91', // nose
  K: '#FFB0A0', // blush
  R: '#FF4F8B', // scarf
  r: '#D12F6A', // scarf shade
  V: '#6B4BD8', // sneaker
  v: '#43309A', // sneaker shade
  Y: '#FFC93C', y: '#D9951E', L: '#FFF0B3', o: '#6B3F10', // trophy gold
  C: '#37E3D5', c: '#149C92', l: '#C9FFF9', D: '#0E3F52', // gem
  M: '#7C5CFF', m: '#5638C8', h: '#B6A4FF', X: '#2B1D52', // block violet
  Q: '#FF5D73', q: '#C93A55', U: '#FFE66D', // spring coil / plate
  G: '#4CC15A', g: '#2F9A46',
};

// 16 x 16, facing right, feet on the bottom row. Head top (row 5) is 11P above the feet.
const IDLE = [
  '......OO...OO...',
  '.....OFPO.OFPO..',
  '.....OFPO.OFPO..',
  '.....OFPO.OFPO..',
  '.....OFFOOOFFO..',
  '....OFFFFFFFFFO.',
  '...OFFFFFFFFFFFO',
  '...OFFFFFFFWEFFO',
  '...OFFFFFFFEEFBO',
  '...OSFFFFFFEEBNO',
  '....OSSFFFKKBBO.',
  '.RRRRRRRRRRRRrO.',
  'RRrOOFFFFBBBBO..',
  '.Rr.OSFFFBBBBO..',
  '.....OVVOOVVO...',
  '....OvvvOOvvvO..',
];

const withRows = (rows: string[], patch: Record<number, string>) => rows.map((row, y) => patch[y] ?? row);

export const PQ_HERO_FRAMES: Record<PqFrame, string[]> = {
  idle: IDLE,
  // Blink: ears tilt, eye closed.
  idle2: withRows(IDLE, {
    0: '.....OO....OO...',
    1: '....OFPO..OFPO..',
    7: '...OFFFFFFFFFFFO',
    8: '...OFFFFFFFEEFBO',
    9: '...OSFFFFFFFFBNO',
  }),
  // Anticipation: the head sinks a row and the ears stay upright but a row shorter; the squash is in the body,
  // which widens over wide-planted feet. Flattened ears are kept for the bonk.
  crouch: [
    '................',
    '................',
    '......OO...OO...',
    '.....OFPO.OFPO..',
    '.....OFPO.OFPO..',
    '.....OFFOOOFFO..',
    '....OFFFFFFFFFO.',
    '...OFFFFFFFFFFFO',
    '...OFFFFFFFWEFFO',
    '...OFFFFFFFEEFBO',
    '...OSFFFFFFEEBNO',
    '...OSSFFFFKKBBO.',
    'RRRRRRRRRRRRRRrO',
    '.RrOSFFFFBBBBBO.',
    '..OVVVVOOVVVVO..',
    '..OvvvvOOvvvvO..',
  ],
  run1: withRows(IDLE, {
    0: '.....OO....OO...',
    1: '....OFPO..OFPO..',
    2: '....OFPO..OFPO..',
    11: 'RRRRRRRRRRRRRrO.',
    12: '.RRrOFFFFBBBBOO.',
    13: '...OOSFFFBBBBOVO',
    14: '..OVVOOOOOOOOvO.',
    15: '..OvvO..........',
  }),
  run2: withRows(IDLE, {
    12: 'RRr.OFFFFBBBBO..',
    13: '....OSFFFBBBBO..',
    14: '.....OVVVVVVO...',
    15: '.....OvvvvvvO...',
  }),
  run3: withRows(IDLE, {
    0: '.....OO....OO...',
    1: '....OFPO..OFPO..',
    2: '....OFPO..OFPO..',
    11: 'RRRRRRRRRRRRRrO.',
    12: '.RRrOFFFFBBBBO..',
    13: '....OSFFFBBBBOO.',
    14: '...OVVOOOOOVVVO.',
    15: '...OvvO....OvvO.',
  }),
  // Rising: ears swept back, paw punching up, legs tucked.
  jump: [
    '..OOO......OO...',
    '.OFPPOO...OFPO..',
    '..OOFPPO..OFPO..',
    '....OOFFOOOFFOOO',
    '.....OFFFFFFFOWO',
    '....OFFFFFFFFFOO',
    '...OFFFFFFFFFFFO',
    '...OFFFFFFFWEFFO',
    '...OFFFFFFFEEFBO',
    '...OSFFFFFFEEBNO',
    '....OSSFFFKKBBO.',
    'RRRRRRRRRRRRRrO.',
    '..RrOFFFFBBBBO..',
    '....OSFFFBBBBO..',
    '....OVVVOOVVVO..',
    '.....OvvO.OvvO..',
  ],
  // Contact / hit-stop: eyes squeezed, ears crumpled flat, paw up.
  bonk: [
    '................',
    '................',
    '..OOOOOOO.OOOWO.',
    '.OFPPPPPFOOFFOO.',
    '..OOOOOOOOOOFO..',
    '....OFFFFFFFFFO.',
    '...OFFFFFFFFFFFO',
    '...OFFFFFFEFFFFO',
    '...OFFFFFFFEEFBO',
    '...OSFFFFFEFFBNO',
    '....OSSFFFKKBBO.',
    'RRRRRRRRRRRRRrO.',
    '..RrOFFFFBBBBO..',
    '....OSFFFBBBBO..',
    '....OVVVOOVVVO..',
    '.....OvvO.OvvO..',
  ],
  // Falling A/B: ears spring up and wobble ("boing").
  fallA: [
    '...OO.....OO....',
    '...OFO...OFPO...',
    '....OFPO.OFPO...',
    '.....OFPOOFPO...',
    '.....OFFOOFFO...',
    '....OFFFFFFFFFO.',
    '...OFFFFFFFFFFFO',
    '...OFFFFFFFWEFFO',
    '...OFFFFFFFEEFBO',
    '...OSFFFFFFEEBNO',
    '....OSSFFFKKBBO.',
    'RRRRRRRRRRRRRrO.',
    '.RRrOFFFFBBBBO..',
    '....OSFFFBBBBO..',
    '...OVVVO..OVVVO.',
    '...OvvvO..OvvvO.',
  ],
  fallB: [
    '.......OO....OO.',
    '......OFPO.OFPO.',
    '......OFPO.OFO..',
    '.....OFPO.OFPO..',
    '.....OFFOOOFFO..',
    '....OFFFFFFFFFO.',
    '...OFFFFFFFFFFFO',
    '...OFFFFFFFWEFFO',
    '...OFFFFFFFEEFBO',
    '...OSFFFFFFEEBNO',
    '....OSSFFFKKBBO.',
    'RRRRRRRRRRRRRrO.',
    '.RRrOFFFFBBBBO..',
    '....OSFFFBBBBO..',
    '...OVVVO..OVVVO.',
    '...OvvvO..OvvvO.',
  ],
  // Front-facing celebration, viewer-right paw raised high (it holds the trophy).
  cheer: [
    '....OO....OO..OO',
    '...OFPO..OPFOOFO',
    '...OFPO..OPFOOFO',
    '...OFPO..OPFOOFO',
    '...OFFOOOOFFOOFO',
    '..OFFFFFFFFFFOFO',
    '.OFWEFFFFFFWEFFO',
    '.OFEEFFFFFFEEFFO',
    '.OFEEFFFFFFEEFO.',
    '.OKKFFBNNBFFKKO.',
    '..OFFFOBBOFFFO..',
    'OWORRRRRRRRRRO..',
    'OFFORRRrrRRRO...',
    '.OO.OBBBBBBO....',
    '....OVVOOVVO....',
    '...OvvvOOvvvO...',
  ],
  cheerWink: [],
  cheerJoy: [],
};
PQ_HERO_FRAMES.cheerWink = withRows(PQ_HERO_FRAMES.cheer, { 6: '.OFWEFFFFFFFFFFO', 7: '.OFEEFFFFFFFFFFO', 8: '.OFEEFFFFFEEEFO.' });
// Both eyes squeezed into happy arcs: the wind-up before the poof.
PQ_HERO_FRAMES.cheerJoy = withRows(PQ_HERO_FRAMES.cheer, { 6: '.OFFEFFFFFFFEFFO', 7: '.OFEFEFFFFFEFEFO', 8: '.OFFFFFFFFFFFFO.' });

/**
 * The final poof, as four hand-timed frames on one grid: a lumpy cloud that swallows the hero and its trophy, a slightly
 * bigger bloom, then the cloud tearing into puffs that fly apart, then a few far wisps. Every puff is a union of 2-3 discs
 * (grid cells, from the grid centre) drawn as one silhouette: a single dark outline round the outside (so it reads on
 * white cards), a pale body with a lit top-left edge and a lavender underside and right rim, so no puff reads as a flat
 * disc. Gold twinkles pop around it as it breaks apart.
 *
 * The bloom and the break apart come in several directions, so the puffs fly away from the names beside the hero: out
 * to both sides, up, up and to one side, to one side, or (where names crowd in on every side) "in": the bloom tears into
 * lumps that drift apart and shrink inside its own outline, so the poof never reaches past the hero's own spot. The
 * planner picks the first one, in this order of fun, that covers the least card text.
 */
type PoofDisc = readonly [x: number, y: number, r: number];
type PoofSpark = readonly [x: number, y: number];
export const PQ_POOF_GRID = { w: 44, h: 40, cx: 22, cy: 24 } as const;
export const PQ_POOF_VARIANTS = ['out', 'up', 'upRight', 'upLeft', 'right', 'left', 'in'] as const;
export type PqPoofVariant = (typeof PQ_POOF_VARIANTS)[number];

// Swallow: a lumpy cumulus the size of the hero and its trophy. Bloom: every lobe pushes out about one cell.
const POOF_SWALLOW: readonly PoofDisc[] = [[0, 1, 6.4], [-5.4, -3.2, 4.6], [1, -5.6, 5], [7, -2.2, 4.2], [-9.2, 2, 3.4], [9.6, 2.4, 3.6], [-4.2, 5.6, 3.8], [4.2, 5.8, 3.8]];
const POOF_BLOOM: readonly PoofDisc[] = [[0, .6, 7], [-5.9, -3.7, 5], [1, -6.3, 5.4], [7.7, -2.7, 4.6], [-10.1, 1.9, 3.7], [10.5, 2.4, 3.9], [-4.7, 6.1, 4], [4.7, 6.3, 4]];
type PoofBreak = { bloomSparks: readonly PoofSpark[]; puffs: readonly PoofDisc[]; sparks: readonly PoofSpark[]; wisps: readonly PoofDisc[]; wispSparks: readonly PoofSpark[] };
/** The bloom torn in two: the biggest puffs, still touching near the middle. Every direction starts from them. */
const POOF_CORE: readonly PoofDisc[] = [
  [-5, -3, 4.4], [-8.4, -.4, 3.2], [-2.6, .6, 3], // big, left of centre
  [5, -4.4, 4.2], [8.2, -2, 3.2], [2.4, -1, 2.8], // big, right of centre (touching)
];
/** Bloom twinkles, break-apart puffs and wisps per direction ('left' and 'upLeft' mirror 'right' and 'upRight'). */
const POOF_BREAK: Record<'out' | 'up' | 'upRight' | 'right' | 'in', PoofBreak> = {
  out: {
    bloomSparks: [[-16, -12], [15, -13]],
    puffs: [
      ...POOF_CORE,
      [-11.4, -10.2, 2.8], [-8.8, -11.2, 2.2], // up-left
      [10.8, -11, 2.8], [13, -9.6, 2.2], // up-right
      [0, -12.6, 2.6], [2.4, -13.4, 2], // top
      [-14, 4, 2], [-12.4, 5.2, 1.6], // small, low left
      [14, 3.4, 2], [15.4, 4.6, 1.4], // small, low right
    ],
    sparks: [[-17, -5], [8, -18], [-16, -16], [5, 10]],
    wisps: [[-15.4, -15, 1.8], [-13.8, -15.8, 1.3], [1.5, -18.4, 1.8], [3, -19, 1.2], [15, -15.4, 1.8], [16.5, -14.6, 1.3], [-17.6, 3.6, 1.4], [-16.4, 2.8, 1.1]],
    wispSparks: [[-19, -20], [18, -20], [9, 7], [-9, 8]],
  },
  // Up: the puffs rise over the hero's head and stay within its width.
  up: {
    bloomSparks: [[-9, -15], [10, -16]],
    puffs: [
      [-4.4, -5, 4.2], [-7.4, -2.8, 3], [-2.2, -2, 2.8],
      [4.4, -5.8, 4.2], [7.4, -3.6, 3], [2.2, -2.8, 2.8],
      [-8.6, -13, 2.8], [-6.4, -14, 2.2],
      [8.8, -13.4, 2.8], [11, -12.2, 2.2],
      [.4, -15.8, 2.6], [2.8, -16.6, 2],
    ],
    sparks: [[-13, -9], [13, -8], [-4, -20], [7, -20]],
    wisps: [[-9.6, -18.4, 1.8], [-8.2, -19.2, 1.3], [1.5, -21, 1.8], [3, -21.6, 1.2], [10.4, -18.6, 1.8], [11.8, -17.8, 1.3]],
    wispSparks: [[-14, -14], [15, -15], [-4, -16], [6, -15]],
  },
  upRight: {
    bloomSparks: [[3, -16], [15, -11]],
    puffs: [
      ...POOF_CORE,
      [1, -13.6, 2.6], [3.4, -14.4, 2], // top
      [11, -11.6, 2.8], [13.2, -10.2, 2.2], // up-right
      [15, -3, 2], [16.4, -1.8, 1.4], // right
    ],
    sparks: [[-4, -17], [17, -12], [7, -19], [18, 4]],
    wisps: [[5, -19, 1.8], [6.5, -19.6, 1.2], [14.6, -16, 1.8], [16, -15.2, 1.3], [18.4, -6, 1.4], [19.4, -6.8, 1]],
    wispSparks: [[0, -21], [19, -11], [10, -14], [17, 1]],
  },
  right: {
    bloomSparks: [[12, -14], [17, -6]],
    puffs: [
      [-4, -2.6, 4.2], [-7, -.2, 3], [-2, .8, 2.8],
      [6, -5, 4.2], [9.2, -2.8, 3], [3.4, -2, 2.8],
      [-8, -11, 2.6], [-6, -12, 2],
      [12.6, -12, 3], [14.8, -10.4, 2.2],
      [2, -13.6, 2.6], [4.4, -14.4, 2],
      [-10.4, 4.6, 1.8], [-9, 5.8, 1.4],
      [16, 2, 2], [17.4, 3.2, 1.4],
    ],
    sparks: [[-12, -6], [9, -19], [19, -5], [4, 9]],
    wisps: [[-9.6, -17, 1.6], [-8.2, -17.8, 1.2], [4, -19.4, 1.8], [5.5, -20, 1.2], [17, -16, 1.8], [18.4, -15.2, 1.3], [18.6, .4, 1.4], [19.6, -.4, 1]],
    wispSparks: [[-14, -21], [12, -21], [19, 6], [0, 8]],
  },
  // In: everything stays inside the bloom's outline. The lumps drift a little apart, then shrink to wisps and twinkles.
  in: {
    bloomSparks: [],
    puffs: [
      [-6.4, -3.6, 3.9], [-9.4, -.6, 2.8], [-4, .4, 2.5],
      [6.4, -4.8, 3.8], [9.2, -2.2, 2.8], [3.8, -1.4, 2.4],
      [.4, -8.8, 2.6], [2.4, -9.4, 2],
      [-6.6, 6.6, 2.2], [6.8, 6.4, 2],
    ],
    sparks: [[-11, -8], [11, -9], [0, 6]],
    // The last wisps: three small puffs high in the bloom's outline, with twinkles below them.
    wisps: [[-7.6, -6.6, 2.2], [-5.8, -7.6, 1.6], [7.8, -7.4, 2.2], [9.4, -6.4, 1.5], [.4, -8.8, 1.8], [2, -9.2, 1.3]],
    wispSparks: [[-11, -2], [11, -1], [-3, 4], [5, 5]],
  },
};
export const PQ_POOF_PALETTE: Record<string, string> = { X: '#2B1D52', W: '#FFFFFF', w: '#EEF1FF', l: '#C5CEFF', Y: '#FFC93C', L: '#FFF6C8' };

function poofFrame(discs: readonly PoofDisc[], sparks: readonly PoofSpark[]): string[] {
  const { w, h, cx, cy } = PQ_POOF_GRID;
  const inDisc = ([dx, dy, r]: PoofDisc, x: number, y: number) => (x + .5 - cx - dx) ** 2 + (y + .5 - cy - dy) ** 2 <= r * r;
  // The union of the discs, with any pinholes between lobes filled (only cells reachable from the edge are outside).
  const solid = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => discs.some((disc) => inDisc(disc, x, y))));
  const outside = Array.from({ length: h }, () => Array.from({ length: w }, () => false));
  const queue: [number, number][] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x === 0 || y === 0 || x === w - 1 || y === h - 1) && !solid[y][x]) { outside[y][x] = true; queue.push([x, y]); }
  while (queue.length) {
    const [x, y] = queue.pop()!;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || outside[ny][nx] || solid[ny][nx]) continue;
      outside[ny][nx] = true;
      queue.push([nx, ny]);
    }
  }
  const body = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && !outside[y][x];
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) {
      if (!body(x, y)) row += body(x - 1, y) || body(x + 1, y) || body(x, y - 1) || body(x, y + 1) ? 'X' : '.';
      // Lit from the top left: the underside (two rows) and the right rim are lavender, the top-left edge is pure white.
      else if (!body(x, y + 1) || !body(x, y + 2) || !body(x + 1, y)) row += 'l';
      else if (!body(x, y - 1) || !body(x - 1, y)) row += 'W';
      else row += 'w';
    }
    rows.push(row);
  }
  // A plus-shaped twinkle: a pale centre with gold arms, only where all five cells are empty.
  const cells = rows.map((row) => row.split(''));
  const arms = [[0, 0, 'L'], [-1, 0, 'Y'], [1, 0, 'Y'], [0, -1, 'Y'], [0, 1, 'Y']] as const;
  for (const [dx, dy] of sparks) {
    if (!arms.every(([ox, oy]) => cells[cy + dy + oy]?.[cx + dx + ox] === '.')) continue;
    for (const [ox, oy, ch] of arms) cells[cy + dy + oy][cx + dx + ox] = ch;
  }
  return cells.map((row) => row.join(''));
}

const mirrorDiscs = (list: readonly PoofDisc[]): PoofDisc[] => list.map(([x, y, r]) => [-x, y, r]);
const mirrorSparks = (list: readonly PoofSpark[]): PoofSpark[] => list.map(([x, y]) => [-x, y]);
const POOF_SWALLOW_ROWS = poofFrame(POOF_SWALLOW, []);
const MIRRORED: Partial<Record<PqPoofVariant, keyof typeof POOF_BREAK>> = { left: 'right', upLeft: 'upRight' };
/** The four frames of each direction: swallow, bloom, break apart, wisps. */
export const PQ_POOF_SETS = Object.fromEntries(PQ_POOF_VARIANTS.map((variant): [PqPoofVariant, readonly string[][]] => {
  const source = MIRRORED[variant];
  const set = POOF_BREAK[source ?? (variant as keyof typeof POOF_BREAK)];
  const discs = (list: readonly PoofDisc[]) => (source ? mirrorDiscs(list) : list);
  const sparks = (list: readonly PoofSpark[]) => (source ? mirrorSparks(list) : list);
  const frames = [
    POOF_SWALLOW_ROWS,
    poofFrame(POOF_BLOOM, sparks(set.bloomSparks)),
    poofFrame(discs(set.puffs), sparks(set.sparks)),
    poofFrame(discs(set.wisps), sparks(set.wispSparks)),
  ];
  return [variant, frames];
})) as Record<PqPoofVariant, readonly string[][]>;
export const PQ_POOF_FRAMES: readonly string[][] = PQ_POOF_SETS.out;
/** How long each poof frame shows, in s (the CSS steps match): swallow, bloom, break apart, wisps. */
export const PQ_POOF_HOLDS = [.07, .08, .08, .09] as const;

/** A frame's painted cells as one box per row run, in cells from the grid centre: what the planner keeps off card text. */
export function poofFootprint(rows: readonly string[]): { x: number; y: number; w: number; h: number }[] {
  const { cx, cy } = PQ_POOF_GRID;
  const out: { x: number; y: number; w: number; h: number }[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '.') continue;
      let end = x;
      while (end < row.length && row[end] !== '.') end++;
      out.push({ x: x - cx, y: y - cy, w: end - x, h: 1 });
      x = end;
    }
  });
  return out;
}

/** Where the trophy sits relative to the hero's feet anchor in the cheer pose (in P). */
export const PQ_CHEER_TROPHY = { x: 5, y: -18 } as const;

export const PQ_TROPHY = [
  '.oooooooo.',
  'ooLLYYYYoo',
  'oYLYYLYYyo',
  'oYLYLLLYyo',
  '.oLYYLYyo.',
  '.oYYLYYyo.',
  '..oYYYyo..',
  '...oYyo...',
  '...oYyo...',
  '..oXXXXo..',
  '.oMhMMMmo.',
  '.oXXXXXXo.',
];

export const PQ_GEM = [
  '..DDDD..',
  '.DlCCcD.',
  'DllCCCcD',
  'DlCCCCcD',
  '.DCCCcD.',
  '..DCcD..',
  '...DD...',
  '........',
];

export const PQ_STAR = [
  '...W...',
  '...W...',
  '..WLW..',
  'WWLYLWW',
  '..WLW..',
  '...W...',
  '...W...',
];

export const PQ_SPRING = [
  '.XXXXXX.',
  'XUUUUUUX',
  'XyyyyyyX',
  '.XXXXXX.',
  '..XQqX..',
  '.XQXXqX.',
  '..XQqX..',
  '.XXXXXX.',
];

export const PQ_CLOUD = [
  '....XXXX........',
  '..XXXXXXXX.XXX..',
  '.XXXXXXXXXXXXXXX',
  'XXXXXXXXXXXXXXXX',
  '.SSSSSSSSSSSSSS.',
];

// 5 x 7 pixel font (only the glyphs the reveal needs).
export const PQ_FONT: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  '0': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};

export type PqPath = { fill: string; d: string };

/** Merge each row into runs per colour: one path per colour keeps the DOM tiny. */
export function spritePaths(rows: readonly string[], palette: Record<string, string> = PQ_PALETTE, cell = 1): PqPath[] {
  const byColor = new Map<string, string[]>();
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.') { x++; continue; }
      let end = x;
      while (end < row.length && row[end] === ch) end++;
      const list = byColor.get(ch) ?? [];
      list.push(`M${x * cell} ${y * cell}h${(end - x) * cell}v${cell}h${-(end - x) * cell}z`);
      byColor.set(ch, list);
      x = end;
    }
  });
  return [...byColor.entries()].map(([ch, d]) => ({ fill: palette[ch] ?? '#f0f', d: d.join('') }));
}

/** Text as one path of unit cells (cell = 1); glyphs advance 6 cells. */
export function textPath(text: string, cell = 1): { d: string; width: number; height: number } {
  const d: string[] = [];
  text.split('').forEach((ch, i) => {
    const glyph = PQ_FONT[ch] ?? PQ_FONT[' '];
    glyph.forEach((row, y) => {
      let x = 0;
      while (x < row.length) {
        if (row[x] !== '#') { x++; continue; }
        let end = x;
        while (end < row.length && row[end] === '#') end++;
        d.push(`M${(i * 6 + x) * cell} ${y * cell}h${(end - x) * cell}v${cell}h${-(end - x) * cell}z`);
        x = end;
      }
    });
  });
  return { d: d.join(''), width: Math.max(0, text.length * 6 - 1) * cell, height: 7 * cell };
}

/** Every glyph a caption needs exists in the font. */
export const PQ_TEXTS = ['PLAYER 1', '3', '2', '1', 'GO!', 'LEVEL CLEAR!', '+1', 'x00'] as const;
