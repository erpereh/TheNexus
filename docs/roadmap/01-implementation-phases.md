# Implementation Phases

This document defines the recommended build order. It is not yet the task-by-task implementation plan; that will be written after the design spec is reviewed.

The order intentionally front-loads contracts, simulator and persistence so later visual work does not depend on unstable provider integrations.

## Phase 0 — Repository and engineering foundation

Goals:

- monorepo/tooling foundation;
- Tauri + React + TypeScript app shell;
- package boundaries;
- lint/typecheck/test/build scripts;
- CI baseline;
- logging/error conventions;
- i18n skeleton;
- documentation/ADR conventions.

Exit criteria:

- desktop shell launches;
- package graph is explicit;
- local checks run reliably;
- no provider integration is required.

## Phase 1 — Core domain contracts

Build:

- normalized event schema;
- capability model;
- workspace/ship/crew IDs and domain types;
- mapping rule contract;
- Character Pack/theme/blueprint manifest versions;
- recording envelope/version contract.

Exit criteria:

- schemas have tests;
- versioning strategy exists;
- downstream packages can depend on stable contracts.

## Phase 2 — Harness Simulator + Bridge skeleton

Build before real adapters:

- deterministic Harness Simulator;
- bridge lifecycle/event bus;
- synthetic sessions/subagents/tasks;
- error/wait/reconnect scenarios;
- 10/50/100/250-agent scenarios;
- recording tap.

Exit criteria:

- app can receive realistic normalized activity without any external harness;
- simulator seeds/scenarios are reproducible;
- no real AI provider is invoked.

## Phase 3 — Persistence and replay

Build:

- SQLite schema/repositories;
- migrations;
- settings;
- workspace/crew/mapping persistence;
- recording format/storage;
- replay controls and deterministic projection;
- backup/export foundations;
- retention policies.

Exit criteria:

- simulator sessions survive restart;
- replay reaches the same logical outcome;
- migration/import failure paths are tested.

## Phase 4 — World Engine foundation

Build:

- PixiJS integration;
- isometric projection/grid;
- camera pan/zoom/follow;
- scene graph/layers;
- sprite animation runtime;
- navigation/pathfinding;
- sorting/occlusion;
- station interaction points;
- performance instrumentation.

Exit criteria:

- simulator-driven agents can navigate a test ship;
- z-order/occlusion are visually verified;
- stress scenes are measurable.

## Phase 5 — Activity mapping + crew assignments

Build:

- semantic activity projector;
- default mappings;
- fallback resolution;
- crew persistence/assignment;
- Guest Agents;
- activity-driven navigation/animation;
- Mapping Debugger.

Exit criteria:

- a simulated task visibly moves a persistent character through meaningful work phases;
- mapping reasoning is inspectable and testable.

## Phase 6 — The Nexus and onboarding

Build a polished vertical slice:

- finished Nexus layout;
- Project Core;
- Crew Hall;
- Communications;
- simulator-driven tutorial NPC sequence;
- demo workspace;
- selected-agent HUD/timeline;
- tutorial skip/replay.

Exit criteria:

- a new user can understand the product without a provider;
- first-run flow is E2E-tested and visually inspected.

## Phase 7 — HUD and professional operations

Build:

- Normal/Focus/Overview/Cinematic/Operations modes;
- tasks/crew/timeline panels;
- command palette;
- adapter/capability status UI;
- errors/needs-input queue;
- replay UI;
- notifications/audio controls.

Exit criteria:

- dense simulated multi-agent work remains understandable;
- critical operational information is accessible outside the PixiJS canvas.

## Phase 8 — Ship editor

Build:

- module topology;
- smart room placement;
- interior prop/station editing;
- grid/free-offset behavior;
- validation/navigation rebuild;
- undo/redo;
- autosave/recovery;
- blueprint save/import/export;
- Empty Module.

Exit criteria:

- a user can build/modify a valid project ship and watch simulated agents navigate it after reload.

## Phase 9 — Themes, Character Packs and Asset Studio

Build:

- asset registry/manifests;
- default anime space-fantasy theme;
- official original characters;
- Character Pack import/export;
- Asset Studio;
- contact-sheet/validation tooling;
- theme switching;
- asset provenance tracking;
- isolated development-only anime reference packs if assets are locally created/provided.

Exit criteria:

- public/distributable build works with no third-party IP pack;
- user character import works without source-code changes.

## Phase 10 — Adapter implementations

Implement ZCode, OpenCode, Codex, Cursor and Generic Adapter against the shared SDK.

Rules:

- documentation/public source research is allowed;
- fixtures/mocks/simulator only for autonomous testing;
- no real model tasks;
- no provider credentials;
- capability-safe degraded states;
- manual real-provider validation checklists only.

Exit criteria:

- each adapter passes shared contract tests;
- unsupported capabilities are represented accurately;
- no automated test consumes provider quota.

## Phase 11 — Experimental Command Center architecture

Build/finish:

- control capability interfaces;
- disabled-by-default settings;
- command-center UI;
- audit events;
- mock control dispatch tests.

Do not autonomously activate or test against real providers.

Exit criteria:

- simulated adapters can demonstrate control flows;
- real control remains clearly opt-in and untested automatically.

## Phase 12 — Product hardening

Run repeated loops across:

- visual regression;
- accessibility;
- Spanish/English layout;
- DPI/resolution;
- stress/performance;
- profiler-driven optimizations;
- database migrations;
- corrupt imports;
- crash/autosave recovery;
- replay compatibility;
- security/privacy review;
- documentation.

Exit criteria:

- definition-of-done gates are met with fresh evidence;
- known limitations are explicit.

## Phase 13 — Windows packaging

Build:

- installer artifact;
- portable artifact;
- release CI;
- checksums/version metadata;
- clean install/upgrade/uninstall tests;
- documentation.

## Parallelization guidance

Parallel work is valuable only where ownership is independent. Good early parallel lanes after contracts stabilize:

- world engine;
- persistence/replay;
- simulator;
- UI design system/i18n;
- art pipeline tooling;
- adapter research/fixtures.

Avoid multiple agents simultaneously editing the same central schema or app composition files.

## What happens after planned scope

Autonomous workers continue with demonstrable quality improvements only: tests, fuzzing, performance, accessibility, visual QA, safe refactors, asset consistency and documentation. They do not invent random product features simply to consume quota.
