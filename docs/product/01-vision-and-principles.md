# Vision and Product Principles

## Vision

TheNexus makes AI-agent development feel like commanding a living anime space-fantasy crew rather than watching opaque terminal sessions.

The product should create a clear emotional and operational link between:

- real projects;
- real tasks;
- real agent activity;
- persistent crew characters;
- evolving project ships;
- historical progress.

The world is not decoration around a dashboard. The world is the primary interface, with professional controls and diagnostics available contextually.

## User promise

A user should be able to open TheNexus and answer, at a glance:

- Which projects are active?
- Which agents are working?
- What kind of work are they doing?
- Which agent needs attention?
- What finished recently?
- Where did an error happen?
- How has this project evolved over time?

And when they do not need operational detail, they should be able to hide the HUD and simply watch their crew live and work inside the ship.

## Product principles

### 1. Do not replace the user's harnesses

TheNexus exists beside ZCode, OpenCode, Codex, Cursor and future tools. It observes them through adapters and only controls them when an integration supports it and the user explicitly enables that capability.

### 2. Characters outlive models

A character is persistent. Models, harnesses, sessions and tasks are temporary assignments. This makes the crew meaningful even as the AI tooling ecosystem changes.

### 3. Projects become places

A project is not just an item in a sidebar. It is a ship/station with rooms, history, crew assignments, achievements, customization and a visual identity.

### 4. The Nexus is home

The Nexus is the first experience, the tutorial environment and the permanent central station connecting every project, crew member and configuration surface.

### 5. Useful without providers

The first-run tutorial, demo worlds, mapping system, replay and QA must work through the Harness Simulator. No provider connection is required to understand or enjoy the product.

### 6. Passive-first and private

Detection is not permission. Observation is scoped. Raw sensitive data is opt-in. Control is disabled by default. Cloud is not required.

### 7. Anime identity without locking the renderer to one skin

The official starting identity is anime space-fantasy, but semantic world concepts are theme-independent. Future cyberpunk, cozy, industrial or minimalist themes should be possible without rewriting activity logic.

### 8. Game mechanics support work, never obstruct it

Progression can reward work with statistics, cosmetics, achievements and visual evolution. It must never introduce artificial grind, currencies or mechanics required to operate real agents.

### 9. Explainability over magic

When the system decides that an agent should move to a room, choose a station or play an animation, the Mapping Debugger must be able to explain why.

### 10. Product quality before feature count

The product should prefer fewer systems that are visually and technically coherent over a huge list of half-finished features. A compiling screen is not a completed feature.

## Target user

Initial target users are developers who:

- use one or more AI coding harnesses;
- run several tasks or subagents concurrently;
- care about understanding and monitoring agent work;
- enjoy highly customized desktop experiences;
- are comfortable with local developer tooling;
- value privacy and local-first workflows.

The product should remain understandable to a user who is not interested in the game systems: Operations mode and contextual panels must still provide a serious tool.

## Success criteria

The design succeeds when:

- the user can understand active agent state without reading raw logs;
- the app remains pleasant to keep open all day;
- changing harnesses does not invalidate crew history;
- adding a new adapter does not require modifying the world engine;
- project worlds remain coherent with many simultaneous agents;
- the editor makes personalization possible without requiring asset/code expertise;
- replay and simulation make debugging independent of provider access;
- the product can evolve into a public/commercial application without replacing its core architecture.
