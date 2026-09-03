# World and The Nexus

## The Nexus

The Nexus is the permanent central station for the entire application. It serves three roles at once:

1. onboarding/tutorial world;
2. global navigation hub;
3. persistent home for unassigned crew, settings and cross-project systems.

The Nexus should remain visually useful after onboarding. It must not feel like a tutorial level the user never visits again.

## Nexus spaces

Recommended semantic areas:

- **Project Core** — create/link/import workspaces and enter project ships.
- **Crew Hall** — create/manage crew and character packs.
- **Communications** — adapters, capability status and observation permissions.
- **Archive** — recordings/replays/history.
- **Achievement/Chronicle area** — global statistics and milestones.
- **Settings sanctum/console** — application preferences, privacy, notifications, audio, language.
- **Social/lounge areas** — idle crew behavior.

The exact fantasy naming belongs to theme/content work; semantic functions should remain stable.

## Project ships

Each workspace becomes a continuous editable ship/station. A ship can be small and cozy with one or two agents or expand to many rooms and dozens of crew assignments.

A workspace may contain multiple repositories/folders. The ship represents the workspace, not necessarily one Git repository.

## World layer model

A practical isometric scene will likely need ordered layers such as:

```text
background/space
floor
floor decals/effects
walls/large architecture
low props
characters
stations/foreground props
high foreground/roof pieces
particles/overlays
selection/debug overlays
```

Exact sorting implementation is part of the world-engine plan, but visual occlusion must remain correct as characters move around objects.

## Navigation

Characters move between semantic destinations selected by the mapping system.

Requirements:

- pathfinding operates on valid walkable/navigation data;
- stations expose approach/interaction points;
- doors/room transitions remain traversable;
- editor changes trigger navigation validation/update;
- unreachable target falls back safely and reports a diagnostic;
- multiple agents should not permanently deadlock each other;
- movement should avoid visibly walking through major props/walls.

## Camera

Perspective is fixed in v1. Required camera behavior:

- drag/pan;
- smooth zoom;
- zoom-to-room/selection;
- follow character;
- overview framing;
- cinematic/autonomous framing;
- constraints preventing loss of the entire ship off-screen;
- reasonable persistence of user camera preference per workspace.

## World modes

### Normal

Minimal HUD, normal interactions, free camera.

### Focus Agent

Follow a selected crew member. Show lightweight contextual task/agent state.

### Overview

Frame the active ship and summarize activity distribution.

### Cinematic

Hide operational UI and use gentle camera behavior to showcase the living world.

### Operations

Expose denser professional information while keeping the world visible.

### Edit

Enable editor overlays, placement tools, validation and room/object manipulation.

## Idle world simulation

When a character is not assigned to active work, personality may drive safe cosmetic behaviors:

- walking to favorite spaces;
- sitting/resting;
- reading;
- observing space;
- talking to another idle character;
- using food/drink/ambient props;
- sleeping/resting animations;
- pet/robot interactions if assets exist.

Idle simulation stops/yields immediately when a real assignment needs the character. It never delays actual activity representation.

## Work transitions

When work begins:

1. assignment selected;
2. character gets a visible but non-intrusive task cue;
3. mapping selects semantic destination;
4. character leaves idle behavior;
5. character navigates to the station;
6. work animation/status begins;
7. significant state changes may change animation/destination;
8. completion/error/waiting state is represented;
9. assignment ends or remains waiting according to session state.

Fast event streams may require coalescing so characters do not sprint between rooms every few milliseconds. The presentation layer should prioritize understandable semantic phases over literal animation of every tiny tool call.

## High-density behavior

At high agent counts:

- reduce expensive ambient particles/secondary animations before losing semantic correctness;
- allow station sharing/queueing policies where visually sensible;
- aggregate small indicators in Overview/Operations;
- keep task/error/waiting states readable;
- preserve deterministic mapping/replay even if visual detail is LOD-reduced.

## Tutorial scene requirements

The shipping Nexus tutorial must demonstrate:

- moving camera;
- project concept;
- crew concept;
- harness capability concept without execution;
- simulator task;
- activity-to-room mapping;
- selected-agent HUD/timeline;
- Edit mode basics;
- returning to Nexus/project navigation.

No real provider is needed at any point.
