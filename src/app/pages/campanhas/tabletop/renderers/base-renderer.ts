import Konva from 'konva';
import { LayerType } from '../models';
import { CameraService } from '../services';

/**
 * Classe base para todos os renderers do sistema.
 *
 * Cada renderer é responsável por desenhar uma camada específica no canvas.
 * Herda desta classe para obter:
 * - Gerenciamento de layer
 * - Atualização de visibilidade
 * - Redraw otimizado
 */
export abstract class BaseRenderer {
  /** Layer Konva associada a este renderer */
  protected layer: Konva.Layer;

  /** Tipo da layer */
  protected readonly layerType: LayerType;

  constructor(layerType: LayerType, stage: Konva.Stage) {
    this.layerType = layerType;
    this.layer = new Konva.Layer({
      name: layerType,
      listening: true,
    });
    stage.add(this.layer);
  }

  /** Retorna a layer Konva */
  getLayer(): Konva.Layer {
    return this.layer;
  }

  /** Define visibilidade da layer */
  setVisible(visible: boolean): void {
    this.layer.visible(visible);
  }

  /** Define opacidade da layer */
  setOpacity(opacity: number): void {
    this.layer.opacity(opacity);
  }

  /** Redesenha a layer */
  redraw(): void {
    this.layer.batchDraw();
  }

  /** Obtém o tipo da layer */
  getType(): LayerType {
    return this.layerType;
  }

  /**
   * Método abstrato para renderizar o conteúdo.
   * Chamado quando o estado da câmera ou dos dados muda.
   */
  abstract render(camera: CameraService): void;

  /**
   * Limpa todos os shapes da layer.
   */
  clear(): void {
    this.layer.destroyChildren();
  }

  /**
   * Remove a layer do stage e limpa recursos.
   */
  destroy(): void {
    this.layer.destroy();
  }
}
