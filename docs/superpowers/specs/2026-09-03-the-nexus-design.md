# TheNexus — Product and System Design Specification

**Date:** 2026-09-03  
**Status:** Approved design baseline; implementation has not started  
**Codename:** TheNexus / Agent World  
**Primary platform:** Windows desktop  

## 1. Executive summary

TheNexus is a local-first desktop application that transforms the activity of external AI coding harnesses into a persistent, editable anime space-fantasy world.

Users continue to work with tools such as ZCode, OpenCode, Codex and Cursor independently. TheNexus observes authorized activity through passive-first adapters, normalizes that activity into a provider-neutral event model, and renders it inside a 2.5D isometric world. Each project/workspace becomes a ship or station. Each persistent crew character visually represents whichever agent/session is temporarily assigned to it.

The application is simultaneously:

1. a practical operations interface for understanding agent activity;
2. a living visual world users can watch in real time;
3. a customization/editor system for ships, themes and characters;
4. a local record/replay system for historical sessions;
5. an extensible platform for future harness adapters and optional control capabilities.

TheNexus must be usable from the first launch without connecting to a real AI provider. A built-in Harness Simulator powers onboarding, testing and demonstrations.

## 2. Product goals

### 2.1 Primary goals

- Make concurrent AI-agent work easy and enjoyable to understand visually.
- Preserve existing harness workflows instead of replacing them.
- Provide a universal normalized model across ZCode, OpenCode, Codex, Cursor and future tools.
- Create emotional continuity through persistent crew characters independent of models/providers.
- Make every project feel like its own living ship/station.
- Ship with a polished onboarding experience centered around the permanent Nexus hub.
- Provide professional operations views without turning the product into a conventional dashboard.
- Remain local-first, private and useful offline.
- Be architected for future public/commercial distribution.

### 2.2 Secondary goals

- Record and replay normalized sessions.
- Allow deep customization through ship editing, character packs, themes and mappings.
- Provide a stable Adapter SDK and Generic Adapter.
- Support future optional command/control without granting control by default.
- Enable community-created characters, rooms, themes and blueprints in the future.

## 3. Non-goals for initial implementation

- TheNexus is not itself an AI coding harness.
- TheNexus does not autonomously call real AI providers during development or testing.
- Cloud accounts, billing and synchronization are not required for v1.
- Full 3D rendering is out of scope.
- Camera rotation is out of scope for v1; the isometric perspective is fixed.
- Deep life-simulation mechanics such as hunger or sleep affecting real agent performance are out of scope.
- Community marketplace/backend infrastructure is out of scope.
- Automatic global filesystem scanning is out of scope.
- Official redistribution of copyrighted anime character assets is out of scope.

## 4. Core product principles

### 4.1 External-harness first

Users keep using their preferred harnesses. TheNexus observes and represents them rather than forcing work through a proprietary runner.

### 4.2 Passive before active

Observation is the default. Control capabilities are explicit, experimental and opt-in.

### 4.3 Local before cloud

The complete v1 experience works with local storage only. Cloud synchronization may be added later without changing core domain IDs and schemas.

### 4.4 Semantic before visual

A provider event becomes a normalized semantic activity before any room, station or animation is selected. Themes can therefore change presentation without changing meaning.

### 4.5 World first, professional HUD when needed

The world remains the primary interface. Operational information appears contextually and through dedicated modes instead of permanently covering the game view.

### 4.6 Quality is a feature

Visual polish, deterministic behavior, performance, accessibility, migration safety, import/export resilience and testability are part of completion criteria.

## 5. Canonical domain model

### 5.1 Nexus

The permanent central station shared by the application. It contains onboarding, crew management, harness management, achievements, settings and portals/access to project ships.

### 5.2 Workspace / Project Ship

A workspace may contain one or more authorized folders and repositories. It maps to one editable ship/station.

Examples:

- one monorepo -> one ship;
- frontend repo + backend repo -> one ship;
- multiple related folders -> one ship.

### 5.3 Crew Character

