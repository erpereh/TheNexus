# TheNexus — Provider-Neutral Continuation Prompt

Use this prompt with a capable coding agent in Codex, Cursor, OpenCode, ZCode or another development harness. It does not depend on ZCode Goal Mode or on the previous conversation.

---

You are resuming implementation of **TheNexus** from an interrupted autonomous-development checkpoint.

Do not assume the previous agent completed a phase merely because files exist. Use repository state and fresh verification as evidence.

## 1. Read the binding context first

Read these files in order before modifying code:

1. `AGENTS.md`
2. `docs/superpowers/specs/2026-09-03-the-nexus-design.md`
3. `docs/execution/HANDOFF-2026-09-04.md`
4. `docs/execution/progress.md`
5. `docs/execution/acceptance-checklist.md`
6. `docs/roadmap/01-implementation-phases.md`
7. the phase plan relevant to the next incomplete task

The canonical design spec defines the product. `AGENTS.md` defines mandatory safety/engineering rules. The handoff describes the interrupted checkpoint and current verification truth.

## 2. Inspect the actual repository before trusting documentation

Run at minimum:

```bash
git status
git branch --show-current
git log --oneline --decorate -20
git diff --stat
```

Expected continuation branch:

```text
agent/glm-autonomous-v1
```

Do not implement directly on `main`.

Preserve unrelated human changes. Never reset/discard valuable work merely to make the tree clean.

## 3. First technical task: restore the verification baseline

The current remote checkpoint has a real GitHub Actions failure at:

```bash
pnpm format:check
```

The clean Windows CI runner reported Prettier differences in 181 files and therefore skipped lint, typecheck, tests, Rust checks and the production build.

Before feature work:

1. reproduce the formatting failure on a clean checkout / CI-equivalent environment;
2. inspect line-ending and Git normalization behavior (`core.autocrlf`, actual EOLs, `.gitattributes` state) and Prettier configuration;
3. identify the root cause before applying a broad formatting fix;
4. make the smallest durable correction;
5. rerun `pnpm format:check`.

A line-ending/checkout-normalization issue is a leading hypothesis, **not established fact**. Do not blindly mass-format until evidence supports the chosen fix.

Then run the complete root gate:

```bash
pnpm lint
pnpm typecheck
pnpm test
cd apps/desktop/src-tauri && cargo check --all-targets && cd ../../..
pnpm --filter @thenexus/desktop tauri build
```

Record exact pass/fail output in `docs/execution/progress.md`.

## 4. Resume the interrupted World Engine before starting a new visual phase

The previous world-engine worker was interrupted by quota exhaustion.

`packages/world-engine/src/core/**` contains substantial WIP: iso math, depth sort, grid/spatial index, deterministic A*, camera, character controller, world simulation, animation mapping and perf instrumentation.

But the phase is incomplete:

- no `src/render/**` PixiJS layer exists;
- `pixi.js` is not yet a world-engine dependency;
- `packages/world-engine/src/index.ts` exports nothing;
- desktop does not mount the world engine;
- no Phase 4 reviewer gate was completed.

First stabilize the existing core:

```bash
pnpm --filter @thenexus/world-engine test
pnpm --filter @thenexus/world-engine typecheck
pnpm --filter @thenexus/world-engine lint
```

Review it against:

```text
docs/superpowers/plans/2026-09-04-phase-4-world-engine.md
```

Fix verified defects using TDD. Then complete Phase 4 Tasks 8-9: Pixi render layer, desktop integration, visual/smoke verification, and independent review gate.

Do not rewrite the working headless core merely because you would have designed it differently.

## 5. Preserve already-delivered subsystem boundaries

The checkpoint already contains valuable headless/runtime packages. Build on them rather than duplicating them:

