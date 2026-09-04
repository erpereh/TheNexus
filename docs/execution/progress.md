# TheNexus Autonomous Execution Ledger

This file is the durable recovery map for long-running autonomous work. Keep it concise and factual. Do not erase old entries; append new evidence and rulings.

## Current state

- Baseline spec: `docs/superpowers/specs/2026-09-03-the-nexus-design.md`
- Acceptance checklist: `docs/execution/acceptance-checklist.md`
- Current implementation plan: `docs/superpowers/plans/2026-09-03-bootstrap-core.md` (Tasks 1-7 complete, reviewer gate passed)
- Implementation status: bootstrap foundation complete; Phase 1 (full domain contracts) next
- Real-provider validation: forbidden for autonomous runs; manual only

## Rulings

Record decisions that resolve ambiguity without stopping the run:

```text
YYYY-MM-DD HH:MM — Ruling: <decision> — Reason: <why> — Cost if wrong: <rework/risk>
```

2026-09-04 01:30 — Ruling: Use pnpm 11.24.0 (`packageManager: "pnpm@11.24.0"`) instead of the plan's `pnpm@10` — Reason: pnpm 11.24.0 is the version actually installed and is current stable; plan explicitly permits matching the installed major — Cost if wrong: lockfile churn if forced back to pnpm 10.

2026-09-04 01:30 — Ruling: Root `vitest.config.ts` with `projects` replaces the plan's `vitest.workspace.ts` — Reason: Vitest 5 removed workspace-file support in favor of `projects`; per-package configs remain the source of truth — Cost if wrong: root-level single-process runs diverge; per-package `pnpm -r test` unaffected.

2026-09-04 01:30 — Ruling: Workspace packages export TypeScript source directly (`exports` -> `src/index.ts`) during bootstrap — Reason: avoids build-order coupling between packages and the desktop bundler; `tsc --noEmit` provides the type gate — Cost if wrong: rework when publishing/native nodes require `dist` outputs (Phase 3+).

2026-09-04 01:30 — Ruling: Simulator guarantees at least one parent/subagent relationship when `agentCount > 1` (first root always spawns) and at least one `error` terminal when `agentCount >= 6` — Reason: makes nested-agent and error-path coverage deterministic for all downstream tests — Cost if wrong: scenario streams change; determinism tests re-baselined.

2026-09-04 01:30 — Ruling: Event bus listener errors are contained per-listener and routed to an injectable `onListenerError` sink (default no-op) — Reason: one broken subscriber must not silence others; host injects logging — Cost if wrong: silent listener failures if hosts forget to inject a sink.

2026-09-04 01:30 — Ruling: Normalized-event schema v1 strips unknown top-level fields (Zod default) — Reason: forward compatibility for future adapter-added optional fields within the same major schema — Cost if wrong: silently dropped fields; migration strategy in Phase 3 must handle cross-version upgrades explicitly.

2026-09-04 01:30 — Ruling: Root `build` intentionally runs the desktop vite build twice (once via `-r build`, once via `beforeBuildCommand`) — Reason: keeps `tauri build` self-contained when invoked standalone, per plan script layout — Cost if wrong: a few seconds of duplicated work per build.

2026-09-04 01:30 — Ruling: pnpm-managed `minimumReleaseAgeExclude` entries in `pnpm-workspace.yaml` (vitest@5.0.0 and friends) are kept — Reason: auto-added by pnpm 11's supply-chain release-age gate because these packages were newer than the default minimum age — Cost if wrong: none; cosmetic config.

2026-09-04 01:30 — Ruling: `app-icon.png` source and generated `src-tauri/icons/` are committed — Reason: Tauri build requires icons; the artwork is fully programmatic original work (`apps/desktop/tools/generate-icon.mjs`) — Cost if wrong: rebuild icons via `node tools/generate-icon.mjs && pnpm tauri icon app-icon.png`.

## Phase/task evidence

For every completed task append:

```text
### <phase/task>
Commit(s): <sha(s)>
Verification:
- `<command>` -> PASS/FAIL, key result
- `<command>` -> PASS/FAIL, key result
Visual QA: <what was inspected; screenshot/contact-sheet artifact if applicable>
Review: <reviewer role/context and findings>
Acceptance items checked: <IDs/headings>
Open concerns: <none or concrete items>
```

