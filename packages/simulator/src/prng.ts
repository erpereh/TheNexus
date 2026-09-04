/**
 * Tiny deterministic PRNG for repeatable simulations.
 *
 * This is mulberry32: a 32-bit state seeded PRNG that is dependency-free,
 * fast and stable across platforms. It is intentionally NOT suitable for
 * cryptography; it exists so simulator scenarios reproduce byte-for-byte
 * identical event streams for a given seed.
 */
export type Prng = () => number;

export function createPrng(seed: number): Prng {
  // Coerce to uint32; negative or float seeds must still be deterministic.
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
