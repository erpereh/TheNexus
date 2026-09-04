import { describe, expect, it } from 'vitest';
import { PerfMonitor, RingBuffer, percentile } from './perf';

describe('RingBuffer', () => {
  it('keeps only the newest capacity samples in oldest-first order', () => {
    const ring = new RingBuffer(4);
    for (const value of [1, 2, 3, 4, 5, 6]) ring.push(value);
    expect(ring.toArray()).toEqual([3, 4, 5, 6]);
    expect(ring.size).toBe(4);
    ring.clear();
    expect(ring.size).toBe(0);
    expect(ring.toArray()).toEqual([]);
  });
});

describe('percentile', () => {
  it('computes nearest-rank percentiles over synthetic frames', () => {
    const frames: number[] = [];
    for (let i = 1; i <= 100; i++) frames.push(i);
    expect(percentile(frames, 0.5)).toBe(50);
    expect(percentile(frames, 0.95)).toBe(95);
    expect(percentile(frames, 0)).toBe(1);
    expect(percentile(frames, 1)).toBe(100);
    // unsorted input is fine
    expect(percentile([30, 10, 20], 0.5)).toBe(20);
    expect(percentile([], 0.5)).toBe(0);
  });
});

describe('PerfMonitor', () => {
  it('p50/p95 track the recorded frame window', () => {
    const monitor = new PerfMonitor(1000, () => 0);
    for (let i = 1; i <= 100; i++) monitor.recordFrame(i);
    expect(monitor.p50()).toBe(50);
    expect(monitor.p95()).toBe(95);
  });

  it('respects the ring capacity for percentiles', () => {
    const monitor = new PerfMonitor(10, () => 0);
    for (let i = 1; i <= 15; i++) monitor.recordFrame(i);
    expect(monitor.frameTimes()).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    expect(monitor.p50()).toBe(10);
    expect(monitor.p95()).toBe(15);
  });

  it('measures frames through the injected clock', () => {
    let nowMs = 0;
    const monitor = new PerfMonitor(4, () => nowMs);
    monitor.beginFrame();
    nowMs = 16.5;
    const dt = monitor.endFrame();
    expect(dt).toBeCloseTo(16.5, 9);
    expect(monitor.frameTimes()).toEqual([16.5]);
  });

  it('records named marks and measures elapsed time since them', () => {
    let nowMs = 0;
    const monitor = new PerfMonitor(4, () => nowMs);
    monitor.mark('build-geometry');
    nowMs = 42;
    monitor.mark('first-frame');
    nowMs = 100;
    expect(monitor.sinceMark('build-geometry')).toBe(100); // mark at t=0
    expect(monitor.sinceMark('first-frame')).toBe(58);
    expect(monitor.sinceMark('nope')).toBeNull();
    expect(monitor.marksSnapshot().map((m) => m.name)).toEqual(['build-geometry', 'first-frame']);
    monitor.clearMarks();
    expect(monitor.sinceMark('first-frame')).toBeNull();
  });
});
