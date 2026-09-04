import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { WorldRenderer } from '@thenexus/world-engine';
import type { WorldSession } from '@thenexus/runtime';

interface WorldCanvasProps {
  session: WorldSession;
  selectedId: string | null;
  onSelect: (worldId: string | null) => void;
  /** Shared handle so the panel can poll perf without re-rendering the canvas. */
  rendererRef: MutableRefObject<WorldRenderer | null>;
}

function viewportOf(canvas: HTMLCanvasElement): { width: number; height: number } {
  return {
    width: Math.max(1, Math.floor(canvas.clientWidth)),
    height: Math.max(1, Math.floor(canvas.clientHeight)),
  };
}

/**
 * PixiJS world viewport. Owns the `WorldRenderer` lifecycle (async create,
 * ResizeObserver resizing, StrictMode-safe destroy) and all pointer input:
 * drag to pan, wheel to zoom, click (without drag) to select a character.
 * Simulation stepping happens in the renderer's tick via `onTick`; React
 * state is never updated at frame rate.
 */
export function WorldCanvas({ session, selectedId, onSelect, rendererRef }: WorldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef(session);
  const selectRef = useRef(onSelect);
  const [error, setError] = useState<string | null>(null);

  // The renderer lifecycle is mount-only; props flow in through refs.
  useEffect(() => {
    sessionRef.current = session;
    selectRef.current = onSelect;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    let cancelled = false;
    let renderer: WorldRenderer | null = null;
    WorldRenderer.create(canvas, {
      theme: sessionRef.current.theme,
      onTick: (dtMs: number) => {
        const live = sessionRef.current;
        live.advance(dtMs);
        const snap = live.snapshot();
        renderer?.setFrame(snap.world, snap.presentation, live.camera.view(), viewportOf(canvas));
      },
    })
      .then((created) => {
        if (cancelled) {
          created.destroy();
          return;
        }
        renderer = created;
        rendererRef.current = created;
        created.setLayout(sessionRef.current.ship.shipView);
        created.resize(viewportOf(canvas));
      })
      .catch((unknownError: unknown) => {
        if (!cancelled) {
          setError(unknownError instanceof Error ? unknownError.message : String(unknownError));
        }
      });
    const handleWindowResize = (): void => {
      if (renderer !== null) renderer.resize(viewportOf(canvas));
    };
    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            if (renderer !== null) renderer.resize(viewportOf(canvas));
          });
    if (resizeObserver !== null) {
      resizeObserver.observe(canvas);
    } else {
      // jsdom/test fallback: window resize only.
      window.addEventListener('resize', handleWindowResize);
    }
    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      renderer?.destroy();
      renderer = null;
      rendererRef.current = null;
    };
    // Mount-only: session/select flow through refs to avoid renderer churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    rendererRef.current?.setSelected(selectedId);
  }, [rendererRef, selectedId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    let dragging = false;
    let moved = false;
    let lastX = 0;
    let lastY = 0;
    const viewport = (): { width: number; height: number } => viewportOf(canvas);

    const onPointerDown = (event: PointerEvent): void => {
      dragging = true;
      moved = false;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent): void => {
      if (!dragging) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      if (Math.abs(dx) + Math.abs(dy) > 0) moved = true;
      if (moved) sessionRef.current.panBy(dx, dy, viewport());
    };
    const onPointerUp = (event: PointerEvent): void => {
      if (!dragging) return;
      dragging = false;
      if (!moved) {
        const rect = canvas.getBoundingClientRect();
        const picked = rendererRef.current?.pick(
          event.clientX - rect.left,
          event.clientY - rect.top,
        );
        selectRef.current(picked ?? null);
        rendererRef.current?.setSelected(picked ?? null);
      }
    };
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const live = sessionRef.current;
      const zoom = live.camera.zoom * (event.deltaY < 0 ? 1.15 : 1 / 1.15);
      live.zoomAt({ x: event.clientX - rect.left, y: event.clientY - rect.top }, zoom, viewport());
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [rendererRef]);

  if (error !== null) {
    return (
      <div role="alert" data-testid="world-error">
        {error}
      </div>
    );
  }
  return (
    <canvas
      ref={canvasRef}
      data-testid="world-canvas"
      className="world-canvas"
      aria-label="Nexus world"
    />
  );
}
