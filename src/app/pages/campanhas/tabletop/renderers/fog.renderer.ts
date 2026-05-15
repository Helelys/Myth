import Konva from 'konva';
import { BaseRenderer } from './base-renderer';
import { LayerType } from '../models';
import { CameraService, FogService } from '../services';

/**
 * Renderer do Fog of War.
 *
 * Implementação:
 * - Uma camada preta semi-transparente sobre o canvas
 * - Áreas reveladas usam composite operation 'destination-out' via pincel
 * - A fog é persistida como dataURL
 * - O GM pode alternar visão total (gmVision)
 *
 * A fog é desenhada em coordenadas do screen/container para alinhar
 * com o zoom e pan sem distorcer o pincel.
 */
export class FogRenderer extends BaseRenderer {
  /** Imagem da fog (preto com áreas transparentes reveladas) */
  private fogImage: Konva.Image | null = null;
  /** Canvas off-screen para manipular a fog */
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;
  /** Estado de pintura */
  private isPainting = false;

  constructor(
    stage: Konva.Stage,
    private fogService: FogService,
  ) {
    super(LayerType.Fog, stage);
    this.initOffscreen();
  }

  private initOffscreen(): void {
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = 2000;
    this.offscreenCanvas.height = 2000;
    this.offscreenCtx = this.offscreenCanvas.getContext('2d');

    if (this.offscreenCtx) {
      // Inicializa tudo preto (fog total)
      this.offscreenCtx.fillStyle = '#000000';
      this.offscreenCtx.fillRect(0, 0, 2000, 2000);
    }
  }

  override render(camera: CameraService): void {
    const fog = this.fogService.getSnapshot();

    if (!fog.enabled) {
      this.layer.visible(false);
      return;
    }

    this.layer.visible(true);
    this.layer.opacity(fog.opacity);

    // Se GM vision está ativo, esconde a layer
    if (fog.gmVision) {
      this.layer.visible(false);
      this.redraw();
      return;
    }

    // Cria ou atualiza a imagem da fog
    if (!this.fogImage && this.offscreenCanvas) {
      this.fogImage = new Konva.Image({
        image: this.offscreenCanvas,
        x: 0,
        y: 0,
        width: camera.getContainerSize().width,
        height: camera.getContainerSize().height,
        listening: true,
        name: 'fog-image',
      });

      this.setupFogBrush();
      this.layer.add(this.fogImage);
    }

    // Carrega fog persistida se existir
    if (fog.fogImage && this.offscreenCanvas) {
      const img = new Image();
      img.onload = () => {
        if (this.offscreenCtx) {
          this.offscreenCtx.clearRect(
            0,
            0,
            this.offscreenCanvas!.width,
            this.offscreenCanvas!.height,
          );
          this.offscreenCtx.drawImage(img, 0, 0);
          this.redraw();
        }
      };
      img.src = fog.fogImage;
    }

    this.redraw();
  }

  private setupFogBrush(): void {
    if (!this.fogImage) return;

    this.fogImage.on('mousedown', (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.evt.button !== 0) return;
      this.isPainting = true;
      this.paintAt(e);
    });

    this.fogImage.on('mousemove', (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!this.isPainting) return;
      this.paintAt(e);
    });

    this.fogImage.on('mouseup', () => {
      this.isPainting = false;
      this.saveFog();
    });

    this.fogImage.on('mouseleave', () => {
      this.isPainting = false;
    });
  }

  private paintAt(e: Konva.KonvaEventObject<MouseEvent>): void {
    if (!this.offscreenCtx || !this.offscreenCanvas || !this.fogImage) return;

    const pos = this.fogImage.getStage()?.getPointerPosition();
    if (!pos) return;

    const fog = this.fogService.getSnapshot();
    const mode = this.fogService.currentMode();

    this.offscreenCtx.save();

    if (mode === 'reveal' || mode === 'brush') {
      // Revela: usa destination-out para tornar transparente
      this.offscreenCtx.globalCompositeOperation = 'destination-out';
      this.offscreenCtx.beginPath();
      this.offscreenCtx.arc(
        pos.x,
        pos.y,
        fog.brushRadius,
        0,
        Math.PI * 2,
      );
      this.offscreenCtx.fill();
    } else {
      // Esconde: pinta preto
      this.offscreenCtx.globalCompositeOperation = 'source-over';
      this.offscreenCtx.fillStyle = '#000000';
      this.offscreenCtx.beginPath();
      this.offscreenCtx.arc(
        pos.x,
        pos.y,
        fog.brushRadius,
        0,
        Math.PI * 2,
      );
      this.offscreenCtx.fill();
    }

    this.offscreenCtx.restore();
    this.redraw();
  }

  private saveFog(): void {
    if (this.offscreenCanvas) {
      const dataUrl = this.offscreenCanvas.toDataURL();
      this.fogService.setFogImage(dataUrl);
    }
  }

  /** Revela uma área circular (útil para reveal inicial) */
  revealCircle(worldX: number, worldY: number, radius: number): void {
    if (!this.offscreenCtx) return;

    this.offscreenCtx.save();
    this.offscreenCtx.globalCompositeOperation = 'destination-out';
    this.offscreenCtx.beginPath();
    this.offscreenCtx.arc(worldX, worldY, radius, 0, Math.PI * 2);
    this.offscreenCtx.fill();
    this.offscreenCtx.restore();

    this.saveFog();
    this.redraw();
  }

  override clear(): void {
    super.clear();
    this.fogImage = null;
    this.initOffscreen();
  }
}
