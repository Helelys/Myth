import Konva from 'konva';
import { BaseRenderer } from './base-renderer';
import { LayerType } from '../models';
import { CameraService, GridService } from '../services';
import { CoordinateUtils } from '../utils';

/**
 * Renderer do grid.
 *
 * Desenha apenas as linhas visíveis na viewport atual (grid infinito visual).
 * Utiliza CoordinateUtils.getGridBounds() para calcular quais linhas desenhar.
 *
 * Otimizações:
 * - Só desenha linhas visíveis na tela
 * - Reusa shapes quando possível
 * - Usa batchDraw para evitar múltiplos redraws
 */
export class GridRenderer extends BaseRenderer {
  private gridLines: Konva.Line[] = [];

  constructor(stage: Konva.Stage, private gridService: GridService) {
    super(LayerType.Grid, stage);
  }

  override render(camera: CameraService): void {
    const config = this.gridService.getSnapshot();
    if (!config.enabled) {
      this.layer.visible(false);
      return;
    }

    this.layer.visible(true);
    this.layer.opacity(config.opacity);

    const containerSize = camera.getContainerSize();
    const viewport = CoordinateUtils.getVisibleViewport(
      camera.getSnapshot(),
      containerSize.width,
      containerSize.height,
    );

    const bounds = CoordinateUtils.getGridBounds(viewport, config.cellSize);

    // Remove linhas antigas
    this.gridLines.forEach((line) => line.destroy());
    this.gridLines = [];

    const { startCol, endCol, startRow, endRow } = bounds;
    const { cellSize } = config;

    // Desenha linhas verticais
    for (let col = startCol; col <= endCol; col++) {
      const worldX = col * cellSize;

      const line = new Konva.Line({
        points: [worldX, viewport.y, worldX, viewport.y + viewport.height],
        stroke: config.color,
        strokeWidth: 1,
        strokeScaleEnabled: false, // Mantém a espessura da linha 1px independente do zoom
        listening: false,
        name: 'grid-line',
      });

      this.layer.add(line);
      this.gridLines.push(line);
    }

    // Desenha linhas horizontais
    for (let row = startRow; row <= endRow; row++) {
      const worldY = row * cellSize;

      const line = new Konva.Line({
        points: [viewport.x, worldY, viewport.x + viewport.width, worldY],
        stroke: config.color,
        strokeWidth: 1,
        strokeScaleEnabled: false,
        listening: false,
        name: 'grid-line',
      });

      this.layer.add(line);
      this.gridLines.push(line);
    }

    this.redraw();
  }

  override clear(): void {
    super.clear();
    this.gridLines = [];
  }
}
