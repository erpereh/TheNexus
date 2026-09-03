# TheNexus Documentation

This directory is the canonical documentation set for TheNexus. It is intentionally split by concern so product, architecture, game systems, art, quality and platform decisions can evolve without becoming one unmaintainable document.

## Read this first

1. [`superpowers/specs/2026-09-03-the-nexus-design.md`](superpowers/specs/2026-09-03-the-nexus-design.md) — canonical end-to-end design specification.
2. [`product/01-vision-and-principles.md`](product/01-vision-and-principles.md) — product identity and non-negotiable principles.
3. [`product/02-product-requirements.md`](product/02-product-requirements.md) — functional and non-functional requirements.
4. [`architecture/01-system-architecture.md`](architecture/01-system-architecture.md) — package and runtime architecture.
5. [`quality/01-testing-and-quality-bar.md`](quality/01-testing-and-quality-bar.md) — definition of done and verification strategy.
6. [`../AGENTS.md`](../AGENTS.md) — rules that every coding agent must follow.

## Autonomous agent execution

- [`agents/README.md`](agents/README.md) — execution documentation index.
- [`agents/zcode-runbook.md`](agents/zcode-runbook.md) — human setup for a long ZCode/GLM-5.3-Flash run.
- [`agents/zcode-master-prompt.md`](agents/zcode-master-prompt.md) — primary coordinator prompt.
- [`execution/acceptance-checklist.md`](execution/acceptance-checklist.md) — evidence-based Goal Mode completion contract.
- [`execution/progress.md`](execution/progress.md) — durable autonomous progress ledger.
- [`superpowers/plans/2026-09-03-bootstrap-core.md`](superpowers/plans/2026-09-03-bootstrap-core.md) — first detailed implementation plan.

## Product

- [`product/01-vision-and-principles.md`](product/01-vision-and-principles.md)
- [`product/02-product-requirements.md`](product/02-product-requirements.md)
- [`product/03-user-experience.md`](product/03-user-experience.md)

## Architecture

- [`architecture/01-system-architecture.md`](architecture/01-system-architecture.md)
- [`architecture/02-event-model-and-mapping.md`](architecture/02-event-model-and-mapping.md)
- [`architecture/03-harness-adapters.md`](architecture/03-harness-adapters.md)
- [`architecture/04-storage-privacy-security.md`](architecture/04-storage-privacy-security.md)

## Game systems

- [`game/01-world-and-nexus.md`](game/01-world-and-nexus.md)
- [`game/02-crew-and-character-system.md`](game/02-crew-and-character-system.md)
- [`game/03-ship-editor-and-themes.md`](game/03-ship-editor-and-themes.md)

## Art and assets

- [`art/01-art-direction.md`](art/01-art-direction.md)
- [`art/02-asset-pipeline-and-ip.md`](art/02-asset-pipeline-and-ip.md)
- [`../ASSET_PROVENANCE.md`](../ASSET_PROVENANCE.md) — official third-party asset license/provenance register.

## Quality and platform

- [`quality/01-testing-and-quality-bar.md`](quality/01-testing-and-quality-bar.md)
- [`platform/01-windows-distribution.md`](platform/01-windows-distribution.md)
- [`roadmap/01-implementation-phases.md`](roadmap/01-implementation-phases.md)

## Project conventions

- [`decisions/decision-log.md`](decisions/decision-log.md) — accepted architectural/product decisions.
- [`glossary.md`](glossary.md) — canonical terminology.

## Documentation rules

- Treat the canonical design spec as the source of truth unless a later accepted ADR/decision explicitly supersedes it.
- Update documentation in the same change that alters public behavior, event schemas, persistence formats or adapter contracts.
- Never silently change a non-negotiable safety rule.
- Keep implementation details out of product documents unless they affect user-visible behavior.
- Prefer diagrams, examples and explicit invariants over vague prose.
