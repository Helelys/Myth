import { CameraState } from '../models';

/**
 * Utilitários de coordenadas para converter entre
 * screen space (pixels da tela) e world space (coordenadas do mundo).
 *
 * A câmera define uma transformação que mapeia:
 *   world --> screen: screen = (world - camera.x) * scale + offset
 *   screen --> world: world = (screen - offset) / scale + camera.x
 */
export class CoordinateUtils {
  /**
   * Converte coordenada X da tela para coordenada X do mundo.
   */
  static screenToWorldX(screenX: number, camera: CameraState, containerWidth: number): number {
    return (screenX - camera.x) / camera.scale;
  }

  /**
   * Converte coordenada Y da tela para coordenada Y do mundo.
   */
  static screenToWorldY(screenY: number, camera: CameraState, containerHeight: number): number {
    return (screenY - camera.y) / camera.scale;
  }

  /**
   * Converte coordenada X do mundo para coordenada X da tela.
   */
  static worldToScreenX(worldX: number, camera: CameraState, containerWidth: number): number {
    return worldX * camera.scale + camera.x;
  }

  /**
   * Converte coordenada Y do mundo para coordenada Y da tela.
   */
  static worldToScreenY(worldY: number, camera: CameraState, containerHeight: number): number {
    return worldY * camera.scale + camera.y;
  }

  /**
   * Aplica snap ao grid baseado no cellSize.
   */
  static snapToGrid(value: number, cellSize: number): number {
    return Math.round(value / cellSize) * cellSize;
  }

  /**
   * Arredonda coordenada para o grid.
   */
  static snapPosition(x: number, y: number, cellSize: number): { x: number; y: number } {
    return {
      x: CoordinateUtils.snapToGrid(x, cellSize),
      y: CoordinateUtils.snapToGrid(y, cellSize),
    };
  }

  /**
   * Calcula a viewport visível no mundo para fins de culling.
   */
  static getVisibleViewport(
    camera: CameraState,
    containerWidth: number,
    containerHeight: number,
  ): { x: number; y: number; width: number; height: number } {
    const worldX = -camera.x / camera.scale;
    const worldY = -camera.y / camera.scale;
    const worldWidth = containerWidth / camera.scale;
    const worldHeight = containerHeight / camera.scale;

    return {
      x: worldX,
      y: worldY,
      width: worldWidth,
      height: worldHeight,
    };
  }

  /**
   * Verifica se uma entidade está visível na viewport atual (culling).
   */
  static isInViewport(
    entityX: number,
    entityY: number,
    entityWidth: number,
    entityHeight: number,
    viewport: { x: number; y: number; width: number; height: number },
  ): boolean {
    return (
      entityX + entityWidth >= viewport.x &&
      entityX <= viewport.x + viewport.width &&
      entityY + entityHeight >= viewport.y &&
      entityY <= viewport.y + viewport.height
    );
  }

  /**
   * Calcula os bounds visíveis do grid baseado na viewport.
   * Isso evita desenhar células fora da tela.
   */
  static getGridBounds(
    viewport: { x: number; y: number; width: number; height: number },
    cellSize: number,
  ): { startCol: number; endCol: number; startRow: number; endRow: number } {
    const startCol = Math.floor(viewport.x / cellSize) - 1;
    const endCol = Math.ceil((viewport.x + viewport.width) / cellSize) + 1;
    const startRow = Math.floor(viewport.y / cellSize) - 1;
    const endRow = Math.ceil((viewport.y + viewport.height) / cellSize) + 1;

    return { startCol, endCol, startRow, endRow };
  }
}
