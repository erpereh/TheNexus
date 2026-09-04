# TheNexus Phase 4b — Visual Vertical Slice Plan

**Date:** 2026-09-04
**Status:** Active implementation plan (Phase 4 core is stable; this completes Tasks 8–9 visually)
**Goal:** First production-oriented visual vertical slice: deterministic simulator
scenario → normalized EventBus → MappingEngine → crew assignment → A*
navigation → WorldSim → animation intent → PixiJS isometric renderer → visible
characters moving inside a small original anime-space-fantasy ship.

**Non-goals (later milestones):** Asset Studio, Ship Editor UI, anime IP packs,
Nexus onboarding/tutorial, Command Center, audio/notifications/tray, E2E/visual
regression suites, real-provider validation.

## 1. Architecture decision (coordinator ruling)

```
@thenexus/simulator → @thenexus/bridge → @thenexus/runtime (NEW)
       (events)          (bus)        │ WorldSession orchestrator + demo ship
                                      ├→ @thenexus/mapping (rules + trace)
                                      ├→ @thenexus/crew-simulation (roster)
                                      ├→ @thenexus/world-engine core (grid/nav/sim/anim)
                                      └→ @thenexus/asset-system (theme skins)
                                                     │
apps/desktop ── WorldCanvas (React) ── mounts ──► render/** (pixi v8)
```

- `packages/world-engine/src/core/**`: unchanged purity (only
  `@thenexus/contracts`; no pixi/DOM/React/provider). Verified 2026-09-04.
- `packages/world-engine/src/render/**`: pixi.js allowed; imports core +
  contracts + asset-system only. Public API is pixi-type-free (plain
  interfaces, `HTMLCanvasElement`) so desktop typechecks without a pixi dep.
- `packages/runtime` (NEW, provider-neutral): `WorldSession` orchestrator +
  deterministic demo ship. Depends on simulator/bridge/mapping/
  crew-simulation/world-engine/asset-system/contracts. This is where
  simulator `agentId` → crew `characterId|guestId` → world character id join
  lives, plus col/row → x/y translation and blocked-destination handling.
- `apps/desktop`: owns React integration (`WorldCanvas`, demo panel),
  camera input (pan/zoom/overview/follow/select), i18n strings. Never
  computes coordinates or mapping directly.

## 2. Locked conventions (renderer must follow)

- Iso constants from core: `TILE_W=64, TILE_H=32, DEPTH_SCALE=4096`,
  layer biases floor0…overlays7, `ZOOM_MIN=0.5, ZOOM_MAX=3`.
- Cell convention: a grid cell `(x,y)` renders centered at
  `gridToScreen(x + 0.5, y + 0.5)`. (Core leaves corner-vs-center to the
  renderer; center is the convention. Documented here, used everywhere.)
- Camera application per frame (exact):
  `world.position.set(-camSX*zoom + vw/2, -camSY*zoom + vh/2)`,
  `world.scale.set(zoom)`, with `(camSX,camSY)=gridToScreen(camera.center)`.
- Depth: every iso entity gets `child.zIndex = depthKeyOf(entry)` inside one
  `sortableChildren` world container; characters use layer `'characters'`
  with `occupiedCells:[cell]`; stations use all footprint cells.
- Movement smoothing is presentation-only (sim stays discrete 10 cells/s):
  renderer lerps displayed grid position toward the snapshot cell with
  exponential smoothing from render dt. Determinism guarantees cover the sim,
  never pixel positions.
- One `AnimationStateMachine` per visible character, fed
  `setFacing(snapshot.facing)`, `setMoving(snapshot.moving)`,
  `setIntent(resolveSlotForIntent(mapping.animationIntent))`.
- Status distinguishable beyond color: error = X-mark + shake; waiting-user =
  pause-bars + still pose; completed = star-burst + hop; talking = speech
  diamonds. Never color-alone.

## 3. Files and interfaces

### 3.1 `packages/world-engine` — render layer (pixi.js ^8.18.0 dep)

- `src/render/layers.ts` — `createWorldLayers(): { background, world, hud }`
  (10 logical layers; `world.sortableChildren = true`). Background/hud are
  screen-space; world is iso-space.
- `src/render/ship-view.ts` — types the renderer consumes (pixi-free):
  `ShipRoomView { roomInstanceId, roomType: string, rect: GridRect,
  tint: number }`, `ShipStationView { stationInstanceId, stationType: string,
  roomInstanceId, footprint: Cell[], anchor: Cell }`,
  `ShipLayoutView { rooms, stations, gridWidth, gridHeight, bounds: GridRect }`,
  `CharacterPresentation { id, label, activity: SemanticActivity,
  statusDisplay, effectIntent: string | null }`.
