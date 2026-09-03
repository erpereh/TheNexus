# Crew and Character System

## Identity model

A crew character is a persistent user-owned identity. It must remain independent from:

- harness;
- model;
- session;
- agent process;
- task;
- project assignment.

The same character can work through ZCode today and Codex tomorrow without losing history.

## Crew data

A crew member may include:

- stable character ID;
- display name;
- Character Pack reference;
- portrait/thumbnail;
- role/title;
- specialties;
- level/experience;
- project/task/session statistics;
- personality traits;
- favorite rooms/stations;
- social affinity metadata;
- cosmetic unlocks;
- created/last-used timestamps;
- optional notes/tags.

## Assignment model

Assignments bind an observed normalized agent/session/task to a visual crew member.

Selection policy:

1. honor an explicit manual/pinned assignment when valid;
2. prefer available crew associated with the workspace;
3. consider specialty/role hints when available;
4. consider personality preferences only as a soft visual preference;
5. otherwise select an available crew member deterministically;
6. create/use a Guest Agent when no persistent crew is available.

Assignment logic must be deterministic enough to test and replay.

## Guest Agents

Guest Agents exist so observed subagents are always representable.

Properties:

- temporary visual identity;
- generated from a safe generic guest pack/pool;
- no requirement for permanent progression;
- can later be converted to permanent crew by the user;
- should not collide visually/numerically when many appear simultaneously.

## Personality simulation

Personality is a local simulation layer, not an AI service.

Possible traits:

- social / solitary;
- calm / energetic;
- curious;
- organized;
- night-oriented / day-oriented;
- celebratory;
- bookish;
- observatory-loving;
- lounge-loving.

Traits may influence only cosmetic behaviors, such as idle destination weighting, idle animation choice and deterministic ambient conversations.

They must never:

- alter a real task;
- delay representation of work;
- choose/send provider prompts;
- cancel work;
- change harness settings;
- consume model quota.

## Social layer

Light social metadata can make the crew feel persistent:

- affinity score/history;
- number of shared sessions/projects;
- favorite idle pairings;
- deterministic conversation snippets selected from localized content pools;
- shared achievement moments.

Avoid deep Sims-like needs in v1. No hunger, mood or sleep meter may gate professional behavior.

## Progression

Progress comes from observed/simulated task history and should remain cosmetic/statistical.

Possible metrics:

- tasks completed;
- sessions participated in;
- project count;
- time active;
- review/test/research/coding activity counts;
- errors recovered from;
- subagents accompanied;
- user-defined specialty XP.

Possible rewards:

- level labels;
- badges;
- animation variants;
- portraits/cosmetics;
- room trophies;
- achievement decorations.

No currency grind is required to unlock operational features.

## Character Pack contract

A Character Pack is declarative and versioned.

Expected contents:

```text
character-pack/
  manifest.json
  portrait.webp
  thumbnail.webp
  sprites/
    idle.*
    walk.*
    coding.*
    researching.*
    testing.*
    planning.*
    talking.*
    sitting.*
    sleeping.*
    celebrating.*
    error.*
  optional/
    special animations/effects
```

Exact atlas layout can vary if the manifest describes it.

## Direction model

Baseline directions:

- NE
- NW
- SE
- SW

Animation fallback should be explicit. For example, a missing `celebrating.NW` can use a configured mirrored or generic fallback only if the manifest/runtime supports that behavior safely.

## Asset Studio

The in-app tool should support:

- pack creation/duplication;
- portrait/thumbnail import;
- sprite-sheet import;
- frame slicing;
- animation/direction mapping;
- FPS and looping;
- scale;
- anchor/pivot tuning;
- per-animation offsets;
- preview;
- in-world simulator test;
- manifest validation;
- export/import.

## Development-only anime packs

The local development build may use isolated reference packs based on selected characters from Dragon Ball, Kimetsu no Yaiba, Jujutsu Kaisen and One Piece.

Initial target set discussed for local development:

- Goku;
- Vegeta;
- Tanjiro;
- Nezuko;
- Gojo;
- Yuji;
- Luffy;
- Zoro.

These are not official shippable product assets. Keep them structurally isolated so public/commercial builds can exclude them completely.

Do not rip/download copyrighted sprite sheets from games/anime for redistribution.

## Official launch assets

The distributable app must include original anime-inspired crew sufficient to demonstrate the full system even when all development-only IP packs are absent.

The exact number can be adjusted during asset production, but the Nexus tutorial and first project ship must never depend on third-party IP.

## Tests

Cover:

- deterministic assignment;
- pinned assignment;
- no-available-crew guest fallback;
- assignment release;
- concurrent subagents;
- save/load history;
- character pack validation;
- missing animation fallback;
- personality idle-selection determinism;
- guarantee that personality code has no provider-control dependency;
- conversion Guest -> permanent crew.