### Bootstrap Task 1 — workspace + Tauri shell
Commit(s): 5ab3d57 `chore: bootstrap TheNexus desktop workspace`
Verification:
- `pnpm install` -> PASS, 264 packages resolved from committed lockfile
- `pnpm format:check` -> PASS, all matched files
- `pnpm lint` -> PASS (contracts, simulator, bridge, desktop)
- `pnpm typecheck` -> PASS (4/4 packages, strict chain from tsconfig.base.json)
- `cargo check` (apps/desktop/src-tauri) -> PASS, exit 0, Rust 1.98.1 stable-msvc
Visual QA: n/a (shell only)
Review: covered by Task 7 gate
Acceptance items checked: A (workspace/strict/tooling/no-secrets rows)
Open concerns: CI workflow written but not yet executed on a remote runner (requires push)

### Bootstrap Task 2 — normalized event schema
Commit(s): afdfd3e `feat(contracts): define normalized event schema`
Verification:
- RED: contracts tests fail before implementation (8 failed as expected)
- `pnpm --filter @thenexus/contracts test` -> PASS, 19 tests
Open concerns: none

### Bootstrap Task 3 — capability contract
Commit(s): 84a5ab0 `feat(contracts): add harness capability model`
Verification:
- `pnpm --filter @thenexus/contracts test` -> PASS (capabilities suite included)
Open concerns: none

### Bootstrap Task 4 — deterministic simulator
Commit(s): 9e6a6d4 `feat(simulator): add deterministic harness scenarios`
Verification:
- RED: simulator tests fail before implementation
- `pnpm --filter @thenexus/simulator test` -> PASS, 15 tests (determinism, seed divergence, per-session sequence monotonicity, unique IDs, taxonomy coverage, 10/50/100/250 agents, error/completion terminals)
Open concerns: none

### Bootstrap Task 5 — normalized event bus
Commit(s): 72faf4f `feat(bridge): add normalized local event bus`
Verification:
- RED: bridge tests fail before implementation
- `pnpm --filter @thenexus/bridge test` -> PASS, 8 tests (ordering, multi-subscriber, unsubscribe, clear, boundary rejection, listener-error containment, 10k-event volume)
Open concerns: none

### Bootstrap Task 6 — simulator-to-desktop vertical slice
Commit(s): 7278933 `feat(desktop): connect simulator event vertical slice`
Verification:
- RED: SimulatorPanel tests fail before implementation
- `pnpm --filter @thenexus/desktop test` -> PASS, 5 tests
- `pnpm dev` (tauri dev) -> PASS, window launched on Windows
Visual QA: inspected live Tauri window (pid 40768) via accessibility screenshot: TheNexus title bar, SIMULATOR DATA indicator, Workspace ws_demo, Start produced 1 session / 3 agents (agent_0001 + 2 subagents linked to parent) with latest activities rendered; Reset cleared agents/sessions to 0. Start and Reset exercised through UI automation.
Review: covered by Task 7 gate
Open concerns: none

### Bootstrap Task 7 — reviewer gate + hardening
Commit(s): this commit
Verification:
- Fresh independent reviewer (general-purpose subagent, read-only) audited the branch against AGENTS.md, canonical spec, bootstrap plan, checklist A-C. VERDICT: FAIL (0 Critical, 1 High) — High = unpopulated execution ledger (this file, now fixed). Medium/Low findings all fixed: malformed-fixture tests via bus boundary, per-event `parseNormalizedEvent` assertion, forward-compat unknown-field stance test + ruling, bus boundary describe() try/catch, runtime `HarnessAdapterDescriptorSchema` + negative tests, restrictive CSP in tauri.conf.json, architecture doc taxonomy reconciled to implemented vocabulary.
- `pnpm format:check` -> PASS
- `pnpm lint` -> PASS (4/4)
- `pnpm typecheck` -> PASS (4/4)
- `pnpm test` -> PASS, 53 tests total (contracts 21, simulator 17, bridge 10, desktop 5)
- `cargo check` -> PASS
- `pnpm --filter @thenexus/desktop tauri build` -> PASS, exit 0; artifacts: `target/release/thenexus-desktop.exe`, `bundle/msi/TheNexus_0.1.0_x64_en-US.msi`, `bundle/nsis/TheNexus_0.1.0_x64-setup.exe`
Visual QA: live dev-window inspection recorded in Task 6
Review: fresh reviewer context; all Critical/High findings fixed and re-verified
Acceptance items checked: see checklist updates in this commit
Open concerns: CI workflow not yet run on remote runner; production build with final CSP to be re-verified during Phase 13 packaging

## Performance evidence

Append measured scenario, machine/context, FPS/frame-time, memory and event throughput. Never write `fast` or `good` without numbers.

- 2026-09-04: Event bus synchronous publish throughput: 10,000 events delivered in-process within one test execution (< 1 s, node environment; exact per-event timing instrumentation deferred to Phase 4 world-engine work where it is decision-relevant).

## Final review

Do not populate until a fresh whole-repository reviewer has checked the completed branch against the canonical spec and acceptance checklist.

