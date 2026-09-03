# TheNexus Bootstrap Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use a task-by-task subagent-driven workflow when available. Each task must be implemented, tested, reviewed and committed before moving on. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a runnable Windows-first Tauri/React monorepo with provider-neutral domain contracts, deterministic simulator, local event bridge and a minimal simulator-to-UI vertical slice that future phases can extend without architectural rewrites.

**Architecture:** Use a pnpm workspace. The desktop shell lives in `apps/desktop`; provider-neutral TypeScript packages live under `packages/`. The first vertical slice deliberately does not integrate a real harness. Events originate in the deterministic simulator, pass through the local bridge/contracts, and render as a simple development activity view; the PixiJS game world is a later phase built on these interfaces.

**Tech Stack:** pnpm workspace, Tauri 2, React, TypeScript strict mode, Vite, Vitest, Zod, ESLint, Prettier. Rust is limited initially to the generated Tauri shell and narrowly-scoped native commands.

**Spec:** `docs/superpowers/specs/2026-09-03-the-nexus-design.md`

## Global Constraints

- Windows-first; preserve cross-platform seams.
- No real ZCode/OpenCode/Codex/Cursor/model/API execution in autonomous development or tests.
- No provider credentials are required to install, test, build or run the bootstrap.
- Local-first and offline-capable.
- Normalized semantic contracts must not import UI, PixiJS or provider-specific types.
- TypeScript strict mode is mandatory.
- New behavior follows TDD: failing test -> minimal implementation -> passing test -> refactor -> review.
- Commit each independently reviewable task.
- Update `docs/execution/progress.md` with verification evidence.

---

## Planned file structure

```text
TheNexus/
├── apps/
│   └── desktop/
│       ├── src/
│       │   ├── app/App.tsx
│       │   ├── app/App.test.tsx
│       │   ├── dev/SimulatorPanel.tsx
│       │   ├── dev/SimulatorPanel.test.tsx
│       │   └── main.tsx
│       ├── src-tauri/
│       ├── index.html
│       └── package.json
├── packages/
│   ├── contracts/
│   │   ├── src/activity.ts
│   │   ├── src/capabilities.ts
│   │   ├── src/events.ts
│   │   ├── src/index.ts
│   │   ├── src/events.test.ts
│   │   └── package.json
│   ├── simulator/
│   │   ├── src/prng.ts
│   │   ├── src/scenario.ts
│   │   ├── src/index.ts
│   │   ├── src/scenario.test.ts
│   │   └── package.json
│   └── bridge/
│       ├── src/event-bus.ts
│       ├── src/index.ts
│       ├── src/event-bus.test.ts
│       └── package.json
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.js
├── prettier.config.mjs
└── vitest.workspace.ts
```

Package responsibilities are fixed:

- `@thenexus/contracts`: provider-neutral schemas/types only.
- `@thenexus/simulator`: deterministic synthetic provider-neutral events; depends only on contracts.
- `@thenexus/bridge`: normalized in-process event distribution for bootstrap; depends only on contracts. Later native ingestion may sit behind the same API.
- `@thenexus/desktop`: UI/shell consuming public package APIs.

---

### Task 1: Repository workspace and verification skeleton

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `prettier.config.mjs`
- Create: `eslint.config.js`
- Create: `vitest.workspace.ts`
- Create/scaffold: `apps/desktop/**`
- Create: `packages/contracts/package.json`
- Create: `packages/simulator/package.json`
- Create: `packages/bridge/package.json`
- Modify: `README.md`

**Interfaces:**
- Produces root commands: `dev`, `lint`, `typecheck`, `test`, `build`, `format:check`.
- Produces workspace package names `@thenexus/contracts`, `@thenexus/simulator`, `@thenexus/bridge`.

- [ ] **Step 1: Create the root workspace manifest**

Create a private pnpm workspace root with scripts that recurse through packages instead of embedding provider-specific commands. The manifest must include at least:

```json
{
  "name": "thenexus",
  "private": true,
  "packageManager": "pnpm@10",
  "scripts": {
    "dev": "pnpm --filter @thenexus/desktop tauri dev",
    "build": "pnpm -r --if-present build && pnpm --filter @thenexus/desktop tauri build",
    "lint": "pnpm -r --if-present lint",
    "typecheck": "pnpm -r --if-present typecheck",
    "test": "pnpm -r --if-present test",
    "format:check": "prettier --check ."
  }
}
```

