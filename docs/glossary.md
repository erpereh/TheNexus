# Glossary

## Adapter

A provider/harness-specific module that observes authorized external data, declares capabilities and translates provider-specific signals into normalized TheNexus events.

## Adapter SDK

The shared interfaces, schemas and conformance helpers used to implement adapters.

## Agent

A runtime work entity observed from a harness. An agent is not the same thing as a persistent Crew Character.

## Agent World Bridge

The local runtime boundary that manages adapter lifecycle, normalized-event ingestion, recording, capability status and optional explicitly enabled control dispatch.

## Assignment

A temporary binding between a normalized observed agent/session/task and a persistent Crew Character or Guest Agent.

## Blueprint

A reusable/exportable room or module configuration containing relative object/station placement and semantic metadata.

## Capability

A declared adapter feature such as observing sessions, tasks or tool calls, or optionally sending/cancelling tasks.

## Character Pack

A versioned declarative package containing a character portrait, sprites, animation definitions, directions and related metadata.

## Crew / Crew Character

A persistent visual identity owned by the user. Crew survives across harnesses, models, sessions and projects.

## Generic Adapter

A first-class adapter that ingests normalized or near-normalized events from future/custom harnesses through local file/JSONL/WebSocket/HTTP/hook-style sources.

## Guest Agent

A temporary visual identity used when a real observed agent/subagent needs representation but no persistent crew member is available.

## Harness

An external AI coding/agent tool such as ZCode, OpenCode, Codex or Cursor. TheNexus does not replace the harness.

## Harness Simulator

A deterministic local subsystem that generates realistic synthetic sessions, agents, events, errors and concurrency without calling real AI providers.

## Mapping

The rules that translate normalized semantic activity into room, station, animation and effect intents.

## Mapping Debugger

A diagnostic tool showing the full path from incoming event through normalization/classification/rule selection to room/station/animation.

## Nexus

The permanent central station of the application. It is also the first-run tutorial world and home for global systems.

## NexusEvent

The versioned provider-neutral normalized event consumed by bridge, replay, projectors and downstream world systems.

## Operations Mode

A world-visible mode with denser professional monitoring information such as tasks, timelines, errors and agent status.

## Project / Workspace

A user-defined group of one or more authorized folders/repositories that maps to a single project ship/station.

## Project Ship

The editable continuous 2.5D isometric world representing one workspace/project.

## Replay

Deterministic playback of previously recorded normalized activity without needing the original harness/provider to be running.

## Semantic Activity

A provider-neutral activity class such as coding, testing, researching, planning, waiting or error.

## Semantic Room Type

Provider/theme-independent room meaning such as laboratory, engineering, command or library. A theme chooses how it looks and what it is called visually.

## Station

An interactable world location where a character performs a mapped activity, such as a workstation, test bench or research console.

## Theme

A presentation package that changes world/UI assets and ambience while preserving semantic rooms, activities, topology and mappings.

## World Engine

The custom PixiJS-based 2.5D isometric rendering/simulation layer responsible for camera, navigation, characters, animation, sorting, interactions and theme presentation.
