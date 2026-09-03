# Decision Log

This log captures approved product/architecture decisions from the design session. New decisions that materially change architecture, privacy, persistence or user-visible behavior should be added here or promoted into dedicated ADR files.

| ID | Decision | Status |
|---|---|---|
| D-001 | Build a desktop-first application with Tauri + React + TypeScript. | Accepted |
| D-002 | Use a 2.5D continuous isometric world with PixiJS and a custom World Engine. | Accepted |
| D-003 | Each workspace/project becomes its own editable ship/station. | Accepted |
| D-004 | A workspace may contain one or more repositories/folders. | Accepted |
| D-005 | The Nexus is the permanent central station and onboarding/tutorial environment. | Accepted |
| D-006 | Persistent crew characters are independent from harness, model, session and task identity. | Accepted |
| D-007 | Crew assignment supports automatic intelligent selection and manual pinning. | Accepted |
| D-008 | Guest Agents represent overflow/new subagents when persistent crew is unavailable. | Accepted |
| D-009 | Light deterministic personality/social simulation exists, but never affects actual agent execution. | Accepted |
| D-010 | Progression is cosmetic/statistical and never gates professional features. | Accepted |
| D-011 | Default art direction is anime space-fantasy. | Accepted |
| D-012 | Themes are switchable presentation layers and do not redefine semantic activity. | Accepted |
| D-013 | Ship editor is hybrid: smart modules + deep customization + Empty Module + Blueprints. | Accepted |
| D-014 | Camera orientation is fixed in v1; support pan, zoom, follow and room-detail zoom. | Accepted |
| D-015 | Primary UI model is world-first with contextual professional HUD. | Accepted |
| D-016 | Modes: Normal, Focus Agent, Overview, Cinematic, Operations and Edit. | Accepted |
| D-017 | Activity mapping is automatic by default and user-editable. | Accepted |
| D-018 | A Mapping Debugger explains event -> normalization -> activity -> rule -> room -> station -> animation. | Accepted |
| D-019 | Initial harness targets: ZCode, OpenCode, Codex, Cursor and Generic Adapter. | Accepted |
| D-020 | Integrations are capability-driven and passive-first. | Accepted |
| D-021 | Observer behavior is default; control is experimental and explicit opt-in. | Accepted |
| D-022 | Autonomous development/tests must never run real AI providers/models or consume their quota. | Accepted |
| D-023 | Harness Simulator, mocks, fixtures and replay are the required testing substitutes. | Accepted |
| D-024 | Product is local-first/offline, with architecture prepared for future cloud sync. | Accepted |
| D-025 | Default privacy posture uses explicit project/source authorization and no whole-PC scan. | Accepted |
| D-026 | Raw prompts, terminal output and file contents are opt-in data surfaces. | Accepted |
| D-027 | Store structured data in SQLite and larger assets/recordings in application-managed files where appropriate. | Accepted |
| D-028 | Historical retention is configurable; important recordings can be pinned. | Accepted |
| D-029 | Replay supports deterministic playback and 1x/2x/5x/10x/50x speeds. | Accepted |
| D-030 | Character Packs use four isometric directions and data-driven animation manifests. | Accepted |
| D-031 | Provide an in-app Character Asset Studio. | Accepted |
| D-032 | Development-only anime reference packs are isolated from official distributable assets. | Accepted |
| D-033 | Initial development references include selected characters from Dragon Ball, Kimetsu no Yaiba, Jujutsu Kaisen and One Piece. | Accepted |
| D-034 | Official/public builds must rely on original or properly licensed assets. | Accepted |
| D-035 | No autonomous external AI/image API usage; only already-native/no-extra-account capabilities may be used. | Accepted |
| D-036 | Windows is the v1 implementation/QA priority; architecture remains cross-platform-ready. | Accepted |
| D-037 | Optional tray/background operation; world rendering pauses/throttles when not visible. | Accepted |
| D-038 | Launch at startup exists but is off by default. | Accepted |
| D-039 | Audio exists but is optional and category-muteable. | Accepted |
| D-040 | Desktop notifications are configurable with restrained defaults. | Accepted |
| D-041 | English is source language and Spanish ships in v1 via i18n. | Accepted |
| D-042 | Quality bar includes automated tests, visual regression, manual visual QA, migration/import tests and stress testing. | Accepted |
| D-043 | Normal world target is 60 FPS; 100 agents is a usability stress target and 250 agents an extreme graceful-degradation scenario. | Accepted |
| D-044 | Produce Windows installer and portable build; updater may come later. | Accepted |
| D-045 | `TheNexus` / `Agent World` remains a codename and branding must be centralized. | Accepted |
| D-046 | After scoped implementation, autonomous work continues only on demonstrable quality improvements, not arbitrary feature creep. | Accepted |

## Change process

If a future change supersedes a decision:

1. add a new decision/ADR;
2. reference the superseded ID;
3. explain the reason and migration impact;
4. update the canonical design spec and affected domain docs;
5. include tests/migrations where behavior or persisted formats change.
