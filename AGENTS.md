# AGENTS.md — TheNexus

This file defines mandatory operating rules for any coding agent, subagent or autonomous development harness working in this repository.

## 1. Mission

Build **TheNexus** as a production-quality Windows-first desktop application that represents real AI coding-agent activity inside a persistent anime space-fantasy 2.5D isometric world.

The product must remain useful as a professional agent-operations tool while feeling alive as a game world.

## 2. Sources of truth

Before implementation, read in this order:

1. `docs/superpowers/specs/2026-09-03-the-nexus-design.md`
2. `docs/product/02-product-requirements.md`
3. `docs/architecture/01-system-architecture.md`
4. `docs/quality/01-testing-and-quality-bar.md`
5. Any domain-specific document relevant to the task.

If implementation and documentation disagree, stop changing behavior until the conflict is resolved. Do not silently reinterpret requirements.

## 3. Non-negotiable safety rule: NEVER exercise real AI providers autonomously

During autonomous implementation or test runs, agents MUST NOT:

- launch real ZCode, Cursor, Codex or OpenCode agent tasks;
- send prompts or messages to a real model/provider;
- invoke paid or free model quotas for testing;
- use API keys, account credentials, browser sessions or provider tokens;
- modify the user's provider/harness configuration;
- install hooks into a detected harness without explicit user action;
- log into external AI services;
- choose a cheaper model and assume that makes a real provider test acceptable.

All harness behavior must be tested with the **Harness Simulator**, mocks, fixtures, contract tests, synthetic event streams and replay recordings.

Real-provider validation is always a manual, explicit user action outside autonomous development.

## 4. Passive-first integration

Adapters must be capability-driven and passive-first.

- Detection does not imply permission to read everything.
- Observation must stay within explicitly authorized project folders and data sources.
- Control capabilities are disabled by default.
- Experimental control must be opt-in per user and per adapter.
- The UI must never imply a capability the adapter cannot actually provide.
- Adapters expose normalized capabilities rather than leaking provider-specific behavior into the world engine.

## 5. Architecture boundaries

Keep these concerns isolated:

- Tauri/native shell
- React application UI
- PixiJS world engine
- normalized event schema
- local bridge/runtime observation
- adapter SDK and provider adapters
- harness simulator and replay
- persistence
- asset/theme system
- character/crew simulation
- editor/runtime

The world engine must not import provider-specific code. Provider adapters must not manipulate rendering state directly.

Prefer small, testable packages and explicit interfaces over large cross-cutting modules.

## 6. Expected workspace shape

The intended monorepo structure is approximately:

```text
apps/
  desktop/
packages/
  world-engine/
  event-schema/
  adapter-sdk/
  bridge/
  harness-simulator/
  replay-engine/
  persistence/
  asset-system/
  crew-simulation/
  editor-core/
  ui/
  i18n/
adapters/
  zcode/
  opencode/
  codex/
  cursor/
  generic/
docs/
```

Exact package names may evolve, but dependency direction and isolation must remain clear.

## 7. Product invariants

Do not break these invariants:

- A **workspace/project** can contain one or more folders/repos and maps to one ship/station.
- A **crew character** is persistent and independent from harness, model, session and agent identity.
- Harness/model/session/task are temporary assignments.
- The Nexus is the permanent central station and onboarding hub.
- The default visual language is anime space-fantasy.
- Themes alter presentation, not semantic activity mapping.
- World activity is derived from normalized events, not provider-specific UI hacks.
- Mapping is automatic by default and user-editable.
- The Mapping Debugger must explain event -> normalized event -> activity -> rule -> room -> station -> animation.
- The app is local-first and fully useful without an account or cloud service.
- Background mode must not keep rendering the world unnecessarily.

## 8. Third-party IP and assets

The public/commercial core must use original or appropriately licensed assets.

Development-only packs may reference well-known anime characters, but they must remain isolated from distributable official assets.

Initial local/dev character pack targets include characters inspired by the selected development references from Dragon Ball, Kimetsu no Yaiba, Jujutsu Kaisen and One Piece. These MUST live under a clearly isolated development-only path and MUST NOT be treated as shippable official product content.

