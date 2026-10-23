// Seven-segment geometry: one digit is 60 × 108 units, segments 11 thick.
export const DW = 60;
export const DH = 108;
const T = 11;
const G = 2;
const GAP = 14;
const CW = 22;

type Pt = [number, number];
type Seg = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';

function hseg(x1: number, x2: number, y: number): Pt[] {
  const t = T / 2;
  return [
    [x1, y],
    [x1 + t, y - t],
    [x2 - t, y - t],
    [x2, y],
    [x2 - t, y + t],
    [x1 + t, y + t],
  ];
}

function vseg(x: number, y1: number, y2: number): Pt[] {
  const t = T / 2;
  return [
    [x, y1],
    [x + t, y1 + t],
    [x + t, y2 - t],
    [x, y2],
    [x - t, y2 - t],
    [x - t, y1 + t],
  ];
}

const L = T / 2;
export const R = DW - T / 2;
const TOP = T / 2;
const MID = DH / 2;
const BOT = DH - T / 2;

export const SEGS: Record<Seg, Pt[]> = {
  a: hseg(L + G, R - G, TOP),
  b: vseg(R, TOP + G, MID - G),
  c: vseg(R, MID + G, BOT - G),
  d: hseg(L + G, R - G, BOT),
  e: vseg(L, MID + G, BOT - G),
  f: vseg(L, TOP + G, MID - G),
  g: hseg(L + G, R - G, MID),
};

export const ALL: Seg[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

export const DIGITS: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abged',
  '3': 'abgcd',
  '4': 'fgbc',
  '5': 'afgcd',
  '6': 'afgedc',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
  '-': 'g',
  ' ': '',
};

export const T_HALF = T / 2;
export const COLON_W = CW;

export function points(p: Pt[], dx: number): string {
  return p.map((q) => `${q[0] + dx},${q[1]}`).join(' ');
}

export type Item =
  { kind: 'colon'; x: number } | { kind: 'digit'; ch: string; x: number };

export function layout(value: string): { items: Item[]; width: number } {
  const items: Item[] = [];
  let x = 0;
  for (const ch of value) {
    if (ch === ':') {
      items.push({ kind: 'colon', x });
      x += CW + GAP;
    } else {
      items.push({ kind: 'digit', ch, x });
      x += DW + GAP;
    }
  }
  return { items, width: Math.max(1, x - GAP) };
}

// Boot frames run every FRAME_MS. The first digit locks in at frame
// LOCK_FIRST, each next one LOCK_STEP frames later.
export const FRAME_MS = 70;
export const LOCK_FIRST = 10;
export const LOCK_STEP = 4;

/** How long the lock-in takes once a held scramble is released. */
export function lockInMs(digits: number): number {
  return (LOCK_STEP * Math.max(0, digits - 1) + 2) * FRAME_MS;
}
