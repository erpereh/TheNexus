import { CullerPlugin, extensions } from 'pixi.js';

/**
 * Viewport culling registration. `CullerPlugin` skips rendering for
 * offscreen containers marked `cullable`; static groups opt out of
 * recursive checks via `cullableChildren = false` to avoid bounds churn.
 */

let cullerRegistered = false;

/** Idempotent: safe to call once per renderer (and across StrictMode remounts). */
export function ensureCullerRegistered(): void {
  if (cullerRegistered) return;
  extensions.add(CullerPlugin);
  cullerRegistered = true;
}
