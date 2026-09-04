export type ScheduledCancel = () => void;

interface PendingTask {
  id: number;
  timeMs: number;
  task: () => void;
}

/**
 * Deterministic virtual-time scheduler for replay tests. Nothing runs on
 * wall-clock timers: tests advance time explicitly and tasks execute in
 * (time, insertion) order, so replay outcomes are fully reproducible.
 */
export class ManualReplayScheduler {
  currentTimeMs = 0;
  private pending: PendingTask[] = [];
  private nextId = 0;

  nowMs(): number {
    return this.currentTimeMs;
  }

  schedule(delayMs: number, task: () => void): ScheduledCancel {
    const id = this.nextId++;
    this.pending.push({ id, timeMs: this.currentTimeMs + Math.max(0, delayMs), task });
    return () => {
      this.pending = this.pending.filter((entry) => entry.id !== id);
    };
  }

  /** Runs every task due within `ms`, in (time, insertion) order. */
  advanceBy(ms: number): number {
    return this.runUntil(this.currentTimeMs + Math.max(0, ms));
  }

  /** Advances the clock to the earliest pending task and runs it. */
  advanceToNext(): boolean {
    const earliest = this.pending.reduce<PendingTask | null>(
      (best, entry) => (best === null || entry.timeMs < best.timeMs ? entry : best),
      null,
    );
    if (earliest === null) return false;
    this.currentTimeMs = Math.max(this.currentTimeMs, earliest.timeMs);
    return this.runUntil(this.currentTimeMs) > 0;
  }

  pendingCount(): number {
    return this.pending.length;
  }

  clear(): void {
    this.pending = [];
  }

  private runUntil(timeMs: number): number {
    let executed = 0;
    let progressed = true;
    while (progressed) {
      progressed = false;
      let best: PendingTask | null = null;
      for (const entry of this.pending) {
        if (entry.timeMs <= timeMs && (best === null || entry.id < best.id)) {
          best = entry;
        }
      }
      if (best !== null) {
        this.pending = this.pending.filter((entry) => entry.id !== best.id);
        best.task();
        executed++;
        progressed = true;
      }
    }
    return executed;
  }
}