If the installed pnpm major differs and the package-manager field prevents execution, use the installed current stable pnpm major and record the ruling in `docs/execution/progress.md`; do not silently switch package managers.

- [ ] **Step 2: Create workspace and base TypeScript configuration**

`pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
```

`tsconfig.base.json` must enable at least:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "useUnknownInCatchVariables": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  }
}
```

- [ ] **Step 3: Scaffold Tauri React TypeScript desktop app**

Use the current official Tauri 2 scaffold for React + TypeScript under `apps/desktop`, preserving generated Rust security configuration. Set package name to `@thenexus/desktop`. Do not enable updater, analytics, remote services or any provider integration.

- [ ] **Step 4: Add lint/format/test dependencies and minimal package scripts**

Each TypeScript package must expose `lint`, `typecheck`, and `test`. Desktop additionally exposes the scripts required by the Tauri scaffold. Avoid introducing a second test runner.

- [ ] **Step 5: Run clean bootstrap verification**

Run from repository root:

```text
pnpm install
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
```

Expected: all commands exit 0. If the scaffold has no tests yet, `pnpm test` must still execute Vitest successfully with `passWithNoTests` only for this task; remove that escape once Task 2 adds tests.

- [ ] **Step 6: Verify desktop dev launch manually through the local Tauri shell**

Run `pnpm dev`, verify the generated local window launches, then stop it. This is local application execution, not a real harness/provider call.

- [ ] **Step 7: Commit and ledger**

Commit message:

```text
chore: bootstrap TheNexus desktop workspace
```

Append commands/results to `docs/execution/progress.md`.

---

### Task 2: Canonical semantic activity and event contracts

**Files:**
- Create: `packages/contracts/src/activity.ts`
- Create: `packages/contracts/src/events.ts`
- Create: `packages/contracts/src/events.test.ts`
- Create: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/package.json`

**Interfaces:**
- Produces `SemanticActivity`, `NormalizedEvent`, `NormalizedEventSchema`, `parseNormalizedEvent`.
- `@thenexus/simulator` and `@thenexus/bridge` consume these exact exports.

- [ ] **Step 1: Write failing contract tests**

Tests must assert:

1. a valid normalized event parses;
2. an invalid event is rejected;
3. timestamps serialize as ISO strings rather than `Date` objects;
4. unknown provider metadata can be retained under a safe metadata record without changing core semantics;
5. semantic activity values are provider-neutral.

Use a canonical fixture equivalent to:

```ts
const fixture = {
  schemaVersion: 1,
  eventId: 'evt_0001',
  workspaceId: 'ws_demo',
  sessionId: 'sess_0001',
  agentId: 'agent_root',
  parentAgentId: null,
  sequence: 1,
  occurredAt: '2026-09-03T21:00:00.000Z',
  kind: 'activity.changed',
  activity: 'planning',
  source: { adapterId: 'simulator', provider: 'simulator' },
  metadata: {}
} as const;
```

- [ ] **Step 2: Run the tests and verify RED**

Run only `@thenexus/contracts` tests. Expected failure: exports/schema are not implemented.

- [ ] **Step 3: Implement semantic activity taxonomy**

`SemanticActivity` must support at least:

```text
idle
planning
reading
coding
researching
testing
building
reviewing
version-control
communicating
waiting-user
error
completed
spawning-subagent
```

Represent it through one runtime schema/source of truth, deriving the TypeScript type from that schema to avoid drift.

- [ ] **Step 4: Implement `NormalizedEventSchema`**

Use Zod. Required invariants:

- `schemaVersion` starts at literal `1`;
- `sequence` is a non-negative integer;
- IDs are non-empty strings;
- `occurredAt` is an ISO datetime string;
- `parentAgentId` is nullable;
- `activity` uses the canonical taxonomy;
- `source.adapterId` and `source.provider` are non-empty strings;
- `metadata` accepts JSON-safe provider-neutral diagnostic metadata but not executable values.

Export:

```ts
export type NormalizedEvent = z.infer<typeof NormalizedEventSchema>;
export function parseNormalizedEvent(input: unknown): NormalizedEvent;
```

- [ ] **Step 5: Run tests and typecheck**