A persistent visual identity with:

- name;
- character pack;
- portrait;
- role/specialties;
- experience/statistics;
- personality traits;
- preferences;
- affinity/social metadata;
- history.

A character is **not** a provider, model, session or agent.

### 5.4 Assignment

A temporary binding between a crew character and a normalized observed agent/session/task. When the assignment ends, the character becomes available again.

### 5.5 Guest Agent

A temporary visual character created when no suitable persistent crew member is available for a newly observed subagent. A guest may later be converted into permanent crew.

### 5.6 Harness Adapter

A module translating provider-specific observable data into the normalized event schema and declaring supported capabilities.

### 5.7 Activity Mapping

Rules translating normalized semantic activity into a room type, station type, animation and optional visual effects.

## 6. First-launch experience

The first run must be usable without a real harness.

1. Launch into a short branded transition.
2. Enter **The Nexus**, already populated with a small finished space-fantasy station.
3. A tutorial NPC guides the user physically through the world.
4. The user learns that projects become ships at the Project Core.
5. The user can authorize/select a project folder or create a demonstration workspace.
6. The user visits the Crew Hall and selects/creates a character.
7. The user visits Communications and sees detected/supported harnesses. Detection does not execute them.
8. The built-in Harness Simulator runs a fake task.
9. The assigned character receives the task, walks to the mapped room/station, performs an animation, finishes and gains cosmetic/statistical progress.
10. The user is shown the task timeline and contextual HUD.
11. The tutorial ends with the Nexus remaining as the permanent application hub.

The tutorial must be skippable and replayable.

## 7. World and camera experience

The world is a continuous 2.5D isometric scene rendered through PixiJS with a custom world engine.

Required camera modes:

- **Normal:** world-first view with minimal contextual HUD.
- **Focus Agent:** camera follows one character with lightweight details.
- **Overview:** broad ship view and global activity summary.
- **Cinematic:** no operational UI; autonomous camera and ambient life.
- **Operations:** denser HUD with tasks, timelines, events and agent status.
- **Edit:** ship editor overlays and manipulation tools.

The camera supports smooth pan, zoom, follow and detail zoom into important rooms. Perspective remains fixed in v1.

## 8. World activity semantics

Real activity is mapped to visual action through a provider-neutral pipeline:

```text
provider signal
  -> adapter event
  -> normalized event
  -> semantic activity
  -> mapping rule
  -> room type
  -> station type
  -> animation
  -> ambient effect/status UI
```

Example:

```text
tool.category = test
  -> activity.testing
  -> Astral Laboratory
  -> Crystal Test Bench
  -> testing animation
  -> diagnostic rune effect
```

Default activity categories should include at minimum:

- idle;
- planning/thinking;
- coding/editing;
- reading files;
- researching/documentation/web;
- testing;
- building;
- reviewing;
- version-control activity;
- communicating/delegating;
- waiting for user;
- error;
- completed;
- spawning subagent.

Fallback behavior is mandatory. Missing rooms/stations cannot break an assignment; the mapper selects the nearest compatible generic workstation.

## 9. Mapping editor and debugger

The app ships with polished default mappings and an advanced visual editor.

A rule can specify:

- match condition;
- semantic activity;
- preferred room type;
- preferred station type;
- animation;
- ambient effect;
- status visibility;
- priority/fallback behavior.

The Mapping Debugger must explain the full reasoning chain for a selected event/agent:

```text
incoming adapter event
-> normalized event
-> detected activity
-> matched rule ID
-> room selected
-> station selected
-> animation selected
```

This is a core supportability feature, not optional debug tooling.

## 10. Ship editor

The editor uses a hybrid model.

### 10.1 Modules

Built-in intelligent room modules include concepts such as:

- Arcane Workshop;
- Celestial Library;
- Astral Laboratory;
- Command Sanctum;
- Crew Quarters;
- Observatory;
- Crystal Core;
- Lounge;
- Empty Module.

A module includes default floor/walls, doors, navigation, semantic room type, stations, lighting and camera metadata.

