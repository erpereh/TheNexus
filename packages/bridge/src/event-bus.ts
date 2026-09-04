import { isNormalizedEvent, type NormalizedEvent } from '@thenexus/contracts';

export type EventListener = (event: NormalizedEvent) => void;

export interface EventBusOptions {
  /**
   * Sink for listener failures. Defaults to a no-op; hosts (desktop shell,
   * tests) inject a logger so one broken subscriber never crashes the bus.
   */
  onListenerError?: (error: unknown, event: NormalizedEvent) => void;
}

export interface EventBus {
  /** Publish one normalized event to all current subscribers. */
  publish(event: NormalizedEvent): void;
  /** Subscribe to the stream; returns an idempotent unsubscribe function. */
  subscribe(listener: EventListener): () => void;
  /** Detach every subscriber. The bus stays usable afterwards. */
  clear(): void;
}

/**
 * In-process synchronous normalized event bus.
 *
 * Boundary rule: everything published must be a valid NormalizedEvent —
 * invalid input is rejected at the boundary (throw) before any listener
 * runs, so downstream consumers can trust the stream.
 *
 * Listener-error rule (recorded ruling): a throwing listener is contained;
 * the error is routed to the injected sink and remaining listeners still
 * receive the event. One broken subscriber must never silence others.
 */
export function createEventBus(options: EventBusOptions = {}): EventBus {
  const listeners = new Set<EventListener>();
  const { onListenerError } = options;

  const describe = (value: unknown): string => {
    try {
      return JSON.stringify(value)?.slice(0, 200) ?? String(value);
    } catch {
      // Circular/BigInt inputs must not mask the boundary error itself.
      return String(value);
    }
  };

  return {
    publish(event: NormalizedEvent): void {
      if (!isNormalizedEvent(event)) {
        throw new Error(`Invalid normalized event rejected at bus boundary: ${describe(event)}`);
      }
      for (const listener of [...listeners]) {
        try {
          listener(event);
        } catch (error: unknown) {
          if (onListenerError) {
            onListenerError(error, event);
          }
        }
      }
    },
    subscribe(listener: EventListener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    clear(): void {
      listeners.clear();
    },
  };
}
