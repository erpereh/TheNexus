# Asset Pipeline, Provenance and IP Policy

## Objective

The asset pipeline must support high visual quality without making the application dependent on an external AI image provider or introducing untracked licensing risk.

## Autonomous-development rule

During autonomous implementation, agents may use image/asset-generation capabilities only when they are already natively available inside the active development environment and do not require:

- another provider account;
- another API key;
- paid credits;
- free external model quota;
- a browser login;
- user credentials.

If such capability is not available, development must continue using local/procedural/vector/placeholder-compatible pipelines and leave assets replaceable. Agents must not discover and consume a third-party image API on their own.

## Pipeline responsibilities

The asset system should support:

- source/editable asset retention where practical;
- deterministic build/export processing;
- sprite-sheet/atlas assembly;
- crop/trim;
- scaling;
- transparency validation;
- image optimization;
- metadata/manifest generation;
- contact-sheet generation;
- anchor/offset validation;
- theme packaging;
- Character Pack packaging;
- blueprint previews;
- provenance records.

## Procedural/local asset capabilities

Useful non-AI asset generation includes:

- SVG/vector UI and icon generation;
- procedural space backgrounds/starfields;
- particle textures;
- simple runes/hologram glyphs;
- tile/shape variations;
- palette transforms;
- shadows/glows/effect masks;
- contact sheets and preview renders;
- sprite atlas packing.

These tools reduce dependence on one-off manually exported images.

## Character Pack QA

Automated validation should verify:

- manifest schema/version;
- required animations;
- required directions;
- frame dimensions/counts;
- asset existence;
- alpha/transparency expectations;
- anchor bounds;
- unreasonable file sizes;
- duplicate/missing frames where detectable;
- loadability in the renderer.

Visual QA should render contact sheets showing all directions and animations at consistent scale.

## World asset QA

Generated galleries/contact sheets should make it easy to inspect:

- floor/wall seams;
- object scale consistency;
- station interaction points;
- theme variants;
- prop bounding boxes;
- clipping;
- occlusion behavior;
- zoom interpolation;
- particle intensity.

## Provenance file

Distributable third-party assets require a repository record such as `ASSET_PROVENANCE.md` containing:

- asset/path;
- author/source;
- source URL when applicable;
- license;
- modifications;
- attribution requirements;
- whether included in distributable builds.

Do not rely on memory or comments hidden inside asset folders.

## Allowed external assets

For official/distributable builds, only use assets whose license is clearly compatible with the intended distribution/commercial model, for example appropriately applied permissive/CC0/public-domain assets.

Do not assume an image found on the web is reusable.

When license terms are unclear, do not ship the asset.

## Third-party anime IP

Development-only packs based on known anime characters are a local testing/customization concern, not official product content.

Rules:

- isolate under a development-only/custom-content boundary;
- never make Nexus/tutorial functionality depend on them;
- exclude them from public/commercial distribution artifacts;
- do not rip sprite sheets/assets from commercial games, episodes, manga or fan sites for redistribution;
- do not put third-party logos/branding into official product identity;
- keep removal possible without code changes.

Selected development references currently include characters from Dragon Ball, Kimetsu no Yaiba, Jujutsu Kaisen and One Piece.

## Official character content

The shippable application must contain original anime-inspired characters with enough animation coverage for tutorial, idle simulation and core activities.

Original designs should have their own consistent visual identity rather than being near-copies of specific copyrighted characters.

## Importable user content

The product may support user-imported local Character Packs/themes/blueprints. The import system is content-agnostic, but community/distribution policy can be defined separately if a public sharing platform is introduced.

Imported packs are treated as untrusted declarative data; no embedded executable scripts run automatically.

## Build separation

Release tooling should make asset inclusion explicit, e.g. official assets and development-only local packs are separate inputs. A release build should not accidentally include development packs because they happen to exist on a developer machine.

## Asset completion standard

Do not declare a user-facing scene complete when it still visibly depends on debug rectangles, broken sprite anchors, inconsistent perspective or mismatched art scales. Temporary assets are acceptable during construction, but final acceptance requires explicit visual review of the shipping scene.
