import type { BirdColor, Medal, Sky } from '../game';

/**
 * All art, as RGBA bitmaps at half the world's resolution: one art pixel is 2×2 world pixels.
 * Grids and palettes for the bird and font; the sky, ground, pipes and medals are drawn from shapes.
 */
export interface Bitmap {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

const OUTLINE = '#543847';

function blank(width: number, height: number): Bitmap {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

function plot(b: Bitmap, x: number, y: number, hex: string): void {
  if (x < 0 || y < 0 || x >= b.width || y >= b.height) return;
  const i = (y * b.width + x) * 4;
  b.data.set([parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255], i);
}

const filled = (b: Bitmap, x: number, y: number) =>
  x >= 0 && y >= 0 && x < b.width && y < b.height && b.data[(y * b.width + x) * 4 + 3] > 0;

function rect(b: Bitmap, x: number, y: number, w: number, h: number, hex: string): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) plot(b, i, j, hex);
}

function disc(b: Bitmap, cx: number, cy: number, r: number, hex: string): void {
  for (let y = Math.floor(cy - r); y <= cy + r; y++)
    for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) plot(b, x, y, hex);
}

/** Rings every filled shape with a one-pixel outline. */
function outlined(b: Bitmap, hex = OUTLINE): Bitmap {
  const out = { ...b, data: b.data.slice() };
  for (let y = 0; y < b.height; y++)
    for (let x = 0; x < b.width; x++)
      if (!filled(b, x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => filled(b, x + dx, y + dy))) plot(out, x, y, hex);
  return out;
}

/** Paints a text grid onto `b` at (x, y); `.` and unknown keys stay as they are. */
function paint(b: Bitmap, rows: string[], palette: Record<string, string>, x = 0, y = 0): Bitmap {
  rows.forEach((row, j) => [...row].forEach((key, i) => palette[key] && plot(b, x + i, y + j, palette[key])));
  return b;
}

// --- Bird: 17×12, facing right. One body, three wings, three palettes. ---

const BODY = [
  '.................',
  '.......bbbbb.....',
  '.....bbbbbwwww...',
  '....bbbbbbwwwkw..',
  '...bbbbbbbwwwkw..',
  '..bbbbbbbbbwwww..',
  '..bbbbbbbbbbaaaaa',
  '..bbbbbbbbbaaaaa.',
  '..sbbbbbbbbbcccc.',
  '...ssssssbbbbcc..',
  '.....ssssss......',
  '.................',
];

const WING = ['.kkkk.', 'kwwwwk', 'kwwwk.', '.kkk..'];
/** Wing top row per frame: up, middle, down. */
const WING_ROWS = [3, 5, 6];

const BIRD_PALETTES: Record<BirdColor, Record<string, string>> = {
  yellow: { b: '#f8c838', s: '#fae9a4', a: '#f06030', c: '#c8402a' },
  blue: { b: '#58a8e0', s: '#c8e8f8', a: '#f0a030', c: '#c87020' },
  red: { b: '#e05048', s: '#f8c0a8', a: '#f8c838', c: '#d09020' },
};
const BIRD_SHARED = { w: '#ffffff', k: OUTLINE };

export function bird(color: BirdColor, frame: number): Bitmap {
  const palette: Record<string, string> = { ...BIRD_SHARED, ...BIRD_PALETTES[color] };
  const b = paint(blank(17, 12), BODY, palette);
  return outlined(paint(b, WING, { ...palette, w: palette.s }, 0, WING_ROWS[frame]));
}

// --- Sky: 144×200 behind everything. ---

const SKY_PALETTES: Record<Sky, { air: string; cloud: string; city: string; window: string; bush: string; bushDark: string }> = {
  day: { air: '#4ec0ca', cloud: '#e4f5d0', city: '#a8e0b0', window: '#d0f0d0', bush: '#5ec850', bushDark: '#48a840' },
  night: { air: '#0c3c58', cloud: '#2a5a70', city: '#1c6070', window: '#f8e070', bush: '#2c8040', bushDark: '#206830' },
};

/** Building [width, height] pairs, repeated across the skyline. */
const BUILDINGS = [[10, 22], [7, 30], [12, 18], [8, 26], [11, 34], [6, 20], [9, 28]];
const STARS = [[12, 20], [40, 12], [70, 30], [96, 8], [120, 24], [134, 50], [24, 60], [60, 70], [104, 64], [86, 40]];

export function sky(kind: Sky): Bitmap {
  const p = SKY_PALETTES[kind];
  const b = blank(144, 200);
  rect(b, 0, 0, 144, 200, p.air);
  if (kind === 'night') for (const [x, y] of STARS) plot(b, x, y, '#ffffff');
  for (let x = -4; x < 150; x += 13) disc(b, x, 150 + (x % 3) * 2, 8 + (x % 4), p.cloud);
  rect(b, 0, 152, 144, 48, p.cloud);
  for (let x = 0, i = 0; x < 144; i++) {
    const [w, h] = BUILDINGS[i % BUILDINGS.length];
    rect(b, x, 186 - h, w, h, p.city);
    for (let wy = 186 - h + 3; wy < 182; wy += 4) for (let wx = x + 2; wx < x + w - 2; wx += 3) plot(b, wx, wy, p.window);
    x += w + 1;
  }
  for (let x = -6; x < 150; x += 11) disc(b, x, 190 + (x % 2) * 2, 7, x % 3 ? p.bush : p.bushDark);
  rect(b, 0, 192, 144, 8, p.bush);
  return b;
}

