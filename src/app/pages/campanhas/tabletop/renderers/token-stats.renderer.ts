import Konva from 'konva';
import { Token } from '../models';

/**
 * Renderer for token stats (attributes below bars).
 * Shows Armor/AC below the bars area.
 */
export class TokenStatsRenderer {
  private static readonly STAT_BG_HEIGHT = 16;
  private static readonly FONT_SIZE = 9;

  /**
   * Creates stat shapes below token bars.
   * Returns the total height consumed.
   */
  static createStats(group: Konva.Group, token: Token, barsHeight: number): number {
    if (!token.armor || !token.armor.enabled) return 0;

    const startY = token.height + 4 + barsHeight + 4;

    // Background for armor badge
    const statsBg = new Konva.Rect({
      x: token.width / 2 - 20, // Center badge
      y: startY,
      width: 40,
      height: this.STAT_BG_HEIGHT,
      fill: '#151525',
      cornerRadius: 4,
      stroke: '#4a4a7a',
      strokeWidth: 1,
      strokeScaleEnabled: false,
      name: 'stats-bg',
      shadowColor: 'black',
      shadowBlur: 2,
      shadowOpacity: 0.5,
      shadowOffsetY: 1,
    });
    group.add(statsBg);

    // Armor text
    const statsText = new Konva.Text({
      x: token.width / 2 - 20,
      y: startY + 2,
      width: 40,
      height: this.STAT_BG_HEIGHT - 4,
      text: `${token.armor.label} ${token.armor.value}`,
      fontSize: this.FONT_SIZE,
      fontStyle: 'bold',
      fill: '#ffffff',
      align: 'center',
      verticalAlign: 'middle',
      name: 'stats-text',
      listening: false,
    });
    group.add(statsText);

    return this.STAT_BG_HEIGHT + 4;
  }

  /**
   * Updates stats efficiently.
   */
  static updateStats(group: Konva.Group, token: Token, barsHeight: number): void {
    group.findOne('.stats-bg')?.destroy();
    group.findOne('.stats-text')?.destroy();
    
    this.createStats(group, token, barsHeight);
  }
}
