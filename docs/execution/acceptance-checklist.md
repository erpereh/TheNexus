# TheNexus Autonomous Execution Acceptance Checklist

This checklist is the progress contract for long-running autonomous implementation. ZCode Goal Mode should treat unchecked required items as evidence that the v1 goal is not complete.

## Rules

- Required items are marked `[ ]` until verified with fresh evidence.
- Do not mark an item complete because code exists. Run the relevant test/build/inspection and record evidence in `docs/execution/progress.md`.
- A failed or unverified gate stays unchecked.
- Never call a real ZCode, OpenCode, Codex, Cursor, model API, paid/free inference endpoint, or provider credential while completing this checklist.
- Real-provider manual validation is explicitly deferred to the human owner.
- When all required items are checked, continue only with measurable QA/hardening improvements from the safe backlog; do not invent unrelated features solely to consume quota.

## A. Repository and engineering foundation

- [x] pnpm workspace exists and installs deterministically from lockfile.
- [x] Tauri + React + TypeScript desktop application starts on Windows.
- [x] TypeScript strict mode is enabled for application/packages.
- [x] Formatting, linting, typecheck, unit-test and build commands exist at repository root.
- [ ] CI runs the non-GUI verification suite without provider credentials.
- [ ] Package boundaries documented in the design are represented in the workspace.
- [x] No production secret/API key is committed.

## B. Canonical contracts

- [x] Versioned normalized event schema exists with runtime validation.
- [x] Event fixtures cover valid, invalid, unknown and forward-compatible cases.
- [x] Capability schema exists for harness adapters.
- [x] Semantic activity taxonomy exists and is independent from themes/providers.
- [ ] Workspace, crew, assignment, room, station, theme, character-pack and recording domain types exist.
- [x] Contract tests demonstrate deterministic serialization/deserialization.

## C. Harness Simulator and local Bridge

- [x] Deterministic Harness Simulator can create sessions, agents and subagents.
- [x] Simulator covers planning, reading, coding, research, testing, build, review, git, waiting, error and completion activity.
- [x] Simulator supports malformed/unknown events without crashing the app.
- [x] Scenarios for 10, 50, 100 and 250 synthetic agents exist.
- [x] Local Bridge accepts provider-neutral adapter events and publishes normalized events.
- [x] Backpressure/high-volume behavior is tested.
- [ ] Simulator is the default onboarding/demo data source.

## D. Persistence, privacy and replay

- [x] SQLite persistence is implemented with versioned migrations.
- [x] Migrations are tested from a clean DB and at least one previous schema fixture.
- [x] Authorized workspace paths are stored explicitly; whole-PC scanning is not performed.
- [x] Raw-content storage is opt-in.
- [x] Basic secret-redaction pipeline exists and is tested.
- [x] Record/replay stores normalized sessions locally.
- [x] Replay supports pause/resume, stepping and 1x/2x/5x/10x/50x.
- [x] Replay ordering is deterministic.
- [x] Retention/pinning behavior is configurable and tested.
- [x] Corrupt/unsupported recording imports fail safely with useful errors.

## E. PixiJS World Engine

- [ ] Fixed-perspective 2.5D isometric renderer is functional.
- [ ] Camera supports pan, smooth zoom, follow and overview framing.
- [ ] Depth sorting is stable for characters, rooms, stations and props.
- [ ] Navigation/pathfinding avoids blocked cells and unreachable stations.
- [ ] Characters can move between rooms and stations without clipping through blocked geometry.
- [ ] Animation state machine supports required baseline activities.
- [ ] World engine does not depend directly on ZCode/OpenCode/Codex/Cursor APIs.
- [ ] Hidden/minimized desktop window stops unnecessary world rendering.
- [ ] Normal-sized scenes target stable 60 FPS on the development Windows machine.
- [ ] 100-agent stress scenario remains usable and records performance metrics.
- [ ] 250-agent extreme scenario completes without crash/leak runaway.

## F. Mapping system

- [ ] Default semantic mappings ship with the application.
- [ ] Mapping resolution supports priorities and fallbacks.
- [ ] Missing preferred room/station never breaks an assignment.
- [ ] Mapping editor can create/update/reorder/disable rules.
- [ ] Mapping Debugger shows incoming event -> normalized event -> activity -> rule -> room -> station -> animation.
- [ ] Mapping tests are deterministic and provider-neutral.

## G. Crew and personality

- [ ] Persistent crew members are independent from provider/model/session identity.
- [ ] Manual assignment works.
- [ ] Automatic assignment uses availability/project/specialty/preferences.
- [ ] Guest Agent fallback works when no crew member is available.
- [ ] Personality affects only visual/idle behavior.
- [ ] Personality cannot delay, cancel or modify real/simulated task execution.
- [ ] Light affinity/social metadata and deterministic ambient interactions work without LLM calls.
- [ ] Cosmetic/statistical progression is persisted.

## H. The Nexus and onboarding

- [ ] First launch enters a complete initial Nexus environment rather than an empty editor.
- [ ] Tutorial is playable using only Harness Simulator data.
- [ ] Tutorial covers project/workspace, crew, harness capabilities, a simulated task, mapping/world behavior and timeline/HUD.
- [ ] Tutorial is skippable and replayable.
- [ ] The Nexus remains useful after onboarding as permanent central hub.
- [ ] Demonstration workspace is available when user does not authorize a real project folder.

## I. World-first UI and HUD