- `src/render/world-renderer.ts` — `class WorldRenderer`:
  `static async create(canvas: HTMLCanvasElement, opts: RendererOptions):
  Promise<WorldRenderer>` (`RendererOptions { theme: ThemeManifest,
  onSelect?: (id: string | null) => void }`);
  `setLayout(layout: ShipLayoutView): void`;
  `setFrame(snapshot: WorldSnapshot, presentation: Map<string,
  CharacterPresentation>, camera: CameraView, viewport: Viewport): void`;
  `frame(dtMs: number): void` (advance sim-owned SMs, smooth positions,
  refresh z-order, pump perf);
  `resize(viewport: Viewport): void`;
  `setRunning(running: boolean): void` (ticker stop/start; hidden-window gate);
  `perfSnapshot(): { fps, frameP50Ms, frameP95Ms, drawCalls? }`;
  `destroy(): void` (ticker stop, listeners removed, `app.destroy()`,
  canvas left in DOM for React unmount; StrictMode double-mount safe).
- `src/render/room-graphics.ts` — procedural iso floor diamond + rune border
  + room glyph per `roomType`, tinted from `ThemeRuntime` palette tokens.
- `src/render/station-graphics.ts` — per-`stationType` procedural console
  shapes (holo projector, console, workbench, test bench, scope, desk, seat,
  terminal) with crystal/hologram motifs.
- `src/render/character-graphics.ts` — original robed-silhouette character
  (hood + sash + crystal), status ornaments (X / bars / star / diamonds),
  per-slot motion (bob/sway/pulse/hop/shake/hop-burst), horizontal mirror via
  `scale.x = mirrored ? -1 : 1`, character pooling by id.
- `src/render/background.ts` — static starfield + constellation lines +
  nebula wash from theme tokens; `cullableChildren = false`.
- `src/render/culling.ts` — `extensions.add(CullerPlugin)` once; mark room/
  station/character containers `cullable = true`; static layer
  `cullableChildren = false`.
- `src/index.ts` — deliberate barrel: core modules (iso, grid, character,
  depth-sort, events, navigation, camera, world-sim, animation-state,
  activity-map, spatial-index, perf) + render (`WorldRenderer`,
  `ShipLayoutView` etc. types). `package.json` gains `"./render"` subpath?
  NO — single `.` export keeps imports simple; node tests never touch
  `render/**` (no `*.test.ts` there; compile-checked via typecheck +
  smoke-tested in desktop).
- Deps: `pixi.js@^8.18.0` (runtime dep of world-engine only).

### 3.2 `packages/runtime` (NEW package)

`package.json` deps: contracts, simulator, bridge, mapping, crew-simulation,
world-engine, asset-system. Scripts: lint/typecheck/test (mirror `mapping`).

- `src/demo-ship.ts` — `buildDemoShip(): DemoShip` where
  `DemoShip { grid: TileGrid(blocked walls/voids), rooms: ShipRoomView[8],
  stations: ShipStationView[], layout: MappingShipLayout,
  shipView: ShipLayoutView, bounds: GridRect, spawnCells: Cell[] }`.
  Deterministic, no RNG. 8 rooms covering every `DEFAULT_MAPPING_RULES`
  room type: command, engineering, laboratory, library, observatory,
  communications, archive, lounge; each with its rule stations
  (planning_holo, core_console, coding_workstation, test_bench,
  reading_desk, research_scope, comm_console, archive_terminal,
  lounge_seat) + ≥1 `generic_workstation` fallback station. Grid ≈ 40×28
  with wall-bounded rooms, door gaps, walkable corridors; every station has
  ≥1 walkable approach cell (asserted in tests).
