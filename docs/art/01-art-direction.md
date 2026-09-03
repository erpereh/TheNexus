# Art Direction

## Official visual identity

The default art direction is **anime space-fantasy**: advanced technology expressed through magical visual language.

The target feeling is not generic sci-fi and not medieval fantasy. It should feel like a JRPG/anime command station suspended in space, where crystals, runes and constellations perform technological functions.

## Core visual pillars

### Celestial architecture

- sweeping windows into space;
- starfields, planets, nebulae and constellations;
- elegant geometric architecture;
- layered platforms and luminous inlays;
- temple-like silhouettes interpreted as spacecraft interiors.

### Arcane technology

- crystal cores;
- runic holograms;
- floating panels/sigils;
- magical circuitry;
- constellation-like network lines;
- energy effects that remain readable rather than noisy.

### Anime character readability

Characters should remain easy to identify at normal camera scale.

- expressive silhouettes;
- recognizable hair/clothing shapes;
- readable portraits;
- controlled chibi/stylized proportions suited to isometric sprites;
- consistent scale across packs;
- work animations readable without relying on tiny text.

### Professional clarity

The application is still a work tool. Decorative effects must not obscure:

- selected character;
- error/waiting state;
- station interaction;
- navigation;
- HUD text;
- editor selection/placement boundaries.

## Isometric rules

The final asset bible should lock:

- camera/isometric projection convention;
- tile/grid unit;
- character footprint;
- standard floor height;
- wall height ranges;
- sprite anchor convention;
- station interaction-point convention;
- shadow direction;
- light direction assumptions;
- common object scale reference.

These values must be decided before large-scale asset production so independently produced rooms and characters do not drift in scale/perspective.

## Character asset targets

Baseline Character Pack:

- portrait;
- thumbnail;
- four isometric directions;
- idle;
- walk;
- coding/work;
- research;
- testing;
- planning;
- talking;
- sitting/rest;
- sleep/rest variant;
- celebrate;
- error;
- optional personality/special animations.

Sprites must be inspected at both native/close zoom and normal in-world scale.

## Room storytelling

Each semantic room should communicate function before reading labels.

Examples:

- engineering/workshop: concentrated terminals, arcane workbench energy, code-like rune flows;
- laboratory/testing: diagnostic crystals, controlled experiments, test apparatus;
- library: floating books/data tablets, archival constellations;
- observatory/research: large space views, star maps, remote-sensing holograms;
- command/planning: central tactical table / constellation map;
- communications: signal rings, portals, linked constellation network;
- lounge: softer light, seating, food/drink, plants or fantasy equivalents.

## Effects budget

Effects should have an intensity hierarchy:

1. ambient — subtle particles, slow background motion;
2. activity — station-specific feedback;
3. important state — waiting/error/completion;
4. rare celebration/tutorial — larger emphasis.

Do not run every room at maximum particle intensity simultaneously.

## UI language

The React HUD should echo the world rather than imitate a generic fantasy game menu.

Recommended character:

- refined panels with subtle arcane geometry;
- high readability and modern spacing;
- restrained glow;
- clear status hierarchy;
- simple iconography;
- world-inspired accents without ornate borders around every element.

Operations mode can be denser, but must remain visually part of the same product.

## Theme compatibility

Default assets should be referenced through semantic roles rather than hard-coded filenames scattered through gameplay code. Theme swapping depends on a stable semantic asset vocabulary.

## Required art bible deliverable

Before broad asset production, implementation agents should create and maintain a concrete `ART_BIBLE.md` or equivalent containing actual chosen numbers/examples for:

- projection;
- tile dimensions;
- sprite dimensions;
- anchor conventions;
- palette/design tokens;
- light/shadow rules;
- animation FPS ranges;
- effect intensity;
- icon sizes;
- export formats/compression;
- naming conventions;
- approved examples/contact sheets.

This document defines direction; the future art bible defines production measurements.
