// @thenexus/world-engine — headless simulation core + PixiJS render layer.
//
// Prefer the split entries: `@thenexus/world-engine/core` (Node-safe,
// pixi-free) and `@thenexus/world-engine/render` (browser canvas).
// The root entry re-exports both for existing consumers.

export * from './core';
export * from './render';