Do not scrape, rip or redistribute copyrighted game/anime sprite sheets.

Every third-party asset used in distributable code must have clear provenance and compatible licensing recorded in `ASSET_PROVENANCE.md` or its eventual canonical equivalent.

## 9. UI and visual quality

Do not treat visual correctness as subjective cleanup for later.

Every user-facing change must be inspected at relevant:

- resolutions;
- DPI/scaling levels;
- camera zoom levels;
- world population sizes;
- edit/operations/cinematic modes;
- light/dense UI states;
- English and Spanish locales.

Check sprite anchors, occlusion, z-order, collisions, clipping, focus states, keyboard navigation, empty states, loading states and error states.

Avoid placeholder-looking UI in finished flows.

## 10. Testing discipline

Implementation is incomplete until appropriate tests exist and pass.

Required layers include:

- unit tests;
- package contract tests;
- adapter contract tests;
- integration tests;
- E2E desktop flows;
- deterministic replay tests;
- persistence migration tests;
- import/export corruption tests;
- screenshot/visual regression tests;
- accessibility checks;
- stress/performance scenarios;
- simulator scenarios with 10, 50, 100 and 250 synthetic agents.

Never claim a build, test suite or flow works without fresh verification evidence.

## 11. Performance target

Normal ships should target a stable 60 FPS on the supported Windows baseline.

The simulator must validate graceful behavior at 100 simultaneous agents and an extreme 250-agent scenario. The extreme case is primarily a stress target, not a guarantee that every machine sustains 60 FPS.

Measure before optimizing. Record reproducible performance scenarios.

## 12. Data, privacy and security

- No global filesystem scan by default.
- Require explicit folder/workspace authorization.
- Raw prompts, terminal output and file contents are opt-in data surfaces.
- Prefer normalized metadata over raw sensitive content.
- Redact likely secrets before persistence/display where feasible.
- Never upload local project data without a future explicit cloud opt-in.
- SQLite and local assets are the v1 persistence model.
- Raw/heavy event retention must be configurable; normalized history may persist longer.

## 13. Git and task isolation

For autonomous parallel work:

- do not pile unrelated changes into one branch;
- use separate branches/worktrees for independent risky areas when the harness supports them;
- keep commits coherent and descriptive;
- do not force-push shared work;
- do not modify `main` unless the user explicitly requests that workflow;
- avoid simultaneous writes to the same files by multiple subagents;
- assign ownership boundaries before spawning parallel subagents.

## 14. Autonomous-work policy

Agents may spawn subagents when work can be isolated cleanly.

Good subagent domains include:

- world engine;
- persistence;
- adapter contracts;
- simulator/replay;
- editor;
- accessibility;
- visual QA;
- performance;
- security review;
- documentation;
- adversarial code review.

Do not spawn many agents merely to consume quota. Parallelism must correspond to independent work.

## 15. When the planned scope is implemented

Do not stop at the first compiling MVP. Enter a bounded quality-improvement loop:

1. inspect;
2. test;
3. identify a demonstrable defect or quality gap;
4. fix it;
5. visually inspect when applicable;
6. rerun relevant and regression tests;
7. document meaningful findings;
8. repeat while useful work remains.

Safe additional work includes test coverage, fuzzing, performance profiling, accessibility, deterministic replay verification, visual QA, documentation, proven refactors, edge cases and coherent asset-library expansion.

Do **not** invent arbitrary new product features or rewrite sound code only to consume tokens.

## 16. Documentation duty

Update docs whenever a change alters:

- user-visible behavior;
- architecture boundaries;
- event schemas;
- adapter capabilities;
- persistence schema;
- import/export formats;
- security/privacy behavior;
- performance targets;
- asset licensing expectations.

Significant architecture changes require a decision entry/ADR before or alongside implementation.

## 17. Definition of done

A task is done only when:

- requirements are satisfied;
- tests appropriate to the change exist;
- fresh verification passes;
- no known regression was introduced;
- error and empty states were considered;
- relevant docs were updated;
- visual behavior was inspected if user-facing;
- no real AI provider was exercised by autonomous tests.