- [ ] Normal mode works.
- [ ] Focus Agent mode works.
- [ ] Overview mode works.
- [ ] Cinematic mode works.
- [ ] Operations mode works.
- [ ] Edit mode works.
- [ ] Contextual agent panel exposes current assignment/activity and relevant metadata.
- [ ] Task/timeline surfaces work against simulator and replay data.
- [ ] Command palette supports core navigation/actions.
- [ ] UI remains usable at common Windows DPI/resolution settings.
- [ ] English and Spanish localization exist for user-facing baseline UI/tutorial strings.
- [ ] No important UI flow relies solely on color.

## J. Ship editor and blueprints

- [ ] Built-in intelligent room modules exist, including Empty Module.
- [ ] Rooms can be placed/moved/duplicated/deleted with isometric snapping.
- [ ] Interior stations/furniture/effects can be edited.
- [ ] Small free offsets are supported for decoration where safe.
- [ ] Editor validates navigation connectivity and station reachability.
- [ ] Autosave works.
- [ ] Crash/interrupted-write recovery is tested.
- [ ] Blueprint save/load/export/import works deterministically.
- [ ] Corrupt blueprint imports fail safely.

## K. Themes, assets and Character Packs

- [ ] Official default theme implements the anime space-fantasy art direction.
- [x] Theme presentation is decoupled from semantic activity.
- [x] At least one theme switch demonstrates the abstraction without changing mappings.
- [ ] Character Pack manifest/schema exists with NE/NW/SE/SW directions.
- [ ] Required baseline animation slots are supported.
- [ ] Asset Studio can import, slice/map frames, adjust anchors/offsets/FPS/looping and preview in simulator.
- [ ] Asset validation detects missing frames/directions, invalid dimensions and bad manifests.
- [ ] Contact-sheet/preview tooling exists for visual QA.
- [ ] Official distributable assets are original or license-compatible and recorded in `ASSET_PROVENANCE.md`.
- [ ] Recognizable anime character dev packs, if created locally, are isolated from official/public build inputs.

## L. Adapter SDK and initial adapters

- [x] Adapter SDK defines lifecycle, event and capability contracts.
- [x] Generic Adapter is implemented against fixtures/simulator.
- [x] ZCode Adapter compiles and passes contract tests without launching/calling ZCode or a model.
- [x] OpenCode Adapter compiles and passes contract tests without launching/calling OpenCode or a model.
- [x] Codex Adapter compiles and passes contract tests without launching/calling Codex or a model.
- [x] Cursor Adapter compiles and passes contract tests without launching/calling Cursor or a model.
- [ ] UI never fabricates unsupported capabilities/data.
- [x] Real-provider/manual validation checklist is documented separately and remains unexecuted by autonomous agents.

## M. Experimental Command Center

- [ ] Command Center UI exists against simulator/mock control adapter.
- [ ] `sendTask`, `sendMessage` and `cancelTask` capability surfaces are represented where supported.
- [ ] Real external control is disabled by default.
- [ ] Enabling experimental control requires explicit human opt-in.
- [ ] Simulated control actions are auditable in local logs/timeline.
- [ ] No autonomous personality/game system can trigger external control.

## N. Audio, notifications and background behavior

- [ ] Audio system has separate configurable categories and global mute.
- [ ] Audio is optional and does not block onboarding.
- [ ] Desktop notifications are configurable with sensible high-value defaults.
- [ ] Tray/background behavior is functional on Windows.
- [ ] Launch-at-startup option exists and is disabled by default.
- [ ] Bridge/recording may continue in background only when enabled; Pixi world rendering does not.

## O. Quality gates

- [ ] `pnpm lint` passes.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm test` passes.
- [ ] Rust/Tauri tests/checks pass.
- [ ] Desktop production build completes successfully.
- [ ] Unit coverage includes contracts, mapping, simulator, assignments and persistence logic.
- [ ] Integration tests cover simulator -> bridge -> persistence -> world-state flow.
- [ ] E2E tests cover onboarding and core simulator workflow.
- [ ] Visual regression/screenshot coverage exists for core world/UI states.
- [ ] Keyboard navigation/accessibility audit has no unresolved critical blocker in professional UI surfaces.
- [ ] No uncaught error or console-error spam occurs in primary flows.
- [ ] Fuzz/property tests cover parsers/import formats/high-volume event handling where appropriate.
- [ ] Memory/performance profiling has been run against stress scenarios and findings recorded.

## P. Windows release artifacts

- [ ] Windows installer build is generated successfully.
- [ ] Portable Windows build is generated successfully.
- [ ] GitHub Actions/release workflow is prepared without auto-publishing unexpectedly.
- [ ] Application branding is configurable; `TheNexus`/`Agent World` remains codename-safe.
- [ ] Public build excludes unlicensed development-only character packs.
- [ ] Clean-machine installation/run instructions are documented.

## Q. Documentation and final review

- [ ] README contains current setup/run/test/build instructions.
- [ ] Architecture docs reflect implemented package boundaries and event flow.
- [ ] Adapter SDK documentation matches actual interfaces.
- [ ] Character Pack/theme/blueprint authoring docs exist.
- [ ] Manual real-harness validation checklist exists but contains no autonomous-provider execution.
- [ ] Final adversarial whole-repository review has been performed by a fresh reviewer context.
- [ ] All Critical/High findings from final review are fixed and re-verified.
- [ ] Remaining non-blocking findings are documented with severity/rationale.
- [ ] `docs/execution/progress.md` contains final fresh verification evidence.