- `@thenexus/contracts`
- `@thenexus/simulator`
- `@thenexus/bridge`
- `@thenexus/replay-engine`
- `@thenexus/persistence`
- `@thenexus/mapping`
- `@thenexus/crew-simulation`
- `@thenexus/i18n`
- `@thenexus/asset-system`
- `@thenexus/adapter-sdk`
- Generic/ZCode/OpenCode/Codex/Cursor adapter packages
- `@thenexus/world-engine` (partial)

Read their tests before changing their public contracts.

## 6. Persistence state

`packages/persistence` was implemented and independently reviewed during the previous run. The reviewer reported 0 Critical / 0 High after Medium findings were fixed.

Do not reimplement persistence from scratch.

Known remaining Low backlog:

- multi-statement SQL-with-params behavior/documentation
- bigint select documentation
- migration-version contiguity validation
- truncated private-key block behavior

The Tauri/native SQL driver and application-level wiring remain future integration work.

## 7. Adapter state and absolute provider-safety rule

The adapter SDK and five initial adapters exist, but provider adapters currently target **synthetic fixture shapes only**.

During autonomous work you MUST NOT:

- launch real ZCode, OpenCode, Codex or Cursor tasks;
- send prompts/messages to a real model;
- consume provider/model quotas for testing;
- use API keys, credentials, browser sessions or provider tokens;
- modify provider/harness configuration;
- install observation/control hooks without explicit human action.

Use only:

- Harness Simulator
- synthetic fixtures/events
- mocks
- contract tests
- replay
- static/local inspection
- public documentation

Real-provider validation is an explicit manual human activity documented separately in `docs/quality/02-manual-harness-validation.md`.

## 8. Preferred continuation order after Phase 4

After the clean root gate and completed/reviewed World Engine:

1. integrate simulator/bridge/persistence/replay/mapping/crew/world state into one provider-neutral runtime vertical slice;
2. add integration tests for that flow;
3. build The Nexus initial environment + simulator-only onboarding;
4. build contextual HUD and Normal/Focus/Overview/Cinematic/Operations/Edit modes;
5. build ship editor + blueprint runtime;
6. build Character Pack / Asset Studio tooling;
7. build Command Center against mock/simulator control only;
8. add audio/notifications/background/tray behavior;
9. perform full E2E, accessibility, visual regression and rendered-world performance hardening;
10. only later perform manual real-harness validation with explicit human direction.

## 9. Testing / review discipline

For every bounded task:

- read the relevant spec/plan first;
- write or identify the failing test before a behavioral fix where practical;
- make the smallest coherent implementation;
- run focused tests;
- run affected package lint/typecheck;
- use an independent reviewer for meaningful task groups;
- fix Critical/High findings before proceeding;
- record fresh evidence in `docs/execution/progress.md`;
- update `docs/execution/acceptance-checklist.md` only when evidence genuinely satisfies an item.

Do not mark requirements complete because code merely exists.

## 10. Parallel work

Parallelize only genuinely independent work with explicit file ownership.

Good parallel domains include:

- world render layer
- persistence app driver/integration
- integration tests
- onboarding UX research
- accessibility review
- visual QA infrastructure
- adversarial code review

Never allow multiple writable agents to modify the same files concurrently.

## 11. Documentation continuity

As implementation progresses:

- keep `docs/execution/progress.md` factual and append-only in spirit;
- update `docs/execution/acceptance-checklist.md` from fresh evidence;
- update `docs/execution/HANDOFF-2026-09-04.md` or create a successor handoff when the continuation session ends;
- keep architecture docs synchronized with actual package boundaries;
- preserve the safety rule against autonomous real-provider execution.

## 12. Definition of a successful continuation session

A session is not successful because it produced many files.

It is successful when it leaves:

- a coherent branch;
- no valuable uncommitted work lost;
- fresh tests/build evidence;
- reviewed changes;
- updated progress/handoff state;
- a precise next task another engineer can resume without conversational context.

Begin by reading the required sources and reproducing the current CI formatting failure. Do not start a new feature until the checkpoint verification baseline is trustworthy.
