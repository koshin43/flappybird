/** One mulberry32 step: a whole number in [0, n) and the next unsigned 32-bit state. */
export function pick(state: number, n: number): [number, number] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n), next];
}