### Post-gate verification — production CSP build
Commit(s): 27f62dc (follows)
Verification:
- `pnpm --filter @thenexus/desktop tauri build` -> PASS, exit 0 with restrictive CSP active (2 bundles: MSI + NSIS)
- Release `thenexus-desktop.exe` launched -> UI renders fully under CSP; Start via UI automation produced 1 session / 3 agents / completed terminals -> CSP does not break the app
Visual QA: release window inspected via accessibility screenshot (TheNexus + Harness Simulator panel intact)
Open concerns: none

### Phase 1 — domain contracts (Tasks 1-5)
Commit(s): 21f65bb, 4376b1d, 4189abf, 6aec7b2
Verification:
- TDD RED verified before each implementation (imports missing / tests failing for the right reason)
- `pnpm --filter @thenexus/contracts exec vitest run` -> PASS, 64 tests (domain 13, mapping 11, pack 7, theme/blueprint 20, recording 8, events/capabilities 21 spread across files)
- `pnpm --filter @thenexus/contracts exec tsc --noEmit` -> PASS
- `pnpm --filter @thenexus/contracts exec eslint .` -> PASS
- Full root `pnpm test` -> 115 tests PASS across 5 packages
Acceptance items checked: B (all rows: versioned schema+validation, fixtures valid/invalid/unknown/forward-compat, capability schema, taxonomy, domain types incl. workspace/crew/assignment/room/station/theme/character-pack/recording, deterministic serialization tests)
Open concerns: Phase 1 reviewer gate running; findings to be fixed before Phase 1 is declared closed

### Phase 2 remainder — named scenario presets
Commit(s): 7a311c9
Verification:
- `pnpm --filter @thenexus/simulator exec vitest run` -> PASS, 30 tests incl. 8 preset names, exact populations 10/50/100/250, error-path coverage, override determinism
Open concerns: none

### i18n skeleton (Phase 0 item) + desktop wiring
Commit(s): 78c81a9, 1922ff6
Verification:
- `pnpm --filter @thenexus/i18n exec vitest run` -> PASS, 6 tests (EN/ES key parity, fallback, locale detection, sync factory)
- `pnpm --filter @thenexus/desktop exec vitest run` -> PASS, 5 tests (panel strings now flow through i18next with English defaults)
Open concerns: language toggle UI arrives with Phase 7 HUD

### Phase 1 Task 6 — reviewer gate
Commit(s): cd1dfd7 (hardening), a3f63e7 (replay engine, parallel track)
Verification:
- Fresh independent reviewer (general-purpose subagent, read-only + behavioral probes) audited all Phase 1 commits against spec sections 5/9/13/14/18, arch docs 02/04, game docs 02/03. VERDICT: PASS (0 Critical, 0 High, 7 Medium, 8 Low).
- All Medium findings fixed and re-verified with new tests: special_* pack extras allowed (spec §13), strict pack schemas (untrusted import gate), signed affinity range pinned, weak pack tests replaced with genuinely failing assertions, stale domain barrel deleted, parseTheme safe parser added, assignment strict + inverse release invariant, strictness policy documented, recording workspaceId prefix-validated, tiedRuleIds exposed for debugger traceability, freeOffset bounded, type guards added. Finding 6 (branded IDs) deferred until persistence agent completes to avoid type friction; recorded as open concern.
- `pnpm --filter @thenexus/contracts exec vitest run` -> PASS, 70 tests
- Full root `pnpm test` -> PASS (128 tests across 6 packages)
Acceptance items checked: B rows confirmed with hardening evidence
Open concerns: ID branding deferred (contracts type surface stability during parallel persistence implementation)

### i18n end-to-end regression (Spanish locale)
Commit(s): 1922ff6 (follow-up verification)
Verification:
- `pnpm dev` launched on the host Windows machine; window inspected via accessibility screenshot: UI strings rendered in SPANISH (Simulador de Harness, DATOS SIMULADOS, Espacio de trabajo, Iniciar/Reiniciar) because the host OS locale is Spanish and the i18n layer auto-detected it -> locale detection + catalogs work end-to-end in the real Tauri webview
- Root cause found and fixed for a dev-launch failure: an orphaned vite process held port 5173 (strictPort correctly refused to shift); killed the orphan
Open concerns: none

### Phase 5 (early) — semantic mapping engine
Commit(s): f9fc127
Verification:
- TDD: 9 tests covering full default-rule coverage of every semantic activity, no provider-scoped defaults, preferred room/station resolution, fallback hierarchy steps 2/3/4/5 with trace steps, deterministic nearest-room selection, overrideActivity, user rules over disabled defaults
- `pnpm --filter @thenexus/mapping exec vitest run` -> PASS, 9 tests; `tsc --noEmit` + `eslint` clean
Ruling: mapping engine lives in its own package `@thenexus/mapping` (arch/01 package list is a boundary map, not an exhaustive file; a pure engine consumed by world integration, crew-simulation and the debugger deserves an isolated home)
Open concerns: none

