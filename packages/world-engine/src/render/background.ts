import { Container, Graphics } from 'pixi.js';
import type { ThemeRuntime } from '@thenexus/asset-system';
import type { Viewport } from '../core/iso';
import { themeColor } from '../core/theme-colors';

/**
 * Screen-space backdrop behind the Project House: a deep warm-charcoal
 * wash with a soft vignette so the garden ground (world layer) sits in a
 * calm desktop frame. Pure decoration — redrawn only on resize.
 */

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
    const deep = themeColor(this.theme, 'color.background.deep', 0x11141f);
    const edge = themeColor(this.theme, 'color.background.station', 0x0b0e18);
    g.rect(0, 0, width, height).fill(deep);
    // Soft dark frame: keeps focus on the house at any window size.
    const inset = 90;
    g.rect(0, 0, width, inset).fill({ color: edge, alpha: 0.5 });
    g.rect(0, height - inset, width, inset).fill({ color: edge, alpha: 0.5 });
    g.rect(0, 0, inset, height).fill({ color: edge, alpha: 0.5 });
    g.rect(width - inset, 0, inset, height).fill({ color: edge, alpha: 0.5 });
    g.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 1 });
  }
}