// --- Ground: one repeating 156×56 strip; its stripes repeat every 12 art pixels. ---

export const GROUND_PERIOD = 12;

export function ground(): Bitmap {
  const b = blank(144 + GROUND_PERIOD, 56);
  rect(b, 0, 0, b.width, 1, OUTLINE);
  for (let y = 1; y < 6; y++) for (let x = 0; x < b.width; x++) plot(b, x, y, (x + y) % GROUND_PERIOD < 6 ? '#9ce659' : '#73bf2e');
  rect(b, 0, 6, b.width, 1, '#558022');
  rect(b, 0, 7, b.width, 2, '#d7a84c');
  rect(b, 0, 9, b.width, 47, '#ded895');
  return b;
}

// --- Pipes: 26 art pixels wide. One colour band drives the lip and the body. ---

const PIPE_BAND = 'kLllgggggggggggggggggdddDk';
const PIPE_PALETTE = { k: OUTLINE, L: '#e8fcb0', l: '#9ce659', g: '#73bf2e', d: '#558022', D: '#3c6018' };
export const LIP_HEIGHT = 13;

/** The lip at the gap end of a bottom pipe; the top pipe draws it flipped. */
export function pipeLip(): Bitmap {
  const rows = Array.from({ length: LIP_HEIGHT }, (_, i) => (i === 0 || i === LIP_HEIGHT - 1 ? 'k'.repeat(26) : PIPE_BAND));
  return paint(blank(26, LIP_HEIGHT), rows, PIPE_PALETTE);
}

/** One row of pipe body, stretched to length. */
export function pipeBody(): Bitmap {
  return paint(blank(26, 1), [PIPE_BAND], PIPE_PALETTE);
}

// --- Medals: 11×11 coins. ---

const MEDAL_PALETTES: Record<Medal, [string, string]> = {
  bronze: ['#c87838', '#e8a868'],
  silver: ['#a8b0b8', '#e0e8f0'],
  gold: ['#e8b020', '#f8e070'],
  platinum: ['#b8e0e8', '#ffffff'],
};

export function medal(kind: Medal): Bitmap {
  const [base, shine] = MEDAL_PALETTES[kind];
  const b = blank(11, 11);
  disc(b, 5.5, 5.5, 4.6, base);
  disc(b, 4.5, 4.5, 2, shine);
  return outlined(b);
}

// --- Font: 5×7 glyphs for the letters the screens use, outlined. ---

const GLYPHS: Record<string, string> = {
  A: '.###. #...# #...# ##### #...# #...# #...#',
  B: '####. #...# #...# ####. #...# #...# ####.',
  C: '.###. #...# #.... #.... #.... #...# .###.',
  D: '####. #...# #...# #...# #...# #...# ####.',
  E: '##### #.... #.... ####. #.... #.... #####',
  F: '##### #.... #.... ####. #.... #.... #....',
  G: '.###. #...# #.... #.### #...# #...# .####',
  I: '.###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.',
  L: '#.... #.... #.... #.... #.... #.... #####',
  M: '#...# ##.## #.#.# #.#.# #...# #...# #...#',
  N: '#...# ##..# #.#.# #..## #...# #...# #...#',
  O: '.###. #...# #...# #...# #...# #...# .###.',
  P: '####. #...# #...# ####. #.... #.... #....',
  R: '####. #...# #...# ####. #.#.. #..#. #...#',
  S: '.#### #.... #.... .###. ....# ....# ####.',
  T: '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..',
  U: '#...# #...# #...# #...# #...# #...# .###.',
  V: '#...# #...# #...# #...# #...# .#.#. ..#..',
  W: '#...# #...# #...# #.#.# #.#.# ##.## #...#',
  Y: '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..',
  0: '.###. #...# #..## #.#.# ##..# #...# .###.',
  1: '..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.',
  2: '.###. #...# ....# ...#. ..#.. .#... #####',
  3: '####. ....# ....# .###. ....# ....# ####.',
  4: '...#. ..##. .#.#. #..#. ##### ...#. ...#.',
  5: '##### #.... ####. ....# ....# #...# .###.',
  6: '.###. #.... #.... ####. #...# #...# .###.',
  7: '##### ....# ...#. ..#.. .#... .#... .#...',
  8: '.###. #...# #...# .###. #...# #...# .###.',
  9: '.###. #...# #...# .#### ....# ....# .###.',
  ' ': '..... ..... ..... ..... ..... ..... .....',
};

export type Tone = 'white' | 'gold';
const TONES: Record<Tone, string> = { white: '#ffffff', gold: '#f8b030' };

export function text(words: string, tone: Tone): Bitmap {
  const b = blank(words.length * 7, 9);
  [...words].forEach((ch, i) => {
    const glyph = GLYPHS[ch];
    if (!glyph) throw new Error(`No glyph for "${ch}"`);
    paint(b, glyph.split(' '), { '#': TONES[tone] }, 1 + i * 7, 1);
  });
  return outlined(b);
}