### Phase 5 (early) — crew-simulation package
Commit(s): ae78074
Verification:
- TDD: 10 tests — pinned/manual assignment first, deterministic id tie-break fallback, specialty-overlap preference, Guest Agent creation from safe pool pack (pack_guest_pool), invalid pin falls through to policy, release/reassign cycle, guest->crew conversion, task-completion stats + derived level, symmetric affinity, personality-weighted idle destinations (favorites dominate; curiosity adds capped exploration; one long-lived seeded PRNG drives deterministic ambient sequences)
- `pnpm --filter @thenexus/crew-simulation exec vitest run` -> PASS, 10 tests; tsc/eslint clean
Ruling: personality idle selection takes an injectable `rand` (created via @thenexus/simulator createPrng); ambient systems must keep ONE long-lived PRNG per simulation run — a fresh same-seed PRNG per call repeats the same roll (caught by test)
Ruling: crew-simulation package depends only on contracts + simulator (pure ambient decisions); it has no path to any control capability by construction
Open concerns: none

### Phase 3 (Tasks 1-4) — persistence package (implementer subagent + coordinator integration)
Commit(s): 012b23c
Verification:
- Implementer subagent (exclusive ownership of packages/persistence) delivered: DatabaseDriver + node:sqlite driver, versioned migrations (clean-DB, idempotent, fixture upgrade, failed-migration rollback, newer-DB rejection), recordings repository (round-trip, corrupt-row skip reporting, transactional imports with size/count gates, export re-validation), pure retention planner honoring pinning, best-effort secret redaction (7 token families, idempotent)
- Fresh coordinator verification: `pnpm --filter @thenexus/persistence exec vitest run` -> PASS, 64 tests; tsc --noEmit PASS; eslint PASS
- Independent reviewer dispatched (background) for the persistence diff
Rulings (by implementer, verified): multi-statement SQL routed through exec (node:sqlite prepare drops trailing statements); importEnvelope gates size/count before parse; exportEnvelope throws on unknown ids; pruneRawIds always empty in v1 (raw payloads not persisted by this layer)
Open concerns: reviewer findings pending; Tauri SQL driver deferred to app integration phase

### Phase 10 — Adapter SDK + five adapters
Commit(s): 7ad9033
Verification:
- SDK: HarnessAdapter lifecycle/health, control gateway with audited refusals, field-mapping factory, shared conformance suite (capabilities, malformed safety, dedupe, health, no accidental control dispatch)
- Generic Adapter 11 tests; ZCode 9; OpenCode 13; Codex 9; Cursor 9 — all TDD against synthetic fixtures only
- All adapter packages: tsc --noEmit PASS, eslint PASS, vitest PASS
Ruling: provider parsers target documented SYNTHETIC fixture shapes; descriptors are observation-only (control structurally false); real-format research + validation is manual-only per docs/quality/02-manual-harness-validation.md
Open concerns: world-engine agent still running; its in-progress tests were excluded from this gate

### Phase 3 (Tasks 1-4) reviewer gate
Commit(s): 5d91a9c
Verification:
- Fresh independent reviewer audited packages/persistence (commit 012b23c) against arch/04, arch/01 and plan Tasks 1-4. VERDICT: PASS (0 Critical, 0 High, 3 Medium, 5 Low).
- All three Medium findings fixed with tests: quoted env-secret redaction (single/double quote forms, idempotent), redactJsonStrings WeakMap memoization for shared references, exportEnvelope corruption test (INVALID_ENVELOPE instead of silent row drop). 68 persistence tests now pass.
- Remaining Low findings (multi-statement-with-params throws, bigint select documentation, migration version contiguity, truncated private-key block) recorded as safe backlog items — none block Phase 3.
Rulings: exportEnvelope returns structured INVALID_ENVELOPE for corrupt rows (consistent with envelope contract); silent drop forbidden.
Open concerns: Low backlog items; Tauri SQL driver at app integration.

### Phase 9 (early) — asset-system theme runtime + default theme
Commit(s): (this commit)
Verification:
- DEFAULT_THEME parses against canonical ThemeManifestSchema; skins every semantic room (9) and station (10) type; carries no activity semantics
- Theme runtime: semantic-keyed lookups with deterministic fallback chain; theme switching provably preserves semantics (8 tests)
Open concerns: sprite/effect asset refs are placeholders for the art pipeline; Asset Studio UI comes with full Phase 9
