import { Container } from 'pixi.js';

/**
 * Ordered scene layers for the isometric world. Paint order back-to-front:
 * background (screen-space starfield) → world (iso entities, depth-sorted
 * via `zIndex = depthKeyOf(...)` with `sortableChildren`) → hud
 * (screen-space selection/perf overlays).
 *
 * The 8 semantic `DEPTH_LAYERS` biases live inside the z-order keys; these
 * three pixi containers are the only structural layers, keeping reordering
 * to a single container's sort pass.
 */
export interface WorldLayers {
  background: Container;
  world: Container;
  hud: Container;
}

export function createWorldLayers(): WorldLayers {
  const background = new Container();
  background.label = 'background';
  background.cullableChildren = false;

  const world = new Container();
  world.label = 'world';
  world.sortableChildren = true;
  world.cullableChildren = true;

  const hud = new Container();
  hud.label = 'hud';
  hud.cullableChildren = false;

  return { background, world, hud };
}
