# User Experience

## Experience hierarchy

TheNexus should feel like a living world first and an operations dashboard second. Professional information is always available, but it should appear when the user asks for it rather than permanently covering the scene.

## Primary navigation model

The Nexus acts as the home location. Project ships are reached through project portals/navigation. Global controls remain accessible through the HUD and command palette.

Core modes:

- **Normal** — minimal HUD, contextual controls.
- **Focus Agent** — follow one character and show only relevant live state.
- **Overview** — zoomed-out ship status and project-level activity.
- **Cinematic** — world only, autonomous camera/ambient behavior.
- **Operations** — tasks, agent status, timeline, diagnostics and history.
- **Edit** — ship editing tools and validation overlays.

## First-run flow

1. Open into the finished Nexus scene.
2. Tutorial NPC introduces the Project Core.
3. User links a project folder or chooses a demo workspace.
4. Tutorial moves to Crew Hall and introduces persistent characters.
5. Communications shows supported/detected harnesses without running them.
6. Harness Simulator creates a fake task.
7. The selected crew member receives it, walks to the mapped station, works and completes it.
8. User opens the contextual task timeline.
9. User is shown the command palette and Edit mode.
10. Tutorial concludes; Nexus remains the normal home screen.

Requirements:

- tutorial is skippable;
- tutorial is replayable;
- all tutorial steps work offline;
- no real provider credentials or quota are needed;
- users can restart with a demo world if no project folder is available.

## Agent interaction

Selecting a crew member opens a contextual card showing only data the adapter can provide, such as:

- current semantic state;
- current task title/summary;
- assigned harness/session;
- duration;
- event count;
- files/commands only when safely available;
- follow action;
- timeline;
- mapping debug details;
- experimental control actions only when explicitly enabled and supported.

Unsupported information must be omitted or clearly marked unavailable, never guessed.

## Operations mode

Operations mode should make the application viable for serious day-to-day use with many agents.

Recommended surfaces:

- active/idle/waiting/error counts;
- task queue/list;
- crew assignment list;
- session timeline;
- event filtering;
- error and needs-input queue;
- replay access;
- mapping/debug inspector;
- project-level statistics.

It should remain visually consistent with the world rather than look like a separate enterprise dashboard.

## Command palette

`Ctrl+K` should provide fast navigation and common actions:

- open project ship;
- return to Nexus;
- find/follow crew member;
- show active agents;
- enter Operations/Edit/Cinematic;
- open replay;
- open settings;
- open mappings;
- create/import character or blueprint.

Actions requiring external-harness control must be hidden/disabled unless the capability is enabled.

## Editor UX

The editor should prioritize direct manipulation.

- smart room modules are the easiest path;
- grid/snap communicates valid placement;
- decoration can use limited free offsets;
- navigation/station validity is shown visually;
- invalid placements explain why;
- undo/redo is expected;
- autosave protects progress;
- users can preview simulated agent movement before leaving Edit mode.

## Character Asset Studio UX

The studio should let non-programmers create/import Character Packs.

Workflow:

1. choose portrait/thumbnail;
2. import sprite sheet(s);
3. define frame size/slicing;
4. map animation + direction;
5. tune FPS/loop;
6. set anchor/offset/scale;
7. preview animation;
8. run in a small simulator test scene;
9. validate pack;
10. save/export.

Validation errors should be actionable: missing direction, mismatched dimensions, transparent bounds, invalid manifest, etc.

## Empty/error/loading states

Every major surface needs designed states for:

- no projects;
- no harnesses detected;
- harness supported but unavailable;
- no active agents;
- no crew available;
- corrupted import;
- recording version mismatch;
- database migration/recovery failure;
- missing asset;
- disconnected/ended observation source.

The world should degrade gracefully rather than disappear into raw error pages.

## Accessibility

The PixiJS world is visual, but critical operational information must also exist in accessible React UI. Provide keyboard access for global navigation, focus visibility, sensible contrast, reduced-motion options where practical, scalable UI text and screen-reader labels for functional controls.

## Notifications

Default desktop notifications should be restrained:

- Needs Input;
- Error;
- Task Completed;
- All Agents Finished.

Users can disable each class independently.

## Language

English is the source locale and Spanish is included from v1. Layouts must tolerate longer translated strings without clipping. Tutorial copy, notifications, tooltips, errors and settings all use i18n keys.
