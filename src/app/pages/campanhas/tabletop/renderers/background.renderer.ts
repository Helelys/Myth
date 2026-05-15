import Konva from 'konva';
import { BaseRenderer } from './base-renderer';
import { LayerType, MapData } from '../models';
import { CameraService, MapService } from '../services';

/**
 * Renderer de mapas — VERSÃO SIMPLIFICADA.
 *
 * Cada mapa possui seu próprio grupo e transformer.
 * SEM outline visual (apenas handles do transformer).
 * Lock controla apenas draggable e transformer.
 *
 * REGRA:
 *   - Se mapa está selecionado (selectedId === map.id):
 *     - locked=false → draggable=true, transformer visível
 *     - locked=true  → draggable=false, transformer invisível
 *   - Se NÃO está selecionado → transformer invisível, sem interação
 */
export class BackgroundRenderer extends BaseRenderer {
  private mapGroups = new Map<string, {
    group: Konva.Group;
    image: Konva.Image;
    transformer: Konva.Transformer;
  }>();

  private imageCache = new Map<string, HTMLImageElement>();

  onBackgroundClick: (() => void) | null = null;
  onContextMenu: ((mapId: string, clientX: number, clientY: number) => void) | null = null;

  constructor(
    private stage: Konva.Stage,
    private mapService: MapService,
  ) {
    super(LayerType.Background, stage);
    this.setupStageEvents();
  }

