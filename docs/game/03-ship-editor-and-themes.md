# Ship Editor and Themes

## Editor model

The editor is hybrid: fast smart modules for most users, plus deep interior customization and an Empty Module for advanced layouts.

The goal is to let users make every project ship feel distinct without requiring them to understand rendering coordinates, pathfinding graphs or asset manifests.

## Smart modules

A room module is more than art. It contains semantic and structural metadata.

A module may define:

- semantic room type;
- footprint;
- floor/wall defaults;
- door/connection points;
- walkable/navigation geometry;
- compatible stations;
- default station placements;
- camera focus bounds;
- lighting/effect defaults;
- theme asset references;
- validation rules.

Initial default-theme modules should cover at least:

- engineering/workshop;
- library/reading;
- laboratory/testing;
- command/planning;
- communications;
- observatory/research;
- crew/lounge;
- core/archive/system area;
- Empty Module.

## Editing operations

Expected operations:

- add/remove/duplicate module;
- move module when topology permits;
- place/move/rotate/delete/duplicate interior props;
- choose floors/walls/windows;
- place/remove stations;
- place lighting/effects/decoration;
- change room metadata/name;
- grid snap;
- small free offsets for decorations;
- undo/redo;
- multi-select where useful;
- preview agent navigation.

## Validity model

The editor must continuously or on-demand validate:

- room connectivity;
- door alignment/entrances;
- walkable regions;
- station approach points;
- blocked paths;
- overlapping collision-critical props;
- invalid asset references;
- mapping availability/fallbacks.

The user may be allowed to save a visually unfinished layout, but runtime-critical invalidity must degrade safely and be clearly explained.

## Navigation rebuilding

Editor changes should update/rebuild only affected navigation regions when practical. Large worlds should not freeze after every decoration move.

Decorative non-collision objects should not trigger expensive navigation rebuilds.

## Blueprints

Blueprints are reusable user-authored room/module configurations.

A blueprint package should include:

- format version;
- semantic room type;
- module dimensions/topology metadata;
- objects/stations and relative transforms;
- theme-independent semantic references where possible;
- optional theme-specific overrides;
- preview/thumbnail;
- required asset dependencies.

Blueprint imports are untrusted data and use the same archive/path validation rules as other asset imports.

## Ship export/import

A ship export should preserve:

- ship metadata;
- room/module topology;
- decorations/stations;
- mapping overrides scoped to that ship if applicable;
- theme selection/overrides;
- references to required custom assets;
- format/version metadata.

It should not embed source repositories or secrets.

## Theme architecture

Theme semantics and world semantics are separate.

Example:

```text
semantic room: laboratory
Default Space-Fantasy -> Astral Laboratory
Cyberpunk            -> QA Simulation Chamber
Cozy                  -> Testing Studio
Industrial            -> Diagnostics Bay
```

The activity mapper selects `laboratory`; the theme selects its concrete presentation.

## Theme package

A theme may provide:

- design tokens/colors;
- floor/wall/door variants;
- room skins;
- station skins;
- props/decorations;
- particle/effect mappings;
- ambient background/environment;
- audio profile;
- optional UI skin tokens;
- module preview art.

Theme manifests must be versioned and declarative.

## Default theme

The initial official theme is anime space-fantasy:

- celestial architecture;
- crystals/energy cores;
- magical runes presented as technology;
- constellations;
- holographic magical interfaces;
- soft atmospheric particles;
- grand space views;
- expressive but readable environment lighting.

## Theme switching

Switching theme must preserve:

- ship topology;
- semantic room identity;
- station semantics;
- navigation;
- crew assignments;
- activity mappings;
- project history.

If a target theme lacks an equivalent asset, use a documented fallback rather than losing the object.

## Editor testing

Automated and visual tests should cover:

- placement/snapping;
- undo/redo;
- save/reload determinism;
- invalid topology;
- station reachability;
- large maps;
- rapid edit sequences;
- blueprint round-trip;
- corrupted package rejection;
- missing assets;
- theme switch round-trip;
- characters navigating layouts after edits;
- zoom/DPI interactions while editing.
