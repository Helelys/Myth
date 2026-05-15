import Konva from 'konva';
import { BaseRenderer } from './base-renderer';
import { LayerType } from '../models';
import { CameraService, MapService } from '../services';

/**
 * Renderer responsável por desenhar o mapa de fundo.
 * Renderiza a imagem do mapa na BackgroundLayer com suporte a
 * escala, posicionamento e bloqueio.
 */
export class BackgroundRenderer extends BaseRenderer {
  private backgroundImage: Konva.Image | null = null;
  private imageObj: HTMLImageElement | null = null;
  private transformer: Konva.Transformer;

  constructor(private stage: Konva.Stage, private mapService: MapService) {
    super(LayerType.Background, stage);

    this.transformer = new Konva.Transformer({
      rotateEnabled: false,
      keepRatio: true,
      ignoreStroke: true,
      enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      anchorSize: 10,
      borderStroke: '#4fc3f7',
      anchorStroke: '#4fc3f7',
      anchorFill: '#ffffff',
    });
    this.layer.add(this.transformer);

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Stage click para deselecionar
    this.stage.on('click mousedown', (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Se clicou direto no stage ou fora da imagem, ou num token
      if (e.target === this.stage) {
        this.deselectMap();
      }
    });
  }

  private deselectMap(): void {
    if (this.transformer.nodes().length > 0) {
      this.transformer.nodes([]);
      this.redraw();
    }
  }

  override render(camera: CameraService): void {
    const map = this.mapService.map();
    if (!map) {
      this.clear();
      return;
    }

    const imageUrl = map.imageUrl;
    
    // Se a imagem já estiver no MapData (cache), não precisamos baixar de novo
    if (map.imageObj && this.imageObj !== map.imageObj) {
      this.imageObj = map.imageObj;
      this.clear();
      this.createBackgroundImage(this.imageObj, map);
    } else if (!map.imageObj && this.imageObj?.src !== imageUrl) {
      this.loadImage(imageUrl);
    }

    if (this.backgroundImage && this.imageObj) {
      this.backgroundImage.x(map.x);
      this.backgroundImage.y(map.y);
      this.backgroundImage.scaleX(map.scale);
      this.backgroundImage.scaleY(map.scale);
      this.backgroundImage.draggable(!map.locked);
      this.backgroundImage.listening(true);
      
      if (map.locked) {
        this.deselectMap();
      }
    }

    this.redraw();
  }

  private createBackgroundImage(img: HTMLImageElement, map: any): void {
    this.backgroundImage = new Konva.Image({
      image: img,
      x: map.x ?? 0,
      y: map.y ?? 0,
      width: img.width,
      height: img.height,
      scaleX: map.scale ?? 1,
      scaleY: map.scale ?? 1,
      draggable: !map.locked,
      listening: true,
      name: 'map-background',
    });

    // Clique para selecionar
    this.backgroundImage.on('click', (e) => {
      e.cancelBubble = true;
      if (!this.mapService.map()?.locked) {
        this.transformer.nodes([this.backgroundImage!]);
        this.redraw();
      }
    });

    // Arrastar
    this.backgroundImage.on('dragend', () => {
      if (!this.backgroundImage) return;
      this.mapService.updateMap({
        x: this.backgroundImage.x(),
        y: this.backgroundImage.y(),
      });
    });

    // Transformar (Resize)
    this.backgroundImage.on('transformend', () => {
      if (!this.backgroundImage) return;
      this.mapService.updateMap({
        x: this.backgroundImage.x(),
        y: this.backgroundImage.y(),
        scale: this.backgroundImage.scaleX(),
      });
    });

    this.layer.add(this.backgroundImage);
    this.transformer.moveToTop();
  }

  private loadImage(url: string): void {
    const img = new Image();
    img.onload = () => {
      this.imageObj = img;
      this.clear();
      this.createBackgroundImage(img, this.mapService.map() || {});
      this.redraw();
    };
    img.src = url;
  }

  override clear(): void {
    super.clear();
    this.backgroundImage = null;
    this.transformer.nodes([]);
    this.layer.add(this.transformer); // Mantém o transformer
  }
}
