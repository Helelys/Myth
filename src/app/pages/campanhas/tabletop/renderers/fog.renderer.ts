import Konva from 'konva';
import { BaseRenderer } from './base-renderer';
import { LayerType } from '../models';
import { CameraService, FogService } from '../services';

/**
 * ═══════════════════════════════════════════════════════════
 * FOG RENDERER — Shadow Surface com destination-out
 * ═══════════════════════════════════════════════════════════
 *
 * ARQUITETURA CORRETA (modo Foundry/Owlbear)
 * ─────────────────────────────────────────────
 *
 * Em VEZ de desenhar múltiplos retângulos/linhas pretos
 * (que causavam alpha stacking ao sobrepor), o fog moderno
 * usa o modelo de "superfície escura única + recortes".
 *
 * PIPELINE:
 *   ┌─ 1. Desenha UM retângulo preto gigante (source-over)
 *   │      └─ ctx.fillStyle = #000000, preenche área massiva
 *   │
 *   ├─ 2. Para cada região de FOG:
 *   │      └─ ctx.globalCompositeOperation = 'destination-out'
 *   │      └─ Remove (recorta) a região da superfície escura
 *   │
 *   └─ 3. Preview temporário:
 *         └─ Também usa destination-out para mostrar onde o
 *            jogador está "revelando"
 *
 * GARANTIAS:
 * ✔ ZERO alpha stacking — destination-out é idempotente
 * ✔ Superfície escura ÚNICA — opacidade única na shape
 * ✔ ZERO layer.opacity() — opacidade APENAS no shadowSurface
 * ✔ Determinístico: sceneFunc lê fogService + preview state
 * ✔ Preview nunca contamina o render final
 * ✔ Sistemas de colisão/portas INDEPENDENTES do visual
 *
 * CONCEITO:
 *   A tela JÁ ESTÁ escura (rect preto).
 *   As regiões APENAS RECORTAM áreas visíveis.
 *   Não se "adiciona escuridão" — se "remove escuridão".
 */
export class FogRenderer extends BaseRenderer {
  private shadowSurface: Konva.Shape;
  private doorGroup: Konva.Group;
  private doorShapes = new Map<string, Konva.Group>();

  // ═══════════════════════════════════════════════════════
  // PREVIEW STATE — NÃO são shapes Konva, são dados para sceneFunc
  // ═══════════════════════════════════════════════════════

  /**
   * Estado do preview sendo desenhado.
   *
   * Mantido como dado simples (não Konva nodes) para que o
   * sceneFunc possa renderizá-lo com destination-out junto
   * com as regiões reais.
   *
   * Isto garante que:
   * ✔ Preview nunca causa alpha stacking
   * ✔ Preview nunca entra no cache
   * ✔ Preview é renderizado no mesmo ciclo de desenho
   */
  private previewState: PreviewRectState | PreviewBrushState | null = null;
  isDrawing = false;

  constructor(
    stage: Konva.Stage,
    private fogService: FogService,
  ) {
    super(LayerType.Fog, stage);
    this.layer.listening(true);

    // A shadowSurface é um Konva.Shape com sceneFunc personalizada.
    // A opacidade da shape controla a OPACIDADE DA ESCURIDÃO.
    // Opacidade 0.75 = 75% escuro, 25% visível nas áreas não reveladas.
    // Opacidade 1.0 = completamente escuro (não revelado).
    // Opacidade 0.0 = completamente visível (sem fog).
    this.shadowSurface = new Konva.Shape({
      sceneFunc: (context) => {
        this.drawFogGeometry(context);
      },
      opacity: this.fogService.opacity(),
      listening: false,
      name: 'fog-shadow-surface',
    });
    this.layer.add(this.shadowSurface);

    this.doorGroup = new Konva.Group({
      name: 'fog-doors',
      listening: false,
    });
    this.layer.add(this.doorGroup);
  }

  override render(camera: CameraService): void {
    const fogEnabled = this.fogService.enabled();
    const gmVision = this.fogService.gmVision();

    if (!fogEnabled || gmVision) {
      this.layer.visible(false);
      return;
    }

    this.layer.visible(true);
    this.shadowSurface.opacity(this.fogService.opacity());
    this.syncDoors(this.fogService.regions());
    this.redraw();
  }

