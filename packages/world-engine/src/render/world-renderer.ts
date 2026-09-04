import { Application } from 'pixi.js';
import type { ThemeManifest } from '@thenexus/contracts';
import { createThemeRuntime, type ThemeRuntime } from '@thenexus/asset-system';
import { DEFAULT_THEME } from '@thenexus/asset-system';
import { AnimationStateMachine } from '../core/animation-state';
import { slotForActivity } from '../core/activity-map';
import { gridToScreen, screenToWorld, type CameraView, type Viewport } from '../core/iso';
import { PerfMonitor } from '../core/perf';
import type { Cell } from '../core/grid';
import type { WorldSnapshot } from '../core/world-sim';
import { Background } from './background';
import { createWorldLayers, type WorldLayers } from './layers';
import { ensureCullerRegistered } from './culling';
import { bakeShipStructure } from './room-graphics';
import { buildStation, type StationNode } from './station-graphics';
import {
  accentForId,
  createCharacterNode,
  type CharacterNode,
  type CharacterStatus,
} from './character-graphics';
import type { CharacterPresentation, ShipLayoutView } from './ship-view';

/**
 * PixiJS v8 world renderer. Owns the Application lifecycle, ordered layers,
 * camera transform, character pooling/smoothing, per-character animation
 * state machines, station idle motion, viewport culling, hidden-window
 * render suspension and dev perf instrumentation.
 *
 * Data flow per tick (driven by the host through `onTick`, which advances
 * the session and calls `setFrame`): smooth character positions toward the
 * latest snapshot cells, advance animation machines, refresh depth keys,
 * pump station effects. The simulation itself stays authoritative and
 * discrete; all smoothing here is presentation-only.
 */

export interface RendererOptions {
  theme: ThemeManifest;
  /** Called first every tick with clamped render dt; host advances session. */
  onTick?: (dtMs: number) => void;
  accentPalette?: readonly number[];
}

export interface RendererPerf {
  fps: number;
  frameP50Ms: number;
  frameP95Ms: number;
  characters: number;
}

const POSITION_SMOOTHING_RATE = 12;
const MAX_TICK_DT_MS = 100;
const PICK_RADIUS_PX = 26;
const DEFAULT_ACCENTS = [0x7c5cff, 0x54e0ff, 0x66f0d0, 0xc9a3ff, 0xff9e6b, 0xff7eb0] as const;

interface TrackedCharacter {
  node: CharacterNode;
  machine: AnimationStateMachine;
  accent: number;
  shown: { x: number; y: number };
  initialized: boolean;
}

function statusFor(activity: CharacterPresentation['activity'], waiting: boolean): CharacterStatus {
  if (activity === 'error') return 'error';
  if (activity === 'completed') return 'completed';
  if (waiting) return 'waiting';
  return 'active';
}

export class WorldRenderer {
  private readonly app: Application;
  private readonly layers: WorldLayers;
  private readonly background: Background;
  private readonly theme: ThemeRuntime;
  private readonly perf = new PerfMonitor(180);
  private readonly characters = new Map<string, TrackedCharacter>();
  private readonly stations: StationNode[] = [];
  private readonly opts: RendererOptions;

  private layout: ShipLayoutView | null = null;
  private snapshot: WorldSnapshot | null = null;
  private presentation = new Map<string, CharacterPresentation>();
  private camera: CameraView = { center: { x: 0, y: 0 }, zoom: 1 };
  private viewport: Viewport = { width: 800, height: 600 };
  private selectedId: string | null = null;
  private timeMs = 0;
  private userRunning = true;
  private destroyed = false;
  private readonly accents: readonly number[];

  private readonly onVisibility = (): void => {
    this.applyRunning();
  };

  private constructor(app: Application, opts: RendererOptions, theme: ThemeRuntime) {
    this.app = app;
    this.opts = opts;
    this.theme = theme;
    this.layers = createWorldLayers();
    this.background = new Background(theme);
    this.accents = opts.accentPalette ?? DEFAULT_ACCENTS;
    app.stage.addChild(this.layers.background, this.layers.world, this.layers.hud);
    this.layers.background.addChild(this.background.container);
  }

