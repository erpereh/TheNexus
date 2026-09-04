# TheNexus Phase 4 — World Engine Foundation Plan

**Goal:** A deterministic 2.5D isometric world engine with a headless simulation core (unit-testable in Node, no WebGL) and a thin PixiJS render layer: iso projection, depth sorting, A* navigation, camera, character controller, animation state machine, spatial index, performance instrumentation, and fixed-step world simulation.

**Architecture:** `packages/world-engine` splits into `src/core/**` (imports ONLY `@thenexus/contracts`; no pixi, no DOM) and `src/render/**` (imports core + pixi.js; no provider/bridge imports). Desktop mounts the renderer and feeds it `WorldSim` snapshots. Research basis: docs/game/01-world-and-nexus.md layer model, spec §7/§8/§26, arch/01 determinism requirement, acceptance §E.

**Tech Stack:** TypeScript strict, pixi.js ^8 (render layer only), Vitest 5 node environment for core tests.

## Locked constants and formulas

- ISO: `TILE_W=64, TILE_H=32, HALF_W=32, HALF_H=16, DEPTH_SCALE=4096`.
- `gridToScreen`: `sx=(x-y)*HALF_W; sy=(x+y)*HALF_H`. Inverse: `gx=(sx/HALF_W+sy/HALF_H)/2; gy=(sy/HALF_H-sx/HALF_W)/2`.
- `worldToScreen(p, camera, viewport) = ((sx-camSX)*zoom + vw/2, (sy-camSY)*zoom + vh/2)` with `camSX/Y = gridToScreen(camera.center)`.
- Depth key: `depth = (pos.x+pos.y)*DEPTH_SCALE + layerBias + elevation*64` with layerBias floor0/decals1/walls2/low-props3/characters4/stations5/foreground6/overlays7; props use far-corner `max(x+y)` over occupied cells; ties break by `id` ascending (stable).
- A*: 8-directional, no corner cutting (diagonal requires both orthogonal neighbors walkable); costs straight 1000 / diagonal 1414 (integers); octile heuristic; heap keyed `(f, h, insertionCounter)`; fixed neighbor order N,NE,E,SE,S,SW,W,NW.
- Camera: zoom clamp [0.5, 3]; follow smoothing `center += (target-center)*(1-exp(-8*dt))`; zoomAt keeps cursor world point fixed; frameCells fits bbox and centers; ship can never fully leave viewport.

## Tasks

### Task 1: Iso math + depth sort (`core/iso.ts`, `core/depth-sort.ts`) — tests first per test list below.
### Task 2: Grid + spatial index (`core/grid.ts`, `core/spatial-index.ts`).
### Task 3: Navigation (`core/navigation.ts`) — A* with approach-cell goal sets, diagnostics `OK | UNREACHABLE_TARGET | NO_APPROACH_CELL | OUT_OF_BOUNDS`, revalidation.
### Task 4: Camera (`core/camera.ts`).
### Task 5: Character controller + world sim (`core/character.ts`, `core/world-sim.ts`, `core/events.ts`) — fixed 100ms tick accumulator; cell claiming for simple deadlock avoidance; deterministic event log.
### Task 6: Animation state (`core/animation-state.ts`, `core/activity-map.ts`) — ACTIVITY_TO_SLOT table covering EVERY SemanticActivity: idle/waiting-user→idle, planning→planning, reading/researching→researching, coding/reviewing/version-control/building→coding, testing→testing, communicating/delegating/spawning-subagent→talking, error→error, completed→celebrating. `resolveAnimation` fallback chain: missing direction → fallback.direction (mirrored) → idle → walk; frame index `floor(timeMs/1000*fps) % frameCount` when loop else `min(...,frameCount-1)`.
### Task 7: Perf instrumentation (`core/perf.ts`) — ring buffer, p50/p95, marks.
### Task 8: Render layer (`render/**`) — pixi.js Application, 10 ordered layers, pooled sprites, culling, hidden-window gate, perf HUD; compile-checked and smoke-tested in the desktop app (no node tests).
### Task 9: Review gate + integration into desktop dev surface + evidence.

## Test list (node vitest, `src/*.test.ts`)

iso: origin maps to (0,0); 2:1 ratio; worldToGrid inverts gridToScreen over 32x32; screenToWorld inverts at zoom 1 and 2.
depth-sort: character south of prop draws in front; character north of wall behind; stable equal keys; id tie-break; elevation raises prop.
navigation: routes around blocked station cells; no corner cutting; cheapest approach cell selected; UNREACHABLE_TARGET diagnostic; byte-identical paths for repeated runs; revalidation drops paths entering newly blocked cells.
camera: zoomAt anchors cursor point; pan cannot push ship fully off-screen; zoom clamped; follow frame-rate independent; frameCells fits room bbox.
character/sim: path following never enters blocked cells; facing from dominant velocity axis (4 directions); arrival emits arrived; identical tick sequence → identical event log.
animation: slot table covers every SemanticActivity; unknown intent → idle/walk; fallback chain mirrored→idle→walk; fps advance/wrap rules.
perf: p50/p95 over synthetic frames; spatial index rect query.

## Ownership

- Implementation agent owns `packages/world-engine/**` exclusively (core first, then render).
- Coordinator integrates desktop dev surface + commits.