  /**
   * ═══════════════════════════════════════════════════════
   * drawFogGeometry — O CORAÇÃO DO SISTEMA
   * ═══════════════════════════════════════════════════════
   *
   * Desenha a superfície de neblina usando canvas nativo com
   * compositing mode destination-out.
   *
   * PASSOS:
   * 1. source-over: preenche um retângulo preto GIGANTE
   *    (cobre todo o mapa e além)
   * 2. destination-out: para cada região de fog, RECORTA
   *    (remove) a área da superfície escura
   * 3. destination-out: para o preview (se houver), também
   *    recorta a área sendo desenhada
   *
   * ⚠ NENHUMA região "adiciona preto".
   * ⚠ TODAS as regiões "removem preto" (revelam).
   *
   * RESULTADO:
   *   ██████████████████████████████  ← superfície escura
   *   ██████         ███████████████  ← rect recortado
   *   ██████  ─────  ███████████████  ← brush recortada
   *   ██████         ███████████████
   *
   * A opacidade da shadowSurface controla o quanto a escuridão
   * aparece. Se opacity = 0.75, áreas não reveladas são 75%
   * escuras, áreas reveladas são 0% escuras.
   */
  private drawFogGeometry(context: Konva.Context): void {
    const regions = this.fogService.regions();
    const ctx = (context as any)._context as CanvasRenderingContext2D;

    // save/restore para não contaminar o estado do canvas
    ctx.save();

    // ──────────────────────────────────────────────────
    // PASSO 1: Superfície escura ÚNICA
    // ──────────────────────────────────────────────────
    // Um retângulo preto massivo que cobre tudo.
    // 200.000 x 200.000 é mais que suficiente para qualquer
    // mapa, e as coordenadas -100.000 a +100.000 garantem
    // cobertura mesmo com câmera com zoom out extremo.
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000000';
    ctx.fillRect(-100000, -100000, 200000, 200000);

    // ──────────────────────────────────────────────────
    // PASSO 2: RECORTAR (revelar) cada região
    // ──────────────────────────────────────────────────
    // destination-out: a operação REMOVE pixels pretos onde
    // desenhamos, criando "buracos" na escuridão.
    //
    // IMPORTANTE: destination-out é IDEMPOTENTE.
    // Desenhar duas vezes o mesmo local NÃO acumula alpha.
    // O resultado é idêntico a desenhar uma vez.
    ctx.globalCompositeOperation = 'destination-out';

    for (const region of regions) {
      if (region.type === 'rectangle') {
        // Recorte retangular
        ctx.fillStyle = '#000000';
        ctx.fillRect(
          region.x,
          region.y,
          region.width ?? 100,
          region.height ?? 100,
        );
      } else if (region.type === 'brush' && region.points && region.points.length >= 4) {
        // Recorte brush (stroke grosso que "apaga" escuridão)
        const pts = region.points;
        ctx.beginPath();
        ctx.lineWidth = 40;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#000000';
        ctx.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) {
          ctx.lineTo(pts[i], pts[i + 1]);
        }
        ctx.stroke();
      }
    }

