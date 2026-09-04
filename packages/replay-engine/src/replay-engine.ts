import type { NormalizedEvent } from '@thenexus/contracts';
import type { ReplayTimeline } from './timeline';

export const REPLAY_SPEEDS = [1, 2, 5, 10, 50] as const;
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];
export type ReplayStatus = 'idle' | 'playing' | 'paused' | 'finished';

export interface ReplayState {
  status: ReplayStatus;
  speed: ReplaySpeed;
  nextIndex: number;
  totalEvents: number;
}

export interface ReplayScheduler {
  nowMs(): number;
  schedule(delayMs: number, task: () => void): () => void;
}

export interface ReplayListener<S> {
  onStateChange?(state: ReplayState): void;
  onEvent?(event: NormalizedEvent, index: number): void;
  /** Fired after stepBackward/jumpTo rebuilt the projector state. */
  onJump?(state: S, toIndex: number): void;
  onFinish?(): void;
}

export interface ReplayProjector<S> {
  initialState(): S;
  apply(state: S, event: NormalizedEvent): S;
}

export interface ReplayEngineOptions<S> {
  timeline: ReplayTimeline;
  /** Raw events aligned by index with `timeline.entries`. */
  events: readonly NormalizedEvent[];
  scheduler: ReplayScheduler;
  projector: ReplayProjector<S>;
  listener?: ReplayListener<S>;
}

/**
 * Deterministic recording playback. The engine never touches wall-clock
 * timers: all scheduling goes through the injected ReplayScheduler, so
 * speeds, pauses, steps and jumps only reorder *when* callbacks run —
 * never which events are delivered or in what logical order.
 *
 * stepBackward/jumpTo rebuild projector state by re-applying the event
 * prefix through the projector; the resulting state is handed to
 * listener.onJump so UIs redraw from state instead of re-streaming events.
 */
export class ReplayEngine<S> {
  private state: ReplayState;
  private projectorState: S;
  private cancelScheduled: (() => void) | null = null;
  private disposed = false;

  constructor(private readonly options: ReplayEngineOptions<S>) {
    this.state = {
      status: 'idle',
      speed: 1,
      nextIndex: 0,
      totalEvents: options.timeline.totalEvents,
    };
    this.projectorState = options.projector.initialState();
  }

  play(): void {
    if (this.disposed || this.state.status === 'finished') return;
    if (this.state.status === 'playing') return;
    const done = this.state.nextIndex >= this.state.totalEvents;
    this.setStatus(done ? 'finished' : 'playing');
    if (done) {
      this.options.listener?.onFinish?.();
      return;
    }
    this.scheduleNext();
  }

  pause(): void {
    if (this.disposed || this.state.status !== 'playing') return;
    this.cancelScheduled?.();
    this.cancelScheduled = null;
    this.setStatus('paused');
  }

  resume(): void {
    this.play();
  }

  stepForward(): void {
    if (this.disposed || this.state.status === 'finished') return;
    this.cancelScheduled?.();
    this.cancelScheduled = null;
    this.deliver(this.state.nextIndex);
  }

  stepBackward(): void {
    if (this.disposed || this.state.nextIndex === 0) return;
    this.cancelScheduled?.();
    this.cancelScheduled = null;
    const target = this.state.nextIndex - 1;
    this.rebuildTo(target);
  }

  jumpTo(index: number): void {
    if (this.disposed) return;
    const target = Math.max(0, Math.min(index, this.state.totalEvents));
    if (target === this.state.nextIndex) return;
    this.cancelScheduled?.();
    this.cancelScheduled = null;
    this.rebuildTo(target);
    if (this.state.status === 'playing') {
      this.scheduleNext();
    }
  }

  setSpeed(speed: ReplaySpeed): void {
    if (this.disposed) return;
    this.state = { ...this.state, speed };
    this.options.listener?.onStateChange?.(this.state);
  }

  getState(): ReplayState {
    return this.state;
  }

  dispose(): void {
    this.cancelScheduled?.();
    this.cancelScheduled = null;
    this.disposed = true;
  }

  private rebuildTo(target: number): void {
    let state = this.options.projector.initialState();
    for (let i = 0; i < target; i++) {
      const event = this.options.events[i];
      if (event === undefined) break;
      state = this.options.projector.apply(state, event);
    }
    this.projectorState = state;
    this.state = { ...this.state, nextIndex: target };
    this.options.listener?.onJump?.(state, target);
    this.options.listener?.onStateChange?.(this.state);
    if (target === this.state.totalEvents && this.state.status !== 'idle') {
      this.finish();
    }
  }

  private deliver(index: number): void {
    const event = this.options.events[index];
    if (event === undefined) {
      this.finish();
      return;
    }
    this.projectorState = this.options.projector.apply(this.projectorState, event);
    this.state = { ...this.state, nextIndex: index + 1 };
    this.options.listener?.onEvent?.(event, index);
    this.options.listener?.onStateChange?.(this.state);
    if (this.state.nextIndex >= this.state.totalEvents) {
      this.finish();
      return;
    }
    if (this.state.status === 'playing') {
      this.scheduleNext();
    }
  }

  private scheduleNext(): void {
    const entry = this.options.timeline.entries[this.state.nextIndex];
    const delayMs = entry === undefined ? 0 : entry.delayMs / this.state.speed;
    this.cancelScheduled?.();
    this.cancelScheduled = this.options.scheduler.schedule(delayMs, () => {
      this.cancelScheduled = null;
      if (this.disposed || this.state.status !== 'playing') return;
      this.deliver(this.state.nextIndex);
    });
  }

  private finish(): void {
    this.setStatus('finished');
    this.options.listener?.onFinish?.();
  }

  private setStatus(status: ReplayStatus): void {
    this.state = { ...this.state, status };
    this.options.listener?.onStateChange?.(this.state);
  }
}
