// Deterministic random helpers for Sunset Streets.
// Everything random in the game comes from a seeded mulberry32 stream, so a
// given seed always builds the same city, the same traffic and the same
// mission layout — screenshots and replays stay reproducible.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A float in [min, max).
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// An integer in [min, max] inclusive.
export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// One element of a list, uniformly at random.
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

// items[i] is chosen with probability weights[i] / sum(weights). Falls back
// to the last item if the roll runs past the end (floating point safety).
export function weightedPick(rng, items, weights) {
  let total = 0;
  for (const w of weights) total += w;
  let roll = rng() * total;
  for (let i = 0; i < items.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1];
}

// Fisher-Yates shuffle that returns a new array, driven by the same stream.
export function shuffle(rng, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

// Approximately standard-normal sample (mean 0, stddev 1) via Box-Muller.
export function gauss(rng) {
  const u = Math.max(1e-9, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// True with probability p (0..1): a one-line coin flip off the stream.
export function chance(rng, p) {
  return rng() < p;
}

export function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

// Shortest signed rotation from angle `from` toward angle `to`, in (-PI, PI].
export function angleDelta(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
