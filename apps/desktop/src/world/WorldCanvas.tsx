import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { WorldRenderer } from '@thenexus/world-engine/render';
import type { WorldSession } from '@thenexus/runtime';

interface WorldCanvasProps {
  session: WorldSession;
  selectedId: string | null;
  onSelect: (worldId: string | null) => void;
  /** Shared handle so the panel can poll perf without re-rendering the canvas. */
  rendererRef: MutableRefObject<WorldRenderer | null>;
  /** Localized room labels applied to the baked floor pills. */
  roomLabels: Readonly<Record<string, { title: string; subtitle: string }>>;
}

function viewportOf(canvas: HTMLCanvasElement): { width: number; height: number } {
  return {
    width: Math.max(1, Math.floor(canvas.clientWidth)),
    height: Math.max(1, Math.floor(canvas.clientHeight)),
  };
}

/**
 * Pixi's `renderer.resize()` stamps explicit `style.width/height` on the
 * canvas, which would freeze it at the old size and leave void bands after
 * a window resize. The canvas must stay CSS-driven (`inset: 0` of the
 * stage), so every renderer resize is followed by restoring fluid styles.
 */
function resizeRenderer(
  renderer: WorldRenderer | null,
  canvas: HTMLCanvasElement,
  last: { width: number; height: number },
): { width: number; height: number } {
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  const size = viewportOf(canvas);
  // No-op on identical sizes: Pixi restamps inline styles on every call,
  // which would otherwise ping-pong the ResizeObserver forever.
  if (size.width !== last.width || size.height !== last.height) {
    last.width = size.width;
    last.height = size.height;
    renderer?.resize(size);
  }
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  return size;
}

/**
 * PixiJS world viewport. Owns the `WorldRenderer` lifecycle (async create,
 * ResizeObserver resizing, StrictMode-safe destroy) and all pointer input:
 * drag to pan, wheel to zoom, click (without drag) to select a character.
 * Simulation stepping happens in the renderer's tick via `onTick`; React
 * state is never updated at frame rate.
 */
export function WorldCanvas({
  session,
  selectedId,
  onSelect,
  rendererRef,
  roomLabels,
}: WorldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef(session);
  const selectRef = useRef(onSelect);
  const labelsRef = useRef(roomLabels);
  const [error, setError] = useState<string | null>(null);

  // The renderer lifecycle is mount-only; props flow in through refs.
  useEffect(() => {
    sessionRef.current = session;
    selectRef.current = onSelect;
    labelsRef.current = roomLabels;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    let cancelled = false;
    let renderer: WorldRenderer | null = null;
    const lastResize = { width: 0, height: 0 };
    WorldRenderer.create(canvas, {
      theme: sessionRef.current.theme,
      onTick: (dtMs: number) => {
        const live = sessionRef.current;
        live.advance(dtMs);
        // History excluded: the render path needs world + presentation only,
        // and history would be cloned pointlessly at 60Hz.
        const snap = live.snapshot({ history: false });
        const size = renderer?.frameViewport() ?? viewportOf(canvas);
        renderer?.setFrame(snap.world, snap.presentation, live.camera.view(), size);
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
        created.setRoomLabels(labelsRef.current);
        // Initial fit: the session constructor framed for a placeholder
        // viewport, so fit once to the real stage (never on resize, which
        // must preserve the user's pan/zoom).
        sessionRef.current.frameShip(viewportOf(canvas));
        resizeRenderer(created, canvas, { width: 0, height: 0 });
      })
      .catch((unknownError: unknown) => {
        if (!cancelled) {
          setError(unknownError instanceof Error ? unknownError.message : String(unknownError));
        }
      });
    const handleWindowResize = (): void => {
      if (renderer !== null) resizeRenderer(renderer, canvas, lastResize);
    };
    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            if (renderer !== null) resizeRenderer(renderer, canvas, lastResize);
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
    rendererRef.current?.setRoomLabels(roomLabels);
  }, [rendererRef, roomLabels]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    let dragging = false;
    let dragDx = 0;
    let dragDy = 0;
    let lastX = 0;
    let lastY = 0;
    // Cached canvas size: `clientWidth` forces layout, so it is read on
    // resize/pointer events only — never in the 60Hz tick (the renderer
    // owns its own cached copy via `resize()`).
    let cachedViewport = viewportOf(canvas);
    const viewport = (): { width: number; height: number } => ({ ...cachedViewport });
    const refreshViewport = (): void => {
      cachedViewport = viewportOf(canvas);
    };

    const onPointerDown = (event: PointerEvent): void => {
      dragging = true;
      dragDx = 0;
      dragDy = 0;
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
      dragDx += dx;
      dragDy += dy;
      // Cumulative 4px threshold: jitter must not kill click selection.
      if (Math.abs(dragDx) + Math.abs(dragDy) >= 4) {
        refreshViewport();
        sessionRef.current.panBy(dx, dy, viewport());
      }
    };
    const endDrag = (event: PointerEvent): void => {
      if (!dragging) return;
      dragging = false;
      if (Math.abs(dragDx) + Math.abs(dragDy) < 4) {
        const rect = canvas.getBoundingClientRect();
        const picked = rendererRef.current?.pick(
          event.clientX - rect.left,
          event.clientY - rect.top,
        );
        selectRef.current(picked ?? null);
        rendererRef.current?.setSelected(picked ?? null);
      }
      dragDx = 0;
      dragDy = 0;
    };
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      refreshViewport();
      const rect = canvas.getBoundingClientRect();
      const live = sessionRef.current;
      const zoom = live.camera.zoom * (event.deltaY < 0 ? 1.15 : 1 / 1.15);
      live.zoomAt({ x: event.clientX - rect.left, y: event.clientY - rect.top }, zoom, viewport());
    };
    const onResize = (): void => refreshViewport();
    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onResize);
    resizeObserver?.observe(canvas);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      resizeObserver?.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', endDrag);
      canvas.removeEventListener('pointercancel', endDrag);
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