### 10.2 Interior editing

Users can move, rotate, delete and duplicate compatible objects; place furniture, stations, effects and lighting; customize floors/walls/windows; and use an isometric snap grid with optional small free offsets for decoration.

### 10.3 Blueprints

Users can save reusable room/module configurations as blueprints and export/import them independently from full ships.

### 10.4 Integrity

Editor actions must preserve or explicitly resolve:

- navigation connectivity;
- station reachability;
- object overlap rules;
- valid room entrances;
- mapping fallbacks;
- save/load determinism.

## 11. Crew and personality system

Persistent crew members have light social/life simulation that never changes the behavior or availability of the real external agent.

Personality may affect only visual/idle behavior, such as:

- preferred idle room;
- social frequency;
- favorite stations;
- celebration style;
- rest/reading/observatory routines;
- short deterministic/non-LLM ambient conversations;
- affinity presentation;
- optional day/night preferences.

No personality stat may throttle, delay, cancel or alter real agent work.

### 11.1 Assignment policy

Assignment is hybrid:

- users may manually pin a character;
- otherwise the system chooses an available character based on project, specialty and preferences;
- observed subagents receive free crew automatically;
- if none are available, a Guest Agent appears.

## 12. Progression

Progression is cosmetic and statistical rather than resource-gated.

Possible progress surfaces include:

- character level/experience;
- task/session history;
- specialty levels;
- achievements;
- ship/project milestones;
- cosmetic unlocks;
- trophies/decorations;
- persistent project history.

Users never need to farm currency/resources to use professional functionality.

## 13. Character packs and Asset Studio

Characters use importable Character Packs with 2D anime sprite sheets.

Baseline animation directions:

- NE;
- NW;
- SE;
- SW.

Baseline animations:

- idle;
- walk;
- coding;
- researching;
- testing;
- planning;
- talking;
- sitting;
- sleeping/resting;
- celebrating;
- error;
- optional character-specific specials.

A pack also contains portrait/thumbnail and manifest metadata.

The in-app Asset Studio supports import, frame slicing, direction mapping, FPS, looping, scale, anchor/offset editing, preview and simulator-based in-world validation.

## 14. Art direction and themes

The default official art direction is **anime space-fantasy**: sci-fi technology visually blended with magical systems, celestial architecture, crystal energy, constellations, runic holograms, atmospheric particles and expressive anime-inspired original characters.

Themes are replaceable presentation layers. The same semantic room/activity may render differently under future themes such as cyberpunk, cozy sci-fi, industrial or minimalist.

Themes may replace:

- room skins;
- station art;
- effects;
- ambience;
- UI tokens;
- audio profile;
- background environment.

Themes must not redefine provider event semantics.

## 15. Third-party character policy

Development/local packs may be created for selected recognizable anime characters for private development reference and testing, initially targeting characters from Dragon Ball, Kimetsu no Yaiba, Jujutsu Kaisen and One Piece.

These assets must be structurally isolated from official distributable assets. They are not part of the commercial/public product baseline and must be removable without code changes.

Official product content must use original or properly licensed characters/assets.

## 16. Harness architecture

Initial adapters:

- ZCode;
- OpenCode;
- Codex;
- Cursor;
- Generic Adapter.

Adapters declare capabilities such as:

```text
observeSessions
observeAgents
observeToolCalls
observeFilesystemActivity
observeTokens
observeTasks
sendTask
sendMessage
cancelTask
```

The UI must react to declared capabilities. Unsupported data/actions are never fabricated.

### 16.1 Passive-first bridge

A local Agent World Bridge sits between provider-facing adapters and the normalized event bus.

Responsibilities include:

- authorized session discovery;
- log/event consumption;
- optional hooks;
- filesystem/git signals;
- adapter lifecycle;
- event normalization;
- record/replay;
- control dispatch only when explicitly enabled.

### 16.2 Experimental control

The Command Center UI and capability interfaces may exist in v1, but external control is disabled by default.