Run contracts tests plus root typecheck. Expected: PASS.

- [ ] **Step 6: Commit and ledger**

Commit:

```text
feat(contracts): define normalized event schema
```

Record evidence.

---

### Task 3: Adapter capability contract

**Files:**
- Create: `packages/contracts/src/capabilities.ts`
- Create: `packages/contracts/src/capabilities.test.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**
- Produces `AdapterCapabilities`, `AdapterCapabilitiesSchema`, `HarnessAdapterDescriptor`.
- Future adapters and Command Center consume these names.

- [ ] **Step 1: Write failing tests for capability truthfulness**

Tests must construct an adapter descriptor with explicit booleans for:

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

Assert missing flags are not silently treated as supported.

- [ ] **Step 2: Verify RED**

Run capability test directly; expected failure from missing exports.

- [ ] **Step 3: Implement runtime schema and types**

Use explicit booleans for every baseline capability. Define:

```ts
export type AdapterCapabilities = z.infer<typeof AdapterCapabilitiesSchema>;

export interface HarnessAdapterDescriptor {
  id: string;
  displayName: string;
  capabilities: AdapterCapabilities;
  experimental: boolean;
}
```

Do not import Cursor/ZCode/Codex/OpenCode packages or hard-code fake support.

- [ ] **Step 4: Run contract suite and root typecheck**

Expected: PASS.

- [ ] **Step 5: Commit and ledger**

Commit:

```text
feat(contracts): add harness capability model
```

---

### Task 4: Deterministic Harness Simulator

**Files:**
- Create: `packages/simulator/src/prng.ts`
- Create: `packages/simulator/src/scenario.ts`
- Create: `packages/simulator/src/scenario.test.ts`
- Create: `packages/simulator/src/index.ts`
- Modify: `packages/simulator/package.json`

**Interfaces:**
- Consumes: `NormalizedEvent`, semantic activity contracts.
- Produces:

```ts
export interface SimulatorScenarioOptions {
  seed: number;
  workspaceId: string;
  agentCount: number;
  eventsPerAgent: number;
  startTime: string;
}

export function generateScenario(options: SimulatorScenarioOptions): NormalizedEvent[];
```

- [ ] **Step 1: Write deterministic failing tests**

Required assertions:

- same seed + options produces byte-for-byte equal arrays;
- different seed changes at least one generated activity/transition while preserving validity;
- every event parses through `NormalizedEventSchema`;
- per-session sequence is monotonically increasing;
- generated events include at least planning, coding, testing and completed for a standard scenario;
- `agentCount: 10`, `50`, `100`, and `250` generate without duplicate event IDs.

- [ ] **Step 2: Verify RED**

Run simulator tests; expected missing implementation failure.

- [ ] **Step 3: Implement a tiny deterministic PRNG**

Keep the PRNG local, dependency-free and documented. It is for repeatable simulations, not cryptography.

- [ ] **Step 4: Implement scenario generator**

Use state-aware activity transitions rather than independently random labels. Every synthetic agent must end in either `completed` or a deliberately configured error path; standard scenario ends completed. Create parent/subagent relationships for a subset of agents when `agentCount > 1`.

- [ ] **Step 5: Run simulator tests and root verification**

Expected: PASS without network/model calls.

- [ ] **Step 6: Commit and ledger**

Commit:

```text
feat(simulator): add deterministic harness scenarios
```

---

### Task 5: In-process normalized Event Bus

**Files:**
- Create: `packages/bridge/src/event-bus.ts`
- Create: `packages/bridge/src/event-bus.test.ts`
- Create: `packages/bridge/src/index.ts`
- Modify: `packages/bridge/package.json`

**Interfaces:**
- Consumes `NormalizedEvent`.
- Produces:

```ts
export type EventListener = (event: NormalizedEvent) => void;

export interface EventBus {
  publish(event: NormalizedEvent): void;
  subscribe(listener: EventListener): () => void;
  clear(): void;
}

