# TheNexus Phase 1 — Full Domain Contracts Plan

**Goal:** Complete the provider-neutral domain contract layer: stable IDs and entity types (workspace/ship/crew/assignment/guest), room/station semantics, the mapping rule contract with deterministic selection, versioned Character Pack / theme / blueprint manifests with validation, and the recording envelope contract.

**Architecture:** All schemas live in `@thenexus/contracts` (the architecture doc's `event-schema` package; package name evolves per bootstrap ruling). Zod schemas are the single source of truth; TypeScript types are derived. No UI, PixiJS or provider imports. Pure functions only (rule selection, manifest validation) so downstream packages can consume them deterministically.

**Tech Stack:** TypeScript strict, Zod 4, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-09-03-the-nexus-design.md` (§5, §9, §13, §14, §18, §19), `docs/architecture/02-event-model-and-mapping.md`, `docs/architecture/04-storage-privacy-security.md`, `docs/game/02-crew-and-character-system.md`, `docs/game/03-ship-editor-and-themes.md`.

## Global Constraints

- No real provider execution anywhere (imports, network calls, credentials).
- Contracts package must not import UI/PixiJS/provider code (verified by grep + reviewer).
- Every schema has a version literal; parsers reject unsupported versions with descriptive errors.
- Manifests are declarative; no executable content fields.
- TDD: failing tests first for each task; commit per task.
- Root gates (`pnpm lint/typecheck/test/format:check`) must pass before each commit.

---

### Task 1: Stable IDs and core domain entities

**Files:** `packages/contracts/src/domain/ids.ts`, `workspace.ts`, `crew.ts`, `assignment.ts`, `ship.ts`, `domain.test.ts`, update `src/index.ts`.

**Interfaces:**
- `WorkspaceSchema`/`Workspace`, `AuthorizedFolderSchema`, `ShipSchema`/`Ship` (metadata-level; layout shape arrives with editor phase), `CrewCharacterSchema`, `PersonalityTraitsSchema`, `GuestAgentSchema`, `AssignmentSchema`, `parseWorkspace`, `parseCrewCharacter`, `parseAssignment` (+ type guards).
- Branded ID schemas: `WorkspaceId`, `ShipId`, `RoomInstanceId`, `StationInstanceId`, `CharacterId`, `GuestId`, `AssignmentId`, `RecordingId`, `MappingRuleId`, `BlueprintId`, `PackId`, `ThemeId` with prefix validation (`ws_`, `ship_`, `char_`, ...).

**Acceptance behavior (tests):**
- round-trip parse of a valid workspace/crew/assignment; guest agent schema;
- rejects wrong ID prefixes, empty names, negative stats; affinity is signed (rivalry allowed) with a -100..100 range, pinned by test;
- `exactOptionalPropertyTypes`-safe optional fields;
- crew character carries NO provider/model/session identity fields (negative structural test: parsed object key set).

### Task 2: Room/station semantics + mapping rule contract

**Files:** `packages/contracts/src/domain/semantics.ts`, `mapping.ts`, `mapping.test.ts`, update `src/index.ts`.

**Interfaces:**
- `ROOM_TYPES` = command, engineering, laboratory, library, observatory, communications, archive, lounge, generic_workstation (arch/02 baseline).
- `STATION_TYPES` = coding_workstation, test_bench, reading_desk, research_scope, planning_holo, comm_console, archive_terminal, lounge_seat, core_console, generic_workstation.
- `ROOM_TYPE_TO_STATION_TYPES` default compatibility map.
- `MappingRuleSchema`: id, enabled, priority, match {activity|'any', kind?, provider?}, overrideActivity?, preferredRoomType, preferredStationType, animationIntent, effectIntent?, statusDisplay ('always'|'overview'|'hidden'), allowFallback.
- `selectMappingRule(rules, event, seedlessTieBreak)` -> `{ rule | null, considered, tieBreaks }` pure function: enabled+matching rules sorted by priority desc, then lexicographic rule id asc (documented, tested tie-break); non-matching rules reported in trace for the future Mapping Debugger.

**Acceptance behavior (tests):**
- highest priority wins; equal priority -> id asc; disabled rules never match; provider/kind/activity predicates filter correctly; 'any' activity matches all; empty rule set -> null; selection is deterministic across repeated calls (byte-for-byte trace equality); rules with unknown preferred room types are rejected by schema.

### Task 3: Character Pack manifest contract

**Files:** `packages/contracts/src/domain/character-pack.ts`, `character-pack.test.ts`, update `src/index.ts`.

**Interfaces:**
- `CHARACTER_PACK_MANIFEST_VERSION = 1`; `PACK_DIRECTIONS` = NE/NW/SE/SW; `PACK_ANIMATION_SLOTS` = idle, walk, coding, researching, testing, planning, talking, sitting, sleeping, celebrating, error.
- `CharacterPackManifestSchema`: manifestVersion, packId (branded), name, author?, license?, directions, animations (Record<slot, AnimationDef>), portraitAsset?, thumbnailAsset?.
- `AnimationDef`: per-direction frame descriptors (`frameWidth`/`frameHeight`/`frameCount`/`frameIndices`), fps (1-60), loop, anchor (normalized 0-1), offset?, scale?, fallback (direction ref or 'idle'/'walk' generic).
- `validateCharacterPackManifest(input): { ok, issues: PackIssue[] }` with stable issue codes (`PACK_VERSION_UNSUPPORTED`, `MISSING_REQUIRED_SLOT`, `MISSING_DIRECTION`, `BAD_FRAME_GEOMETRY`, `BAD_ANCHOR`, `BAD_FPS`, `UNKNOWN_SLOT`, ...).

**Acceptance behavior (tests):**
- valid manifest parses; `idle` and `walk` required; missing direction in present animation flagged; frame geometry (width/height/count > 0) validated; anchor outside [0,1] flagged; fps bounds enforced; unknown slots rejected; manifest with explicit fallback for missing direction validates OK; validation is deterministic (same input -> same issues order).

### Task 4: Theme + blueprint manifest contracts

**Files:** `packages/contracts/src/domain/theme.ts`, `blueprint.ts`, `manifests.test.ts`, update `src/index.ts`.

**Interfaces:**
- `THEME_MANIFEST_VERSION = 1`; `ThemeManifestSchema`: themeId (branded), name, tokens (color map), roomSkins (Partial<Record<RoomType, RoomSkin>>), stationSkins (Partial<Record<StationType, StationSkin>>), audioProfile?, backgroundAsset?. RoomSkin/StationSkin carry `nameKey` (i18n key) and declarative asset refs; NO activity/semantic fields (themes cannot redefine provider semantics — enforced structurally).
- `BLUEPRINT_FORMAT_VERSION = 1`; `BlueprintSchema`: blueprintId, name, roomType, footprint (grid w/h 1-64), objects (station placements with grid offsets + rotation 0/90/180/270 + optional free offset), themeOverrides?, requiredAssetRefs. `parseBlueprint(input)` returns `{ ok: true, blueprint } | { ok: false, error }` — never throws on garbage.

**Acceptance behavior (tests):**
- theme manifest with every room skin keyed by real RoomType; unknown room type rejected; theme carrying an `activity`-like semantic field is rejected (strict schema);
- blueprint round-trip determinism (JSON.stringify equality after parse); footprint bounds enforced; object offsets within footprint; rotation enum enforced; `parseBlueprint(null/string/number/empty)` returns safe error, never throws.

### Task 5: Recording envelope contract

**Files:** `packages/contracts/src/domain/recording.ts`, `recording.test.ts`, update `src/index.ts`.

**Interfaces:**
- `RECORDING_FORMAT_VERSION = 1`; `RecordingEnvelopeSchema`: formatVersion, recordingId (branded), createdAt, workspaceId?, generator {adapterId, provider}, events (readonly NormalizedEvent[] in observed order), eventCount == events.length.
- `RecordingSummarySchema` for listings; `parseRecording(input): { ok, recording } | { ok, error: { code: 'UNSUPPORTED_VERSION'|'INVALID_ENVELOPE', message } }` — safe failure, never throws; `summarizeRecording(recording)`.

**Acceptance behavior (tests):**
- envelope with 3 canonical events round-trips byte-for-byte; eventCount mismatch rejected; formatVersion 0/2 -> UNSUPPORTED_VERSION error code; non-object input -> INVALID_ENVELOPE, no throw; observed order preserved exactly (no reordering on parse); summary derives correct counts.

### Task 6: Phase 1 review gate + evidence

- Fresh reviewer subagent compares the phase diff against spec §5/§9/§13/§14/§18 and checklist section B; fixes Critical/High findings with tests.
- Fresh full verification: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, plus grep proving no provider imports in `packages/contracts`.
- Update `docs/execution/progress.md` + acceptance checklist B items; commit.