  /** Escuta clique no fundo do stage para deselecionar */
  private setupStageEvents(): void {
    this.stage.on('mousedown', (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.evt.button !== 0) return;

      const target = e.target;
      const selectedId = this.mapService.selectedId();
      if (!selectedId) return;

      // Se clicou no stage (vazio) ou em token/grid/fog — deseleciona
      if (
        target === this.stage ||
        target.name()?.startsWith('token-') ||
        target.name()?.startsWith('grid-') ||
        target.name()?.startsWith('fog-')
      ) {
        this.mapService.deselectMap();
        if (this.onBackgroundClick) {
          this.onBackgroundClick();
        }
      }
    });
  }

  override render(camera: CameraService): void {
    const maps = this.mapService.sortedMaps();
    const selectedId = this.mapService.selectedId();
    const currentIds = new Set(maps.map((m) => m.id));

    // Remove mapas que não existem mais
    for (const [id, data] of this.mapGroups) {
      if (!currentIds.has(id)) {
        data.group.destroy();
        this.mapGroups.delete(id);
      }
    }

    // Cria e atualiza cada mapa
    for (const map of maps) {
      this.getOrCreateMapGroup(map);
      this.applyMapState(map, selectedId);
    }

    this.redraw();
  }

  private getOrCreateMapGroup(map: MapData): void {
    if (this.mapGroups.has(map.id)) return;

    const img = this.getOrLoadImage(map.imageUrl, map.imageObj);
    if (!img) return;

    // Cache da imagem
    if (!map.imageObj) {
      this.mapService.updateMap(map.id, { imageObj: img });
    }

    // ── GRUPO DO MAPA ──
    const group = new Konva.Group({
      x: map.x,
      y: map.y,
      draggable: false,
      visible: true,
      listening: true,
      name: `map-group-${map.id}`,
    });

    // ── IMAGEM ──
    const image = new Konva.Image({
      image: img,
      x: 0,
      y: 0,
      width: img.width,
      height: img.height,
      scaleX: map.scaleX ?? map.scale ?? 1,
      scaleY: map.scaleY ?? map.scale ?? 1,
      draggable: false,
      listening: true,
      name: `map-image-${map.id}`,
    });

    group.add(image);

    // ── TRANSFORMER — APENAS HANDLES (SEM BORDA AZUL) ──
    const transformer = new Konva.Transformer({
      nodes: [],
      rotateEnabled: false,
      keepRatio: true,
      ignoreStroke: true,
      borderEnabled: false,
      enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      anchorSize: 10,
      anchorCornerRadius: 3,
      anchorStroke: '#4fc3f7',
      anchorFill: '#ffffff',
      visible: false,
      name: `map-transformer-${map.id}`,
    });
    group.add(transformer);

    // ═══════════════════════════════════════════
    // EVENTOS
    // ═══════════════════════════════════════════

    // Clique esquerdo → seleciona mapa
    image.on('click', (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.evt.button !== 0) return;
      e.cancelBubble = true;
      this.mapService.selectMap(map.id);
    });

    // Duplo clique → seleciona
    image.on('dblclick', (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      this.mapService.selectMap(map.id);
    });

    // Botão direito → menu contextual HTML
    image.on('contextmenu', (e: Konva.KonvaEventObject<PointerEvent>) => {
      e.evt.preventDefault();
      e.cancelBubble = true;
      this.mapService.selectMap(map.id);
      if (this.onContextMenu) {
        this.onContextMenu(map.id, e.evt.clientX, e.evt.clientY);
      }
    });

    // Drag — move o grupo e atualiza posição no service
    group.on('dragstart', () => {
      this.mapService.bringToFront(map.id);
    });

    group.on('dragend', () => {
      const savedMap = this.mapService.getMapById(map.id);
      console.log('[DRAGEND]', {
        mapId: map.id,
        visualX: group.x(),
        visualY: group.y(),
        savedX: savedMap?.x,
        savedY: savedMap?.y,
        willUpdate: true,
      });
      this.mapService.updateMap(map.id, {
        x: group.x(),
        y: group.y(),
      });
    });

    // Transform end (resize)
    image.on('transformend', () => {
      const savedMap = this.mapService.getMapById(map.id);
      console.log('[TRANSFORMEND]', {
        mapId: map.id,
        visualX: group.x(),
        visualY: group.y(),
        visualScaleX: image.scaleX(),
        visualScaleY: image.scaleY(),
        savedX: savedMap?.x,
        savedY: savedMap?.y,
        savedScaleX: savedMap?.scaleX,
      });
      this.mapService.updateMap(map.id, {
        x: group.x(),
        y: group.y(),
        scaleX: image.scaleX(),
        scaleY: image.scaleY(),
        scale: image.scaleX(),
      });
    });

    // Adiciona à layer
    this.mapGroups.set(map.id, { group, image, transformer });
    this.layer.add(group);
    this.redraw();
  }

  private applyMapState(map: MapData, selectedId: string | null): void {
    const data = this.mapGroups.get(map.id);
    if (!data) return;

    const { group, image, transformer } = data;
    const isSelected = selectedId === map.id;

    // Posição e escala
    group.x(map.x);
    group.y(map.y);
    image.scaleX(map.scaleX ?? map.scale ?? 1);
    image.scaleY(map.scaleY ?? map.scale ?? 1);

    // Ordem Z
    group.zIndex(map.zIndex);

    if (isSelected && !map.locked) {
      // ── SELECIONADO + DESTRAVADO — mostra handles, permite drag ──
      group.draggable(true);
      transformer.visible(true);
      transformer.nodes([image]);
    } else {
      // ── NÃO SELECIONADO ou TRAVADO — sem handles, sem drag ──
      group.draggable(false);
      transformer.nodes([]);
      transformer.visible(false);
    }
  }

  private getOrLoadImage(url: string, existingObj?: HTMLImageElement): HTMLImageElement | null {
    if (existingObj) {
      this.imageCache.set(url, existingObj);
      return existingObj;
    }
    if (this.imageCache.has(url)) {
      return this.imageCache.get(url) ?? null;
    }

    const img = new Image();
    img.onload = () => {
      this.imageCache.set(url, img);
      const maps = this.mapService.mapList();
      const map = maps.find((m) => m.imageUrl === url);
      if (map) {
        this.mapService.updateMap(map.id, { imageObj: img });
      }
      this.redraw();
    };
    img.src = url;

    if (img.complete && img.naturalWidth > 0) {
      this.imageCache.set(url, img);
      return img;
    }
    this.imageCache.set(url, img);
    return null;
  }

  override clear(): void {
    for (const [, data] of this.mapGroups) {
      data.group.destroy();
    }
    this.mapGroups.clear();
    super.clear();
  }
}
