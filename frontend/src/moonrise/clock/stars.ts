// Stars spread over the whole sky in percentages, so every width gets them
// edge to edge. mulberry32: a small seeded generator, so every render (and
// the switch overlay) draws the same sky.
export interface Star {
  left: string;
  top: string;
  width: number;
  height: number;
  opacity: string;
}

export function starField(seed = 1337, n = 140): Star[] {
  let a = seed >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out: Star[] = [];
  for (let i = 0; i < n; i++) {
    const big = rnd() < 0.15;
    out.push({
      left: `${(rnd() * 100).toFixed(2)}%`,
      top: `${(rnd() * 70).toFixed(2)}%`,
      width: big ? 2 : 1,
      height: big ? 2 : 1,
      opacity: (0.25 + rnd() * 0.55).toFixed(2),
    });
  }
  return out;
}
