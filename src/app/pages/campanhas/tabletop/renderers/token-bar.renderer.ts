import Konva from 'konva';
import { TokenBar } from '../models';

const BAR_GAP = 2;
const BAR_HEIGHT = 5;
const BAR_BORDER_RADIUS = 2;

export class TokenBarRenderer {
  static createBars(group: Konva.Group, width: number, height: number, bars: TokenBar[]): number {
    const visibleBars = bars.filter((b) => b.visible);
    if (visibleBars.length === 0) return 0;
    visibleBars.forEach((bar, index) => {
      const bg = new Konva.Rect({
        x: 0, y: height + 4 + index * (BAR_HEIGHT + BAR_GAP),
        width, height: BAR_HEIGHT, fill: '#1a1a2e',
        cornerRadius: BAR_BORDER_RADIUS, stroke: '#2a2a4a', strokeWidth: 0.5,
        strokeScaleEnabled: false,
        name: `bar-bg-${index}`,
      });
      group.add(bg);
      const label = new Konva.Text({
        x: 2, y: height + 4 + index * (BAR_HEIGHT + BAR_GAP) - 0.5,
        text: bar.label, fontSize: 6, fill: '#ffffff', opacity: 0.9,
        name: `bar-label-${index}`, listening: false,
      });
      group.add(label);
      const ratio = bar.maxValue > 0 ? bar.value / bar.maxValue : 0;
      const fillBar = new Konva.Rect({
        x: 0, y: height + 4 + index * (BAR_HEIGHT + BAR_GAP),
        width: width * ratio, height: BAR_HEIGHT, fill: bar.color,
        cornerRadius: BAR_BORDER_RADIUS, name: `bar-fill-${index}`,
      });
      group.add(fillBar);
      const valueText = new Konva.Text({
        x: width - 2, y: height + 4 + index * (BAR_HEIGHT + BAR_GAP) - 0.5,
        text: `${bar.value}/${bar.maxValue}`, fontSize: 5, fill: '#ffffff', opacity: 0.85,
        name: `bar-value-${index}`, listening: false, align: 'right',
      });
      group.add(valueText);
    });
    return visibleBars.length * (BAR_HEIGHT + BAR_GAP) + 2;
  }

  static updateBars(group: Konva.Group, width: number, height: number, bars: TokenBar[]): void {
    // Destroy all existing bars
    for (let i = 0; i < 10; i++) {
      group.findOne(`.bar-fill-${i}`)?.destroy();
      group.findOne(`.bar-bg-${i}`)?.destroy();
      group.findOne(`.bar-label-${i}`)?.destroy();
      group.findOne(`.bar-value-${i}`)?.destroy();
    }
    
    // Recreate bars
    this.createBars(group, width, height, bars);
  }

  static getBarsHeight(bars: TokenBar[]): number {
    const visibleBars = bars.filter((b) => b.visible);
    if (visibleBars.length === 0) return 0;
    return visibleBars.length * (BAR_HEIGHT + BAR_GAP) + 2;
  }
}
