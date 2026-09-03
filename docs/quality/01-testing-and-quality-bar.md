# Testing Strategy and Quality Bar

## Principle

TheNexus is not done when it compiles. Completion requires fresh evidence across functional correctness, visual quality, performance, data safety and degraded states.

## Test pyramid / layers

### Unit tests

Target pure logic such as:

- event validation and classification;
- mapping rules/fallbacks;
- crew assignment;
- personality idle-choice logic;
- progression calculations;
- editor validation;
- import manifest validation;
- retention rules;
- redaction helpers;
- migration transforms.

### Contract tests

Shared suites should verify:

- adapter SDK conformance;
- normalized event schema;
- capability semantics;
- Character Pack/theme/blueprint manifest behavior;
- recording compatibility.

### Integration tests

Verify package boundaries, for example:

- adapter fixture -> bridge -> normalized event -> recording;
- simulator -> event projection -> mapping -> world state;
- editor mutation -> navigation validation -> persistence;
- import -> validation -> asset registry;
- migration -> repository reads/writes.

### E2E desktop tests

Cover major user journeys:

- first launch/tutorial;
- create/link workspace;
- create/select crew;
- simulator task -> world representation;
- Operations mode;
- Mapping Debugger;
- Edit mode and save/reload;
- character import;
- blueprint import/export;
- replay;
- settings/privacy/audio/language;
- recovery from adapter/source failure.

No E2E test may call a real AI provider.

## Harness Simulator scenarios

Maintain deterministic named scenarios for:

- single happy-path agent;
- parent + subagents;
- planning -> coding -> testing -> completed;
- waiting for user;
- intermittent errors and recovery;
- adapter disconnect/reconnect;
- duplicated/out-of-order events;
- malformed events;
- missing task metadata;
- high-frequency tool events;
- 10 agents;
- 50 agents;
- 100 agents;
- 250-agent extreme stress.

Seeded randomness may be used if replayable from a known seed.

## Replay verification

For a recording and schema/runtime version:

- event ordering is deterministic;
- project/crew activity projection matches expected snapshots;
- speed changes do not alter logical outcomes;
- pause/step/jump do not lose events;
- old recording versions migrate or fail with an explicit compatible error;
- replay never calls an external harness/provider.

## Visual regression

Capture stable screenshot baselines for controlled scenes/mocks. Important scenarios:

- Nexus overview;
- tutorial key steps;
- project ship normal mode;
- selected agent card;
- Operations mode;
- Edit mode;
- Mapping Debugger;
- Character Asset Studio;
- English/Spanish representative screens;
- empty/error states;
- multiple zoom levels;
- dense agent scenarios.

Visual tests supplement, not replace, human visual inspection.

## Manual visual inspection checklist

For user-facing changes inspect:

- sprite anchors;
- z-index/isometric sorting;
- characters behind/in front of props correctly;
- wall/door traversal;
- station approach;
- clipping at room boundaries;
- zoom minimum/maximum;
- 100%/125%/150%/200% Windows scaling as practical;
- common desktop resolutions;
- long Spanish strings;
- keyboard focus;
- reduced-motion behavior if implemented;
- loading/empty/error states;
- theme switch if relevant.

## Performance

### Normal target

Target stable 60 FPS for a normal populated ship on the documented supported Windows baseline.

### Stress targets

- 100 simultaneous synthetic agents: functionally correct and comfortably usable.
- 250 simultaneous synthetic agents: extreme stress case; must degrade gracefully, avoid crashes/corruption and produce useful measurements. 60 FPS is not guaranteed for this extreme target.

Measure:

- FPS/frame time;
- CPU;
- memory;
- event ingestion throughput;
- persistence throughput;
- pathfinding time;
- sorting/occlusion cost;
- particle/animation cost;
- React update cost;
- hidden/background resource use.

Optimize from profiles, not guesses.

## Data safety tests

Cover:

- SQLite migration from representative previous versions;
- interrupted/failed migration recovery;
- autosave recovery;
- backup restore;
- ship/blueprint/character import round-trip;
- malformed/corrupt archives;
- path traversal attempts;
- missing dependencies/assets;
- retention deletion rules;
- secret-redaction fixtures;
- export not including source project data/secrets unexpectedly.

## Accessibility checks

React UI should be tested for:

- keyboard navigation;
- visible focus;
- semantic labels/roles;
- contrast;
- text scaling;
- screen-reader availability of critical operational information that otherwise appears only in PixiJS.

## Internationalization checks

- no hard-coded user-facing strings in feature code;
- missing-key detection;
- English and Spanish smoke/E2E flows;
- pluralization/date/time formatting;
- long-string layout tests.

## Adapter test rule

No automated or autonomous test may:

- send a prompt to ZCode/OpenCode/Codex/Cursor;
- invoke a model;
- consume free/paid quota;
- use provider credentials;
- mutate provider configuration.

Use contract fixtures, mocks, simulator and replay only.

## Definition of done for a feature

A feature is complete only when:

1. the relevant requirement IDs are satisfied;
2. code paths are covered at the appropriate test layers;
3. fresh tests pass;
4. fresh build/type/lint checks pass where configured;
5. user-facing output receives visual inspection;
6. data migration/import implications are covered;
7. degraded/error/empty states are considered;
8. docs are updated;
9. no real AI provider was exercised autonomously.

## Quality loop after scope completion

When planned features are present, autonomous agents should continue only with measurable quality work:

`inspect -> reproduce/measure -> fix -> verify -> visual QA -> regression -> repeat`

Useful targets include fuzzing, accessibility, profiler-driven optimization, deterministic replay, edge cases, additional tests, documentation and proven refactors.

Do not invent arbitrary features or rewrite healthy subsystems simply to use token budget.
