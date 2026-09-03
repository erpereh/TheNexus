# TheNexus

**TheNexus** is the working codename for a Windows-first, local-first desktop application that turns AI coding-agent activity into a living anime-inspired 2.5D isometric world.

Each workspace is represented as its own editable ship or station. Persistent crew characters visually embody agents while external harnesses such as ZCode, OpenCode, Codex and Cursor remain separate tools connected through passive-first adapters.

The product is being designed as a potentially public/commercial application from day one, while development-only character packs based on third-party anime IP remain isolated from the distributable core.

## Current status

The repository is currently in the **product architecture and specification phase**. Implementation should not begin until the design documentation in `/docs` has been reviewed and approved.

## Documentation

Start with [`docs/README.md`](docs/README.md).

The canonical product design specification is:

- [`docs/superpowers/specs/2026-09-03-the-nexus-design.md`](docs/superpowers/specs/2026-09-03-the-nexus-design.md)

Agent operating rules are defined in:

- [`AGENTS.md`](AGENTS.md)

## Core product principles

- Desktop-first: Tauri + React + TypeScript.
- Windows-first, cross-platform architecture.
- PixiJS-based 2.5D isometric world engine.
- Local-first and fully usable offline.
- Passive-first harness observation; control is explicit opt-in.
- No autonomous calls to real AI providers during development or testing.
- Harness integrations are capability-driven and adapter-based.
- The Nexus is a permanent central station and the onboarding world.
- Project workspaces become editable ships/stations.
- Persistent crew characters are separate from harness, model and session identity.
- Anime space-fantasy is the default art direction, with switchable themes.
- Product-grade QA is part of the definition of done, not a later phase.
