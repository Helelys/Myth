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
    const badgeWidth = 40;
    const badgeHeight = 26; // maior para caber 2 linhas

    // Background for armor badge
    const statsBg = new Konva.Rect({
      x: token.width / 2 - badgeWidth / 2,
      y: startY,
      width: badgeWidth,
      height: badgeHeight,
      fill: '#151525',
      cornerRadius: 6,
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

    // Label (ex: "Armadura") — menor, semi-transparente
    const labelText = new Konva.Text({
      x: token.width / 2 - badgeWidth / 2,
      y: startY + 3,
      width: badgeWidth,
      height: 12,
      text: token.armor.label,
      fontSize: 9,
      fontStyle: 'normal',
      fill: '#ffffff',
      align: 'center',
      verticalAlign: 'middle',
      opacity: 0.75,
      name: 'stats-label',
      listening: false,
    });
    group.add(labelText);

    // Value (ex: "20") — maior, destaque
    const valueText = new Konva.Text({
      x: token.width / 2 - badgeWidth / 2,
      y: startY + 13,
      width: badgeWidth,
      height: 12,
      text: String(token.armor.value),
      fontSize: 13,
      fontStyle: 'bold',
      fill: '#ffffff',
      align: 'center',
      verticalAlign: 'middle',
      name: 'stats-value',
      listening: false,
    });
    group.add(valueText);

    return badgeHeight + 4;
  }

  /**
   * Updates stats efficiently.
   */
  static updateStats(group: Konva.Group, token: Token, barsHeight: number): void {
    group.findOne('.stats-bg')?.destroy();
    group.findOne('.stats-label')?.destroy();
    group.findOne('.stats-value')?.destroy();

    this.createStats(group, token, barsHeight);
  }
}