  static async create(canvas: HTMLCanvasElement, opts: RendererOptions): Promise<WorldRenderer> {
    ensureCullerRegistered();
    const app = new Application();
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    await app.init({
      canvas,
      width,
      height,
      backgroundAlpha: 1,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    const theme = createThemeRuntime(opts.theme, [DEFAULT_THEME]);
    const renderer = new WorldRenderer(app, opts, theme);
    renderer.background.redraw({ width, height });
    renderer.viewport = { width, height };
    document.addEventListener('visibilitychange', renderer.onVisibility);
    app.ticker.add((ticker) => {
      renderer.tick(Math.min(ticker.deltaMS, MAX_TICK_DT_MS));
    });
    renderer.applyRunning();
    return renderer;
  }

  /**
   * Nearest world character to a canvas CSS-pixel point, within a
   * zoom-compensated pick radius. Pure query — selection state is owned by
   * the host through `setSelected`.
   */
  pick(sx: number, sy: number): string | null {
    if (this.snapshot === null) return null;
    const world = screenToWorld({ x: sx, y: sy }, this.camera, this.viewport);
    let best: string | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    const pickRadius = PICK_RADIUS_PX / 32 / Math.max(0.01, this.camera.zoom);
    for (const character of this.snapshot.characters) {
      const tracked = this.characters.get(character.id);
      const pos = tracked !== undefined && tracked.initialized ? tracked.shown : character.cell;
      const dx = pos.x - world.x;
      const dy = pos.y - world.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= pickRadius && dist < bestDist) {
        best = character.id;
        bestDist = dist;
      }
    }
    return best;
  }

  setLayout(layout: ShipLayoutView): void {
    this.assertLive();
    this.layout = layout;
    this.layers.world.removeChildren();
    this.characters.clear();
    this.stations.length = 0;
    const baked = bakeShipStructure(layout);
    this.layers.world.addChild(baked.container);
    for (const station of layout.stations) {
      const node = buildStation(station);
      this.stations.push(node);
      this.layers.world.addChild(node.container);
    }
  }

  setFrame(
    snapshot: WorldSnapshot,
    presentation: Map<string, CharacterPresentation>,
    camera: CameraView,
    viewport: Viewport,
  ): void {
    this.snapshot = snapshot;
    this.presentation = presentation;
    this.camera = { center: { ...camera.center }, zoom: camera.zoom };
    this.viewport = { ...viewport };
  }

  setSelected(id: string | null): void {
    this.selectedId = id;
  }

  resize(viewport: Viewport): void {
    this.assertLive();
    this.viewport = { ...viewport };
    this.app.renderer.resize(Math.max(1, viewport.width), Math.max(1, viewport.height));
    this.background.redraw(this.viewport);
  }

  setRunning(running: boolean): void {
    this.userRunning = running;
    this.applyRunning();
  }

  perfSnapshot(): RendererPerf {
    return {
      fps: this.app.ticker.FPS,
      frameP50Ms: this.perf.p50(),
      frameP95Ms: this.perf.p95(),
      characters: this.characters.size,
    };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    document.removeEventListener('visibilitychange', this.onVisibility);
    for (const tracked of this.characters.values()) tracked.node.destroy();
    this.characters.clear();
    this.app.destroy();
  }

  private applyRunning(): void {
    const running = this.userRunning && document.hidden !== true;
    if (running) this.app.ticker.start();
    else this.app.ticker.stop();
  }

  private tick(dtMs: number): void {
    if (this.destroyed) return;
    this.perf.beginFrame();
    if (this.opts.onTick !== undefined) this.opts.onTick(dtMs);
    this.timeMs += dtMs;
    this.updateCameraTransform();
    this.updateStations();
    this.updateCharacters(dtMs);
    this.perf.endFrame();
  }

  private updateCameraTransform(): void {
    const cam = gridToScreen(this.camera.center.x, this.camera.center.y);
    const zoom = this.camera.zoom;
    this.layers.world.position.set(
      -cam.x * zoom + this.viewport.width / 2,
      -cam.y * zoom + this.viewport.height / 2,
    );
    this.layers.world.scale.set(zoom);
  }

  private updateStations(): void {
    for (const station of this.stations) station.update(this.timeMs);
  }

  private updateCharacters(dtMs: number): void {
    const snapshot = this.snapshot;
    if (snapshot === null || this.layout === null) return;
    const seen = new Set<string>();
    const rate = 1 - Math.exp(-POSITION_SMOOTHING_RATE * (dtMs / 1000));
    for (const character of snapshot.characters) {
      seen.add(character.id);
      let tracked = this.characters.get(character.id);
      if (tracked === undefined) {
        const node = createCharacterNode(character.id);
        const accent = accentForId(
          character.id,
          this.presentation.get(character.id)?.isGuest === true ? [0x9aa7d6] : this.accents,
        );
        tracked = {
          node,
          machine: new AnimationStateMachine(),
          accent,
          shown: { x: character.cell.x, y: character.cell.y },
          initialized: false,
        };
        this.characters.set(character.id, tracked);
        this.layers.world.addChild(node.container);
      }
      const target = { x: character.cell.x, y: character.cell.y };
      if (!tracked.initialized) {
        tracked.shown = { ...target };
        tracked.initialized = true;
      } else {
        tracked.shown = {
          x: tracked.shown.x + (target.x - tracked.shown.x) * rate,
          y: tracked.shown.y + (target.y - tracked.shown.y) * rate,
        };
      }
      const feet = gridToScreen(tracked.shown.x + 0.5, tracked.shown.y + 0.5);
      tracked.node.setFeet(feet.x, feet.y);
      const depthCell: Cell = {
        x: Math.floor(tracked.shown.x + 0.5),
        y: Math.floor(tracked.shown.y + 0.5),
      };
      tracked.node.setDepth(depthCell);

      const info = this.presentation.get(character.id);
      const activity = info?.activity ?? 'idle';
      const slot = slotForActivity(activity);
      const status = statusFor(activity, info?.waiting ?? character.waiting);
      tracked.machine.setFacing(character.facing);
      tracked.machine.setMoving(character.moving);
      tracked.machine.setIntent(slot);
      const frame = tracked.machine.advance(dtMs);
      tracked.node.update(
        {
          slot: frame.slot,
          mirrored: frame.mirrored,
          status,
          moving: character.moving,
          selected: this.selectedId === character.id,
          accent: tracked.accent,
          isGuest: info?.isGuest ?? false,
        },
        this.timeMs,
      );
    }
    for (const [id, tracked] of this.characters) {
      if (!seen.has(id)) {
        this.layers.world.removeChild(tracked.node.container);
        tracked.node.destroy();
        this.characters.delete(id);
      }
    }
  }

  private assertLive(): void {
    if (this.destroyed) throw new Error('WorldRenderer is destroyed');
  }
}
