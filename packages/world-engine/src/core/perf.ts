/**
 * Performance instrumentation for the world engine.
 *
 * This is the ONLY core module allowed to read a clock: the default clock
 * is the monotonic `performance.now()` and every consumer can (and tests
 * do) inject a deterministic replacement. No DOM types are used.
 */

export class RingBuffer {
  private readonly samples: Float64Array;
  private writeIndex = 0;
  private filled = 0;

  constructor(readonly capacity: number) {
    if (capacity <= 0) throw new Error('capacity must be positive');
    this.samples = new Float64Array(capacity);
  }

  get size(): number {
    return this.filled;
  }

  push(value: number): void {
    this.samples[this.writeIndex] = value;
    this.writeIndex = (this.writeIndex + 1) % this.capacity;
    this.filled = Math.min(this.filled + 1, this.capacity);
  }

  /** Oldest-to-newest snapshot of the retained window. */
  toArray(): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.filled; i++) {
      const index = (this.writeIndex - this.filled + i + this.capacity) % this.capacity;
      out.push(this.samples[index] ?? 0);
    }
    return out;
  }

  clear(): void {
    this.writeIndex = 0;
    this.filled = 0;
    this.samples.fill(0);
  }
}

/**
 * Nearest-rank percentile: rank = ceil(p * n) over the ascending-sorted
 * samples, clamped into [1, n]. Returns 0 for empty input; p is clamped to
 * [0, 1].
 */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const clamped = Math.min(1, Math.max(0, p));
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil(clamped * sorted.length);
  const index = Math.min(Math.max(rank, 1), sorted.length) - 1;
  return sorted[index] ?? 0;
}

export interface PerfMark {
  name: string;
  atMs: number;
}

function defaultNow(): number {
  return performance.now();
}

export class PerfMonitor {
  private readonly frames: RingBuffer;
  private readonly marks: PerfMark[] = [];
  private frameStart = 0;
  private readonly now: () => number;

  /**
   * @param capacity ring-buffer size for frame times
   * @param now monotonic clock; defaults to performance.now()
   */
  constructor(capacity = 120, now: () => number = defaultNow) {
    this.frames = new RingBuffer(capacity);
    this.now = now;
  }

  beginFrame(): void {
    this.frameStart = this.now();
  }

  /** Ends the frame and records the elapsed milliseconds; returns them. */
  endFrame(): number {
    const dt = this.now() - this.frameStart;
    this.frames.push(dt);
    return dt;
  }

  /** Records a frame duration measured elsewhere (headless/tick timing). */
  recordFrame(durationMs: number): void {
    this.frames.push(durationMs);
  }

  frameTimes(): readonly number[] {
    return this.frames.toArray();
  }

  p50(): number {
    return percentile(this.frames.toArray(), 0.5);
  }

  p95(): number {
    return percentile(this.frames.toArray(), 0.95);
  }

  mark(name: string): void {
    this.marks.push({ name, atMs: this.now() });
  }

  marksSnapshot(): readonly PerfMark[] {
    return [...this.marks];
  }

  /** Milliseconds since the most recent `name` mark; null when unknown. */
  sinceMark(name: string): number | null {
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const mark = this.marks[i];
      if (mark !== undefined && mark.name === name) return this.now() - mark.atMs;
    }
    return null;
  }

  clearMarks(): void {
    this.marks.length = 0;
  }

  clearAll(): void {
    this.frames.clear();
    this.marks.length = 0;
  }
}
