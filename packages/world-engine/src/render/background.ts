import { Container, Graphics } from 'pixi.js';
import type { ThemeRuntime } from '@thenexus/asset-system';
import type { Viewport } from '../core/iso';
import { themeColor } from '../core/theme-colors';

/**
 * Screen-space celestial backdrop: deep-space wash, deterministic starfield,
 * constellation line motifs and a soft nebula glow. Pure decoration —
 * redrawn only on resize. Star positions come from a fixed-seed LCG so every
 * launch looks identical (visual determinism; not part of sim guarantees).
 */

const STAR_COUNT = 220;
const CONSTELLATION_COUNT = 7;

function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export class Background {
  readonly container = new Container();
  private readonly graphics = new Graphics();
  private theme: ThemeRuntime;

  constructor(theme: ThemeRuntime) {
    this.theme = theme;
    this.container.label = 'background';
    this.container.addChild(this.graphics);
  }

  setTheme(theme: ThemeRuntime, viewport: Viewport): void {
    this.theme = theme;
    this.redraw(viewport);
  }

  redraw(viewport: Viewport): void {
    const { width, height } = viewport;
    const g = this.graphics;
    g.clear();
    const deep = themeColor(this.theme, 'color.background.deep', 0x070b1e);
    const station = themeColor(this.theme, 'color.background.station', 0x101735);
    const star = themeColor(this.theme, 'color.text.primary', 0xe8ecff);
    const line = themeColor(this.theme, 'color.constellation.line', 0x8ea2ff);
    const nebula = themeColor(this.theme, 'color.crystal.core', 0x7c5cff);

    g.rect(0, 0, width, height).fill(deep);
    // Nebula wash: two large translucent ellipses anchored to corners.
    g.ellipse(width * 0.85, height * 0.12, width * 0.35, height * 0.3).fill({
      color: nebula,
      alpha: 0.1,
    });
    g.ellipse(width * 0.1, height * 0.9, width * 0.3, height * 0.28).fill({
      color: station,
      alpha: 0.55,
    });

    const rng = lcg(1337);
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      const x = rng() * width;
      const y = rng() * height;
      const r = 0.6 + rng() * 1.5;
      points.push({ x, y });
      g.circle(x, y, r).fill({ color: star, alpha: 0.25 + rng() * 0.6 });
    }
    // Constellation motifs: short linked runs across sampled stars.
    g.setStrokeStyle({ width: 1, color: line, alpha: 0.35 });
    for (let c = 0; c < CONSTELLATION_COUNT; c++) {
      const start = Math.floor(rng() * points.length);
      let prev = points[start];
      if (prev === undefined) continue;
      const links = 2 + Math.floor(rng() * 3);
      for (let l = 0; l < links; l++) {
        const next = points[Math.floor(rng() * points.length)];
        if (next === undefined) break;
        g.moveTo(prev.x, prev.y).lineTo(next.x, next.y).stroke();
        g.circle(next.x, next.y, 2.2).fill({ color: line, alpha: 0.8 });
        prev = next;
      }
    }
    g.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 1 });
  }
}