- `src/world-session.ts` — `class WorldSession`:
  `constructor(opts { seed, workspaceId, roster: CrewCharacter[], rules? })`;
  `start(preset: ScenarioPresetName | SimulatorScenarioOptions): void`
  (generate scenario → fresh bus+sim: spawn one world character per agent id
  at deterministic free `spawnCells`; subscribe pipeline);
  `advance(dtMs: number): void` (drain event queue in `occurredAt` order →
  per event: mapping resolve at character cell → `findPathToTarget` from
  character cell → `assignPath` (on NO_APPROACH/UNREACHABLE: route to nearest
  `generic_workstation`, else hold position) → `sim.advance(dtMs)`;
  completed/error terminals release the crew assignment (lifecycle policy);
  `snapshot(): SessionSnapshot` (`{ tick, world: WorldSnapshot,
  presentation: Map<...>, cameraState, trace per selected agent,
  counts }`);
  `reset(): void` (clear bus listeners, new WorldSim/grid state, roster
  restore, tick 0 — byte-identical repeat runs);
  `dispose(): void` (unsubscribe all; repeated runs accumulate zero
  listeners — asserted in tests).
  World character id = `char_<agentId>`-derived stable mapping
  (`agent_0001` → world `w_agent_0001`); crew `characterId|guestId` stored
  alongside for the HUD. Subagents are separate world characters even when
  sharing `sessionId`.
- `src/index.ts` — barrel (`WorldSession`, `buildDemoShip`, view types).

### 3.3 `apps/desktop` — demo surface

- `src/world/WorldCanvas.tsx` — mounts `canvas` ref → `WorldRenderer.create`
  (async, cancellation-safe) → per-frame: `session.advance(dt)` (capped
  dt ≤ 250ms) + camera follow/controls → `renderer.setFrame(...)` +
  `renderer.frame(dt)`; ResizeObserver → `renderer.resize`; exposes
  `onSelect` → selection state; `destroy()` on unmount. No coordinate math.
- `src/world/WorldPanel.tsx` — world-dominant layout: canvas + side panel
  (Start [preset select: nested-subagents/10/50/100], Reset, pan/zoom/
  overview/follow controls, character list w/ activity, mapping trace
  `event → activity → rule → room → station → animation`, perf HUD).
  Reuses `I18nProvider`; adds `world.*` keys to `packages/i18n` en/es.
- `App.tsx` — render `WorldPanel` (keep `SimulatorPanel` importable; existing
  tests untouched).
- Deps: add `@thenexus/world-engine`, `@thenexus/runtime`,
  `@thenexus/mapping`, `@thenexus/crew-simulation`, `@thenexus/asset-system`
  (no pixi.js direct dep).

## 4. Tests (all simulator/mock/fixture based; no providers)

- `packages/runtime/src/demo-ship.test.ts` — 8 rooms cover all rule room
  types; every rule station type exists; every station has a walkable approach
  cell; corridors connect all rooms (pairwise reachability from spawns);
  byte-identical rebuilds.
- `packages/runtime/src/world-session.test.ts` — deterministic repeat (two
  runs same seed → identical snapshots/traces); coding→engineering/
  coding_workstation; testing→laboratory/test_bench;
  researching→observatory/research_scope; missing preferred station →
  generic_workstation fallback; no-crew → Guest assignment; parent/subagent
  separate world characters; blocked destination holds position without
  crossing blocked cells (assert every snapshot cell walkable); reset →
  tick 0 + identical re-run; dispose + repeated start returns listener count
  to baseline (no accumulation).
- world-engine: no new node tests for `render/**` (Phase 4 plan Task 8 rule);
  existing 78 core tests untouched unless a defect is demonstrated.
- desktop: keep 5 existing tests green; new component tests only for
  non-pixi logic (trace formatting); canvas smoke-tested by live run.

## 5. Visual verification protocol (Phase I, real Tauri window)

Start deterministic `nested-subagents` + `agents-10/50/100` (+250 stress
attempt): initial world, resize/small/normal window, zoom 0.5–3, pan,
overview, follow, depth overlap, station approaches, activity transitions,
reset/restart, EN+ES, FPS + frame p50/p95 from `perfSnapshot()` (record real
numbers only, never estimate).

## 6. Commit boundaries

1. `feat(world-engine): add pixi render layer + public exports`
   (3.1; typecheck/lint/test gates).
2. `feat(runtime): deterministic demo ship + world session orchestrator`
   (3.2 + its tests; package gates).
3. `feat(desktop): world canvas demo surface` (3.3 + i18n keys).
4. `test: visual vertical slice verification + perf evidence` (fresh gate
   output + progress/acceptance updates).
5. Review fixes (Phase J) as separate commits.

## 7. Open risks

- pixi.js v8 `Application.init` is async + `app.canvas` replaces `view`
  (verified against v8 migration docs 2026-09-04); pin `^8.18.0`, adjust if
  pnpm resolves otherwise.
- 250-agent stress is a graceful-degradation target, not a 60 FPS guarantee.
- `MappingShipLayout` uses `{col,row}`; runtime translates to `Cell{x,y}` at
  the boundary (col→x, row→y); mapping package itself is untouched.
- contracts `AssignmentSchema` vs crew-simulation `CrewAssignment` divergence
  (found by research) is OUT of scope: the slice never persists assignments.