    // ──────────────────────────────────────────────────
    // PASSO 3: PREVIEW (temporário, se desenhando)
    // ──────────────────────────────────────────────────
    // O preview também usa destination-out para mostrar
    // ao jogador onde ele está "revelando" (cortando)
    // a escuridão.
    //
    // Isto garante:
    // ✔ Preview com mesmo visual do resultado final
    // ✔ Sem alpha stacking com regiões já existentes
    // ✔ Preview some ao finish/cancel sem residual visual
    if (this.previewState) {
      if (this.previewState.type === 'rect') {
        ctx.fillStyle = '#000000';
        ctx.fillRect(
          this.previewState.x,
          this.previewState.y,
          this.previewState.w,
          this.previewState.h,
        );
      } else if (this.previewState.type === 'brush' && this.previewState.points.length >= 4) {
        const pts = this.previewState.points;
        ctx.beginPath();
        ctx.lineWidth = 40;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#000000';
        ctx.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) {
          ctx.lineTo(pts[i], pts[i + 1]);
        }
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // ═══════════════════════════════════════════════════════
  // PREVIEW STATE — Tipos de preview
  // ═══════════════════════════════════════════════════════

  /** Preview de retângulo sendo desenhado */
  private setPreviewRect(x: number, y: number, w: number, h: number): void {
    this.previewState = { type: 'rect', x, y, w, h };
  }

  /** Preview de brush sendo desenhado */
  private setPreviewBrush(points: number[]): void {
    this.previewState = { type: 'brush', points: [...points] };
  }

  /** Limpa o preview */
  private clearPreview(): void {
    this.previewState = null;
  }

  // ═══════════════════════════════════════════════════════
  // DRAWING — Preview temporário
  // ═══════════════════════════════════════════════════════

  /**
   * Inicia desenho de retângulo de revelação.
   *
   * O preview NÃO é adicionado como Konva.Rect na layer.
   * Em vez disso, armazenamos coordenadas no previewState
   * e o sceneFunc desenha tudo junto com destination-out.
   */
  startRect(worldX: number, worldY: number): void {
    this.cancelDrawing();
    this.setPreviewRect(worldX, worldY, 0, 0);
    this.isDrawing = true;
  }

  updateRect(worldX: number, worldY: number): void {
    if (!this.previewState || this.previewState.type !== 'rect' || !this.isDrawing) return;
    const startX = this.previewState.x;
    const startY = this.previewState.y;
    this.previewState.x = Math.min(startX, worldX);
    this.previewState.y = Math.min(startY, worldY);
    this.previewState.w = Math.abs(worldX - startX);
    this.previewState.h = Math.abs(worldY - startY);
    this.redraw();
  }

  finishRect(): void {
    if (!this.previewState || this.previewState.type !== 'rect') return;
    const { x, y, w, h } = this.previewState;

    if (w > 5 && h > 5) {
      this.fogService.addRectRegion(x, y, w, h);
    }

    this.clearPreview();
    this.isDrawing = false;
    this.redraw();
  }

  startBrush(worldX: number, worldY: number): void {
    this.cancelDrawing();
    this.setPreviewBrush([worldX, worldY]);
    this.isDrawing = true;
  }

  updateBrush(worldX: number, worldY: number): void {
    if (!this.previewState || this.previewState.type !== 'brush' || !this.isDrawing) return;
    this.previewState.points.push(worldX, worldY);
    this.redraw();
  }

  finishBrush(): void {
    if (!this.previewState || this.previewState.type !== 'brush') {
      this.clearPreview();
      this.isDrawing = false;
      this.redraw();
      return;
    }

    const pts = [...this.previewState.points];

    if (pts.length >= 4) {
      this.fogService.addBrushRegion(pts);
    }

    this.clearPreview();
    this.isDrawing = false;
    this.redraw();
  }

  cancelDrawing(): void {
    this.clearPreview();
    this.isDrawing = false;
    this.redraw();
  }

  // ═══════════════════════════════════════════════════════
  // DOOR SYNC
  // ═══════════════════════════════════════════════════════

  private syncDoors(regions: any[]): void {
    const allDoorIds = new Set<string>();

    for (const region of regions) {
      for (const door of region.doors) {
        allDoorIds.add(door.id);
        this.getOrCreateDoorShape(door);
      }
    }

    for (const [id] of this.doorShapes) {
      if (!allDoorIds.has(id)) {
        this.doorShapes.get(id)?.destroy();
        this.doorShapes.delete(id);
      }
    }
  }

  private getOrCreateDoorShape(door: any): Konva.Group {
    let group = this.doorShapes.get(door.id);
    if (group) {
      this.updateDoorVisual(group, door);
      return group;
    }

    group = new Konva.Group({
      name: `door-${door.id}`,
      x: door.x,
      y: door.y,
      listening: true,
    });

    const doorRect = new Konva.Rect({
      x: -door.width / 2,
      y: -5,
      width: door.width,
      height: 10,
      fill: door.open ? 'transparent' : '#000000',
      stroke: '#8B4513',
      strokeWidth: 1.5,
      cornerRadius: 1,
      name: 'door-bg',
    });
    group.add(doorRect);

    if (door.open) {
      group.add(new Konva.Line({
        points: [-door.width / 4, -3, -door.width / 4, 3],
        stroke: '#4fc3f7', strokeWidth: 2, name: 'door-open-line',
      }));
      group.add(new Konva.Line({
        points: [door.width / 4, -3, door.width / 4, 3],
        stroke: '#4fc3f7', strokeWidth: 2, name: 'door-open-line',
      }));
    } else {
      group.add(new Konva.Rect({
        x: -door.width / 2, y: -2, width: door.width, height: 4,
        fill: '#5D4037', name: 'door-closed-bar',
      }));
      group.add(new Konva.Circle({
        x: 0, y: 0, radius: 3, fill: '#FFD700',
        stroke: '#B8860B', strokeWidth: 1, name: 'door-lock',
      }));
    }

    const label = new Konva.Text({
      text: door.open ? 'Aberta' : 'Fechada',
      fontSize: 10, fontFamily: 'sans-serif',
      fill: door.open ? '#4fc3f7' : '#FFD700',
      align: 'center', width: 60, offsetX: 30, y: -18,
      visible: false, name: 'door-label', listening: false,
    });
    group.add(label);

    group.on('mouseenter', () => {
      const lbl = group!.findOne('.door-label') as Konva.Text;
      if (lbl) lbl.visible(true);
      this.layer.batchDraw();
    });
    group.on('mouseleave', () => {
      const lbl = group!.findOne('.door-label') as Konva.Text;
      if (lbl) lbl.visible(false);
      this.layer.batchDraw();
    });
    group.on('dblclick', (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      this.fogService.toggleDoor(door.id);
      this.layer.batchDraw();
    });

    this.doorGroup.add(group);
    this.doorShapes.set(door.id, group);
    return group;
  }

  private updateDoorVisual(group: Konva.Group, door: any): void {
    group.position({ x: door.x, y: door.y });

    const bg = group.findOne('.door-bg') as Konva.Rect;
    if (bg) {
      bg.width(door.width);
      bg.fill(door.open ? 'transparent' : '#000000');
    }

    group.find('.door-open-line').forEach(l => l.visible(door.open));
    const closedBar = group.findOne('.door-closed-bar') as Konva.Rect;
    if (closedBar) closedBar.visible(!door.open);
    const lock = group.findOne('.door-lock') as Konva.Circle;
    if (lock) lock.visible(!door.open);
    const lbl = group.findOne('.door-label') as Konva.Text;
    if (lbl) {
      lbl.text(door.open ? 'Aberta' : 'Fechada');
      lbl.fill(door.open ? '#4fc3f7' : '#FFD700');
    }
  }

  // ═══════════════════════════════════════════════════════
  // CLEAR
  // ═══════════════════════════════════════════════════════

  override clear(): void {
    this.shadowSurface.destroy();
    this.shadowSurface = new Konva.Shape({
      sceneFunc: (context) => {
        this.drawFogGeometry(context);
      },
      opacity: this.fogService.opacity(),
      listening: false,
      name: 'fog-shadow-surface',
    });
    this.layer.add(this.shadowSurface);

    this.cancelDrawing();

    for (const [, node] of this.doorShapes) {
      node.destroy();
    }
    this.doorShapes.clear();
    this.doorGroup.destroy();
    this.doorGroup = new Konva.Group({
      name: 'fog-doors',
      listening: false,
    });
    this.layer.add(this.doorGroup);
  }

  override destroy(): void {
    this.shadowSurface.destroy();
    for (const [, node] of this.doorShapes) {
      node.destroy();
    }
    this.doorShapes.clear();
    this.doorGroup.destroy();
    this.cancelDrawing();
    super.destroy();
  }
}

// ═══════════════════════════════════════════════════════════
// PREVIEW STATE TYPES
// ═══════════════════════════════════════════════════════════

/**
 * Preview de retângulo sendo desenhado.
 * Armazenado como dado, NÃO como Konva node.
 */
interface PreviewRectState {
  type: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Preview de brush sendo desenhado.
 * Armazenado como dado, NÃO como Konva node.
 */
interface PreviewBrushState {
  type: 'brush';
  points: number[];
}