A user must explicitly enable experimental harness control. No character or simulation system may autonomously send real provider commands.

## 17. Harness Simulator

A deterministic simulator is mandatory before real integrations are manually validated.

It must generate:

- one or many sessions;
- parent and subagents;
- realistic activity transitions;
- tool calls/events;
- waiting/error/completion states;
- concurrency;
- malformed/edge-case events;
- high-volume streams.

Required scale scenarios: 10, 50, 100 and 250 synthetic agents.

The simulator powers onboarding, automated testing, demos and performance profiling.

## 18. Record and replay

Normalized sessions can be recorded locally and replayed without providers.

Replay requirements:

- deterministic ordering;
- pause/resume;
- event stepping;
- speed controls including 1x, 2x, 5x, 10x and 50x;
- jump to significant events;
- historical metadata;
- compatibility/migration strategy for old recordings.

Raw/heavy data retention is configurable; sessions may be pinned for permanent retention.

## 19. Local storage

The application is local-first.

Expected data location on Windows is under the standard application data directory rather than a hard-coded custom path.

Storage categories include:

- SQLite database;
- project/workspace metadata;
- ship layouts;
- character/crew definitions;
- mappings;
- recordings;
- imported character/theme/blueprint assets;
- backups;
- settings.

Exports should support portable project/ship and asset package formats without coupling to the machine's absolute filesystem paths where avoidable.

Domain IDs and schema boundaries must allow future cloud synchronization, but no cloud dependency is introduced now.

## 20. Privacy and permissions

Default privacy posture is strict.

- No whole-computer scan by default.
- User authorizes project folders and relevant data sources.
- Harness detection does not imply full data access.
- Normalized metadata is preferred over raw content.
- Raw prompts, terminal output or file contents require explicit opt-in surfaces.
- Likely secrets should be redacted before persistence/display where feasible.
- No project data is uploaded in v1.
- No external AI provider/model may be called during autonomous development/testing.

## 21. HUD and professional workflows

The world remains the main canvas. Contextual UI provides:

- active agent count;
- crew panel;
- tasks;
- timeline;
- selected-agent details;
- mapping/debug information;
- edit controls;
- command palette;
- settings.

The command palette should support navigation/actions such as finding a crew member, opening a project, showing active agents, entering Edit mode and opening replay sessions.

## 22. Audio and notifications

Audio is included but optional and granularly muteable.

Categories may include:

- music;
- ambient world audio;
- UI;
- character/world effects;
- important task cues.

System notifications are configurable, with sensible defaults emphasizing only high-value events such as Needs Input, Error, Task Completed and All Agents Finished.

## 23. Internationalization

English is the base product language and Spanish ships in v1.

All user-facing UI, tutorial text, settings, errors, tooltips and notifications must use the i18n layer. Do not hard-code English strings into world or adapter logic.

## 24. Background behavior

Windows-first desktop behavior includes optional tray/background mode.

When the main window is not visible, the application may keep the lightweight bridge/event recording active if enabled, but the PixiJS world must not continue rendering unnecessarily.

Launch-at-startup is available but disabled by default.

## 25. Technical architecture

Primary stack:

- Tauri for desktop/native shell;
- React + TypeScript for application UI;
- PixiJS for world rendering;
- custom 2.5D isometric World Engine;
- SQLite for primary structured persistence;
- filesystem for larger assets/recordings as appropriate;
- typed normalized event schema shared across bridge, adapters, replay and UI.

The preferred repository shape is a modular monorepo with packages for world engine, event schema, adapter SDK, bridge, simulator, replay, persistence, assets, crew simulation, editor, UI and i18n.

## 26. Performance requirements

- Target stable 60 FPS for normal ship populations on the supported Windows baseline.
- Validate behavior at 100 simultaneous simulated agents.
- Run an extreme 250-agent stress scenario and degrade gracefully.
- Keep world rendering suspended/throttled when not visible.
- Avoid unnecessary React/world-engine cross-render coupling.
- Profile pathfinding, sorting, particles, sprite batching, event throughput and persistence independently.