export function createEventBus(): EventBus;
```

- [ ] **Step 1: Write failing tests**

Cover ordered delivery, multiple subscribers, unsubscribe, no delivery after unsubscribe, and isolation after `clear()`.

- [ ] **Step 2: Verify RED**

Run bridge test; expected missing implementation.

- [ ] **Step 3: Implement minimal synchronous bus**

Validate events at the boundary with `parseNormalizedEvent`. Listener errors must not corrupt internal subscription state; decide whether to propagate or aggregate and document the ruling/test it.

- [ ] **Step 4: Run package + root tests**

Expected: PASS.

- [ ] **Step 5: Commit and ledger**

Commit:

```text
feat(bridge): add normalized local event bus
```

---

### Task 6: Simulator-to-desktop development vertical slice

**Files:**
- Create: `apps/desktop/src/dev/SimulatorPanel.tsx`
- Create: `apps/desktop/src/dev/SimulatorPanel.test.tsx`
- Modify: `apps/desktop/src/app/App.tsx`
- Create/modify: `apps/desktop/src/app/App.test.tsx`
- Modify: `apps/desktop/package.json`

**Interfaces:**
- Consumes `generateScenario` and `createEventBus` only through public package exports.
- Produces a temporary development surface proving end-to-end contract flow. It is not the final HUD/world.

- [ ] **Step 1: Write failing UI test**

Test rendering a deterministic 3-agent scenario and assert the view shows workspace/session summary, three distinct agents and their latest semantic activity after events are published.

- [ ] **Step 2: Verify RED**

Run desktop test; expected failure from missing panel.

- [ ] **Step 3: Implement `SimulatorPanel`**

The component must:

- generate a scenario only from explicit local options;
- publish through `EventBus` rather than reading the array directly for state updates;
- maintain latest state per agent;
- provide Start/Reset controls;
- make no network calls;
- include a visible `SIMULATOR DATA` indicator to prevent confusion with real harness activity.

- [ ] **Step 4: Run desktop tests and root verification**

Run:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
```

Expected: all PASS.

- [ ] **Step 5: Launch Tauri app and inspect the vertical slice**

Run `pnpm dev`. Use ZCode's local browser/application inspection capabilities if available without invoking external AI providers. Verify Start/Reset, displayed agent count and activity updates. Record what was actually inspected.

- [ ] **Step 6: Commit and ledger**

Commit:

```text
feat(desktop): connect simulator event vertical slice
```

---

### Task 7: Bootstrap-wide reviewer gate

**Files:**
- Review all files changed by Tasks 1-6.
- Update: `docs/execution/progress.md`
- Update: `docs/execution/acceptance-checklist.md` only for items freshly proven.

**Interfaces:** none; this is a gate.

- [ ] **Step 1: Dispatch a fresh read/review context**

The reviewer must compare the branch against:

- `AGENTS.md`;
- canonical design spec;
- this plan;
- acceptance checklist sections A-C that are relevant to bootstrap.

It must search specifically for provider calls, accidental credentials, schema/provider coupling, non-determinism, TypeScript escape hatches, missing negative tests and dependency boundary violations.

- [ ] **Step 2: Fix Critical/High findings with tests**

Every fix follows RED/GREEN where behavior is testable. Do not dismiss a finding without evidence.

- [ ] **Step 3: Run fresh full verification**

Run all bootstrap root commands plus the Tauri/Rust check/build command supported by the generated scaffold. Do not rely on previous output.

- [ ] **Step 4: Update acceptance checklist and ledger**

Check only items actually proven. Include command results and reviewer outcome.

- [ ] **Step 5: Commit review fixes/evidence**

Use a descriptive commit such as:

```text
chore: harden bootstrap foundation
```

---

## Continuation after this plan

The bootstrap plan is deliberately the first detailed implementation plan, not the whole v1 in one context. After Task 7, the primary coordinator must continue autonomously through `docs/roadmap/01-implementation-phases.md`.

For each remaining phase, before editing code:

1. create a phase-specific plan under `docs/superpowers/plans/` using the canonical spec and implemented interfaces;
2. self-review it for spec coverage, placeholders and type/interface consistency;
3. execute it task-by-task with fresh implementer/reviewer contexts when available;
4. update `docs/execution/progress.md` and `docs/execution/acceptance-checklist.md` only with fresh evidence;
5. continue to the next incomplete phase without waiting for routine human approval;
6. stop only for irreversible/destructive operations, security-sensitive external side effects, a truly blocking specification contradiction, or exhausted ZCode usage budget.

The acceptance checklist, not conversational confidence, defines remaining work.
