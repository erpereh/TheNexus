# System Architecture

## Runtime overview

```text
┌─────────────────────────────────────────────────────────────┐
│                        Tauri Desktop                        │
│                                                             │
│  React Application                                          │
│  ├─ Nexus / project navigation                              │
│  ├─ HUD / Operations / Settings                             │
│  ├─ Editor UI                                               │
│  └─ World Canvas ────────────────┐                          │
│                                  │                          │
│                              PixiJS                         │
│                          World Engine                       │
│                                  │                          │
│                 normalized world state                     │
│                                  │                          │
│                        Event/State layer                    │
│                                  │                          │
│                   Agent World Bridge/runtime                │
│                 ┌────────┼─────────────┐                    │
│              Adapters  Replay      Simulator                │
└─────────────────┼───────────────────────────────────────────┘
                  │
       authorized external sources
```

## Architectural objective

Provider-specific details stop at the adapter boundary. The world engine consumes semantic state and normalized events only. This is what allows a character to move from ZCode to Codex without changing identity and lets themes alter visual representation without altering provider logic.

## Recommended monorepo

```text
apps/
  desktop/                 # Tauri shell + React application
packages/
  event-schema/            # canonical event/capability/domain schemas
  adapter-sdk/             # adapter interfaces, contracts, helpers
  bridge/                  # adapter lifecycle and local observation runtime
  world-engine/            # PixiJS renderer and isometric runtime
  editor-core/             # ship/editor domain operations and validation
  crew-simulation/         # assignments, idle behavior, progression
  harness-simulator/       # deterministic synthetic harness runtime
  replay-engine/           # recording/replay and version handling
  persistence/             # SQLite repositories, migrations, backup/export
  asset-system/            # manifests, atlases, themes, character packs
  ui/                      # reusable React UI/HUD components
  i18n/                    # locale infrastructure and message catalogs
adapters/
  zcode/
  opencode/
  codex/
  cursor/
  generic/
```

This is a target boundary map rather than a command to create empty packages blindly. Packages should be introduced when real implementation needs them.

## Dependency rules

1. `event-schema` is low-level and must not depend on UI, PixiJS or providers.
2. `adapter-sdk` depends on shared schemas, not on individual provider adapters.
3. Provider adapters depend on `adapter-sdk` and schemas; they do not depend on rendering.
4. `bridge` owns adapter lifecycle and normalized-event ingestion.
5. `world-engine` consumes normalized world state/activity; it must not import provider packages.
6. `crew-simulation` operates on domain entities and semantic activities, not raw provider payloads.
7. `editor-core` manipulates ship data and validation independent of React/Pixi rendering when possible.
8. React UI may compose domain packages but should not become the sole location for business rules.
9. Persistence should expose repositories/services rather than leaking SQL throughout the application.

## World engine modules

Expected internal responsibilities:

```text
WorldEngine
├─ SceneGraph
├─ IsoGrid
├─ CameraSystem
├─ NavigationSystem
├─ SpatialIndex
├─ CharacterController
├─ ActivityPresentationSystem
├─ AnimationSystem
├─ InteractionSystem
├─ Occlusion/SortingSystem
├─ ParticleSystem
├─ ThemeRuntime
└─ EditorRuntime integration
```

Key requirement: simulation/state should remain separable from draw calls so deterministic tests can verify movement/mapping without requiring a GPU-rendered frame.

## Bridge responsibilities

The bridge is the local integration boundary and should own:

- adapter discovery/registration;
- user authorization state;
- adapter start/stop lifecycle;
- source observation;
- normalized event validation;
- event ordering and timestamps;
- optional redaction;
- recording fan-out;
- capability reporting;
- experimental control dispatch only when enabled;
- backpressure and failure isolation.

An adapter crash must not crash the entire desktop app.

## State flow

```text
External signal
  -> Adapter parser
  -> schema validation
  -> normalized event
  -> bridge/event stream
  -> recording persistence
  -> domain reducer/projector
  -> crew assignment + semantic activity
  -> mapping engine
  -> world state
  -> PixiJS render
  -> contextual React HUD
```

Raw provider payloads may be retained only according to user privacy settings. The rest of the app should prefer normalized events.

## Control flow

Control is a separate path from observation:

```text
User explicit action
 -> UI capability check
 -> permission/experimental setting check
 -> adapter control contract
 -> provider-specific dispatch
 -> audit event
```

No world idle behavior, personality system or autonomous local simulation may initiate this path.

## Thread/process concerns

Tauri/native responsibilities should be used for filesystem watching, local process-safe observation, SQLite access strategy and system integrations where appropriate. Expensive parsing or world simulation should not block the UI event loop.

The exact worker/thread model should be selected during implementation after measurement, but architecture must permit:

- background adapter ingestion;
- batched world updates;
- throttled persistence;
- hidden-window render suspension;
- high-volume simulator stress tests.

## Failure isolation

Each subsystem should expose explicit health/state:

- adapter unavailable/degraded;
- bridge backpressure;
- recording persistence failure;
- asset load failure;
- world renderer recovery;
- database migration/recovery state.

Provider unavailability must degrade one integration, not the entire app.

## Versioned contracts

At minimum, version:

- normalized event schema;
- recording format;
- Character Pack manifest;
- theme manifest;
- ship/blueprint export format;
- adapter SDK compatibility level;
- SQLite schema migrations.

Never silently reinterpret old persisted data.
