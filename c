import Konva from 'konva';
import { TokenBar } from '../models';

/**
 * Constants for bar rendering
 */
const BAR_GAP = 2;
const BAR_HEIGHT = 5;
const BAR_BORDER_RADIUS = 2;

/**
 * Renderer for configurable token bars.
 * Renders 0-3 configurable bars above the token with smooth animations.
 *
 * Performance:
 * - Uses granular updates instead of full recreation
 * - Caches bar background shapes
 * - Only redraws changed bars
 */
export class TokenBarRenderer {
  /**
   * Creates bar shapes for a token group.
   * Returns the total height consumed by bars.
   */
  static createBars(group: Konva.Group, width: number, height: number, bars: TokenBar[]): number {
    const visibleBars = bars.filter((b) => b.visible);
    if (visibleBars.length === 0) return 0;

    const totalHeight = visibleBars.length * (BAR_HEIGHT + BAR_GAP);

    visibleBars.forEach((bar, index) => {
      // Background (dark track)
      const bg = new Konva.Rect({
        x: 0,
        y: height + 4 + index * (BAR_HEIGHT + BAR_GAP),
        width: width,
        height: BAR_HEIGHT,
        fill: '#1a1a2e',
        cornerRadius: BAR_BORDER_RADIUS,
        stroke: '#2a2a4a',
        strokeWidth: 0.5,
        name: `bar-bg-${index}`,
      });
      group.add(bg);

      // Label (small text on the left side of bar)
      const label = new Konva.Text({
        x: 2,
        y: height + 4 + index * (BAR_HEIGHT + BAR_GAP) - 0.5,
        text: bar.label,
        fontSize: 6,
        fill: '#ffffff',
        opacity: 0.9,
        name: `bar-label-${index}`,
        listening: false,
      });
      group.add(label);

      // Fill bar
      const ratio = bar.maxValue > 0 ? bar.value / bar.maxValue : 0;
      const fillBar = new Konva.Rect({
        x: 0,
        y: height + 4 + index * (BAR_HEIGHT + BAR_GAP),
        width: width * ratio,
        height: BAR_HEIGHT,
        fill: bar.color,
        cornerRadius: BAR_BORDER_RADIUS,
        name: `bar-fill-${index}`,
      });
      group.add(fillBar);

      // Value text (right side)
      const valueText = new Konva.Text({
        x: width - 2,
        y: height + 4 + index * (BAR_HEIGHT + BAR_GAP) - 0.5,
        text: `${bar.value}/${bar.maxValue}`,
        fontSize: 5,
        fill: '#ffffff',
        opacity: 0.85,
        name: `bar-value-${index}`,
        listening: false,
        align: 'right',
      });
      group.add(valueText);
    });

    return totalHeight + 2;
  }

  /**
   * Updates bars efficiently without recreating.
   */
  static updateBars(group: Konva.Group, width: number, height: number, bars: TokenBar[]): void {
    const visibleBars = bars.filter((b) => b.visible);

    visibleBars.forEach((bar, index) => {
      const fillBar = group.findOne(`.bar-fill-${index}`) as Konva.Rect;
      const bgBar = group.findOne(`.bar-bg-${index}`) as Konva.Rect;
      const labelText = group.findOne(`.bar-label-${index}`) as Konva.Text;
      const valueText = group.findOne(`.bar-value-${index}`) as Konva.Text;

      if (fillBar && bgBar) {
        const ratio = bar.maxValue > 0 ? bar.value / bar.maxValue : 0;
        const newWidth = width * ratio;

        // Smooth animation
        if (Math.abs(fillBar.width() - newWidth) > 0.5) {
          fillBar.to({
            width: newWidth,
            duration: 0.2,
            easing: Konva.Easings.EaseOut,
          });
        } else {
          fillBar.width(newWidth);
        }

        fillBar.fill(bar.color);
        bgBar.width(width);

        // Update positions
        const y = height + 4 + index * (BAR_HEIGHT + BAR_GAP);
        bgBar.y(y);
        fillBar.y(y);

        // Update label and value text
        if (labelText) {
          labelText.y(y - 0.5);
          labelText.text(bar.label);
        }
        if (valueText) {
          valueText.x(width - 2);
          valueText.y(y - 0.5);
          valueText.text(`${Math.round(bar.value)}/${Math.round(bar.maxValue)}`);
        }
      }
    });

    // Remove excess bars if bars array shrank
    for (let i = visibleBars.length; i < 10; i++) {
      const fillBar = group.findOne(`.bar-fill-${i}`) as Konva.Rect;
      if (fillBar) fillBar.destroy();
      const bgBar = group.findOne(`.bar-bg-${i}`) as Konva.Rect;
      if (bgBar) bgBar.destroy();
      const labelText = group.findOne(`.bar-label-${i}`) as Konva.Text;
      if (labelText) labelText.destroy();
      const valueText = group.findOne(`.bar-value-${i}`) as Konva.Text;
      if (valueText) valueText.destroy();
    }
  }

  /**
   * Calculates the area below token occupied by bars.
   */
  static getBarsHeight(bars: TokenBar[]): number {
    const visibleBars = bars.filter((b) => b.visible);
    if (visibleBars.length === 0) return 0;
    return visibleBars.length * (BAR_HEIGHT + BAR_GAP) + 2;
  }
}
