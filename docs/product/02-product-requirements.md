# Product Requirements

## Scope

This document turns the approved design into explicit product requirements. Requirement IDs are stable references for implementation plans and tests.

## Core application

- **PR-001** — The application must run as a Windows-first Tauri desktop app with React + TypeScript UI.
- **PR-002** — The application must remain architecturally portable to macOS/Linux without making those platforms v1 QA targets.
- **PR-003** — The application must work fully offline for all local features.
- **PR-004** — The app must support optional background/tray operation while suspending unnecessary world rendering when hidden.
- **PR-005** — Launch-at-startup must exist but be disabled by default.

## Nexus and onboarding

- **PR-010** — The Nexus must be a permanent central station, not a disposable tutorial scene.
- **PR-011** — First launch must provide a playable in-world tutorial.
- **PR-012** — The tutorial must run entirely against the Harness Simulator and require no provider account.
- **PR-013** — The tutorial must be skippable and replayable.
- **PR-014** — The Nexus must expose project access, crew, harnesses, achievements/statistics and settings.

## Workspaces and ships

- **PR-020** — A workspace may contain one or more authorized folders/repositories.
- **PR-021** — Each workspace maps to one editable ship/station.
- **PR-022** — The user must be able to create, rename, import/export and delete workspace worlds without deleting source code.
- **PR-023** — The app must never assume it owns or may modify project source files merely because a workspace is linked.

## World and camera

- **PR-030** — The world must use a continuous 2.5D isometric PixiJS scene.
- **PR-031** — Camera orientation is fixed in v1.
- **PR-032** — Pan, smooth zoom, agent follow and room-detail zoom are required.
- **PR-033** — Required modes: Normal, Focus Agent, Overview, Cinematic, Operations and Edit.
- **PR-034** — World state must remain synchronized across mode changes.

## Crew

- **PR-040** — Crew characters are persistent entities independent of harness/model/session/task.
- **PR-041** — Assignment may be manual or automatic.
- **PR-042** — Automatic assignment should consider availability, project, specialty and preferences.
- **PR-043** — If no crew member is available, the system may create a Guest Agent representation.
- **PR-044** — Guest Agents may be converted into persistent crew.
- **PR-045** — Personality simulation must be local/deterministic and must never influence actual provider-agent execution.
- **PR-046** — Progression must remain cosmetic/statistical and must not gate professional functionality.

## Activity mapping

- **PR-050** — Provider-specific observations must normalize into a shared event schema before world mapping.
- **PR-051** — Default semantic activity mappings must ship with the product.
- **PR-052** — Users must be able to edit mapping rules.
- **PR-053** — Missing target rooms/stations must resolve through deterministic fallbacks.
- **PR-054** — The Mapping Debugger must expose the complete event-to-animation decision chain.

## Editor

- **PR-060** — The editor must support intelligent room modules plus deep interior customization.
- **PR-061** — An Empty Module must support near-freeform room creation.
- **PR-062** — Placement must support isometric snap plus limited free offsets for decoration.
- **PR-063** — Editor validation must preserve navigation/station reachability or clearly report conflicts.
- **PR-064** — Users must be able to save/import/export reusable blueprints.
- **PR-065** — Autosave and crash recovery must protect editor work.

## Character packs and assets

- **PR-070** — Character Packs must be data-driven and importable without source-code changes.
- **PR-071** — Baseline movement uses four isometric directions: NE/NW/SE/SW.
- **PR-072** — Baseline animation set must cover idle, walk, coding, research, testing, planning, talking, sitting/rest, celebration and error.
- **PR-073** — Asset Studio must support sprite-sheet import, slicing, preview, anchor/offset, FPS and in-world simulator testing.
- **PR-074** — Official distributable builds must use original or correctly licensed assets.
- **PR-075** — Third-party anime development packs must remain isolated and removable from distributable builds.

## Harnesses

- **PR-080** — Initial adapter targets: ZCode, OpenCode, Codex, Cursor and Generic Adapter.
- **PR-081** — Every adapter must declare explicit capabilities.
- **PR-082** — The UI must never fabricate unsupported capability/data.
- **PR-083** — Observation is passive-first and scoped to user-authorized sources.
- **PR-084** — Control is disabled by default and may exist only as explicit experimental opt-in.
- **PR-085** — Autonomous tests must never execute real providers/models.
- **PR-086** — Harness behavior must be testable through mocks, fixtures, simulator and replay.

## Simulator and replay

- **PR-090** — Harness Simulator must support realistic sessions, parent/subagents, errors, waits, completions and malformed events.
- **PR-091** — Simulator scale profiles must include 10/50/100/250 agents.
- **PR-092** — Normalized sessions must be recordable and replayable.
- **PR-093** — Replay must support pause, stepping and 1x/2x/5x/10x/50x speeds.
- **PR-094** — Replay must be deterministic for the same recording/schema version.

## Storage, privacy and history

- **PR-100** — Structured data uses SQLite; large assets/recordings may use the filesystem.
- **PR-101** — Schema/version migrations must be explicit and tested.
- **PR-102** — Whole-PC scanning is forbidden by default.
- **PR-103** — Users explicitly authorize project/data sources.
- **PR-104** — Raw prompts, terminal output and file contents are opt-in data surfaces.
- **PR-105** — Secret-like values should be redacted before persistence/display where feasible.
- **PR-106** — Raw/heavy retention must be configurable; important sessions can be pinned.
- **PR-107** — No v1 cloud upload dependency is permitted.

## UI, audio, notifications and language

- **PR-110** — The world is primary; operational HUD is contextual.
- **PR-111** — A command palette must support fast navigation and common actions.
- **PR-112** — Audio must be optional with independent volume categories.
- **PR-113** — Desktop notifications must be configurable with restrained defaults.
- **PR-114** — English and Spanish ship in v1 through a real i18n layer.
- **PR-115** — Core flows must support keyboard navigation and accessible semantics in React UI.

## Distribution

- **PR-120** — Produce a Windows installer.
- **PR-121** — Produce a portable Windows build.
- **PR-122** — CI/release automation should generate artifacts without automatically publishing releases unless configured.
- **PR-123** — Auto-update architecture may be prepared, but a mandatory auto-updater is not required in v1.

## Quality gates

- **PR-130** — Normal target: stable 60 FPS on the supported Windows baseline for typical ships.
- **PR-131** — 100-agent simulator scenarios must remain usable and correct.
- **PR-132** — 250-agent stress tests must degrade gracefully and expose measured bottlenecks.
- **PR-133** — Automated tests must cover unit, contract, integration, E2E, replay, migration, import/export and visual regressions.
- **PR-134** — Finished user-facing flows require explicit visual inspection at relevant zoom, DPI and resolution combinations.
- **PR-135** — No completion claim may rely only on compilation or an agent's own success report.