## 27. Quality strategy

Required test layers:

- unit tests;
- package/API contract tests;
- adapter contract tests;
- simulator tests;
- integration tests;
- desktop E2E flows;
- deterministic replay tests;
- SQLite migration tests;
- import/export validation and corruption tests;
- screenshot/visual regression tests;
- accessibility checks;
- performance/stress tests.

Visual QA must explicitly inspect:

- sprite anchors;
- z-order/occlusion;
- characters moving behind/in front of objects correctly;
- door and station navigation;
- zoom extremes;
- editing interactions;
- dense agent clusters;
- theme switching;
- Windows DPI/resolution variants;
- English/Spanish layout differences.

## 28. Distribution

v1 distribution target:

- Windows installer;
- Windows portable build;
- build/release automation;
- architecture ready for later auto-update without making it mandatory in v1.

macOS/Linux compatibility should not be needlessly blocked by package design, but Windows is the implementation and QA priority.

## 29. Branding

`TheNexus` / `Agent World` remains a codename. Visible branding should be centralized/configurable so a later commercial name does not require broad source rewrites.

## 30. Autonomous development policy

Autonomous agents may parallelize independent work through isolated branches/worktrees and subagents.

They must not run real provider tests. All provider behavior uses mocks/simulator/fixtures/replay.

When the scoped product appears implemented, agents continue only with demonstrable quality work: testing, visual inspection, fuzzing, performance, accessibility, documentation, safe refactoring, edge cases and coherent asset expansion. They must not invent arbitrary features or rewrite sound code merely to consume token quota.

## 31. Acceptance baseline for the first usable product

A first usable product is not accepted unless all of the following exist:

- installable/launchable Windows desktop app;
- functioning Nexus hub;
- playable/skippable/replayable simulator-driven tutorial;
- at least one finished project ship template;
- continuous isometric world with camera modes;
- persistent crew system;
- light personality/idle simulation;
- activity mapping and Mapping Debugger;
- ship editor with modules and blueprints;
- Character Pack import and Asset Studio baseline;
- official original assets suitable for distributable builds;
- isolated development-only anime reference packs where locally provided/created;
- normalized event schema;
- adapter SDK;
- ZCode/OpenCode/Codex/Cursor/Generic adapter implementations or capability-safe stubs backed by contract tests, without real-provider execution;
- Harness Simulator;
- record/replay;
- local persistence and migrations;
- import/export and backups;
- English and Spanish UI;
- configurable audio and desktop notifications;
- Windows installer + portable artifact pipeline;
- passing automated quality gates;
- documented known limitations and manual real-provider validation checklist.

## 32. Final design decisions

The following are explicitly approved:

- desktop-first hybrid architecture;
- Tauri + React + TypeScript;
- PixiJS + custom isometric world engine;
- 2.5D continuous ship worlds with detailed zoom;
- default anime space-fantasy visual style;
- switchable themes;
- The Nexus as permanent tutorial/central hub;
- persistent crew characters independent of harness/model/session;
- automatic + editable mapping;
- hybrid ship editor with smart modules and Empty Module;
- blueprints;
- ZCode/OpenCode/Codex/Cursor/Generic adapter targets;
- passive-first capability negotiation;
- observer default with experimental opt-in control architecture;
- local-first storage prepared for future cloud;
- Windows-first, cross-platform-ready design;
- strict folder/data authorization;
- fixed isometric camera orientation in v1;
- hybrid automatic/manual crew assignment;
- light social/personality simulation;
- configurable historical retention and replay;
- optional audio;
- configurable system notifications;
- English + Spanish;
- permissively licensed external assets only when provenance is recorded;
- strict separation of third-party anime development packs from official assets;
- high product-quality test bar;
- installer + portable Windows builds;
- codename remains temporary;
- autonomous agents continue safe quality work rather than arbitrary feature creep.

This specification is the design baseline that the implementation plan must decompose into executable phases.
