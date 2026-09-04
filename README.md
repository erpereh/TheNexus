# TheNexus

**TheNexus** is the working codename for a Windows-first, local-first desktop application that turns AI coding-agent activity into a living anime-inspired 2.5D isometric world.

Each workspace is represented as its own editable ship or station. Persistent crew characters visually embody agents while external harnesses such as ZCode, OpenCode, Codex and Cursor remain separate tools connected through passive-first adapters.

The product is being designed as a potentially public/commercial application from day one, while development-only character packs based on third-party anime IP remain isolated from the distributable core.

## Current status

Implementation has started on the `agent/glm-autonomous-v1` branch following the canonical design specification and the phased roadmap. The foundation (workspace, contracts, simulator, bridge, persistence, replay, adapters, i18n) plus the first visual vertical slice (PixiJS world renderer, deterministic demo ship, simulator-driven world session, desktop world surface) are in place; see `docs/execution/progress.md` and `docs/execution/acceptance-checklist.md` for verified status.

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

## Repository layout

```text
apps/desktop               Tauri 2 + React + TypeScript desktop shell
packages/contracts         Provider-neutral schemas/types (events, capabilities)
packages/simulator         Deterministic Harness Simulator scenarios
packages/bridge            Normalized in-process event bus
packages/world-engine      Isometric core (core/) + PixiJS renderer (render/)
packages/mapping           Semantic activity -> room/station mapping engine
packages/crew-simulation   Persistent crew assignment + Guest fallback
packages/runtime           Demo ship + deterministic world-session orchestrator
packages/asset-system      Theme runtime + default space-fantasy theme
packages/replay-engine     Deterministic record/replay projection
packages/persistence       SQLite storage, migrations, redaction
packages/adapter-sdk       Passive-first adapter contracts + conformance suite
packages/adapter-*         Generic/ZCode/OpenCode/Codex/Cursor fixture adapters
packages/i18n              English + Spanish catalogs
docs/                      Canonical design, architecture and execution docs
```

## Requirements

- Windows 10/11 with WebView2 runtime.
- Node.js >= 22 and pnpm 11 (`npm install -g pnpm`).
- Rust stable with the MSVC toolchain (`rustup` default `stable-msvc`) plus
  Visual Studio C++ Build Tools.

## Setup

```bash
pnpm install
```

## Verification commands

Run from the repository root:

```bash
pnpm format:check   # Prettier style gate
pnpm lint           # ESLint across all packages
pnpm typecheck      # TypeScript strict mode, all packages
pnpm test           # Vitest unit/contract tests
```

## Run and build

```bash
pnpm dev            # Launch the Tauri desktop app in development mode
pnpm build          # Build all packages, then the desktop production build
```

The dev app is fully offline. The only data source wired up so far is the
built-in deterministic Harness Simulator; no AI provider, model API or
network service is contacted.

## Safety note

Autonomous development and testing in this repository must never launch or
query a real AI harness/provider. All harness behavior is exercised through
the Harness Simulator, fixtures and contract tests. Real-provider validation
is a manual, explicit human step.
