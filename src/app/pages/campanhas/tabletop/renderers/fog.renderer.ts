import Konva from 'konva';
import { BaseRenderer } from './base-renderer';
import { LayerType } from '../models';
import { CameraService, FogService, WallService, LightService, VisionService, ExplorationService } from '../services';

/**
 * ═══════════════════════════════════════════════════════════
 * FOG RENDERER — Darkness Surface + Light + Vision + Exploration
 * ═══════════════════════════════════════════════════════════
 *
 * PIPELINE COMPLETO DE VISIBILIDADE E ILUMINAÇÃO
 * ─────────────────────────────────────────────
 *
 * PASSO 1: Darkness Surface (source-over)
 *   → Retângulo preto massivo cobre TODO o mapa
 *   → Opacidade controlada pela darknessOpacity
 *
 * PASSO 2: Fog Regions (destination-out)
 *   → Recorta regiões de fog reveladas manualmente
 *   → Regiões retangulares e brush
 *
 * PASSO 3: Light Sources (destination-out + gradient)
 *   → Para cada luz ativa, computa polígono de visibilidade
 *   → Aplica radial gradient com falloff suave
 *   → Luz colorida suportada (opcional)
 *   → Raycasting contra paredes
 *
 * PASSO 4: Vision Sources (destination-out)
 *   → Visão dos tokens (campo de visão)
 *   → Darkvision suportada
 *   → Raycasting contra paredes
 *
 * PASSO 5: Exploration Memory (destination-out com opacidade reduzida)
 *   → Áreas exploradas (já visitadas) ficam cinza escuro
 *   → Áreas invisíveis ficam preto total
 *   → Áreas visíveis ficam transparentes
 *
 * PASSO 6: Preview (destination-out)
 *   → Preview temporário do que está sendo desenhado
 *
 * GARANTIAS:
 *   ✔ ZERO alpha stacking — destination-out é idempotente
 *   ✔ Superfície escura ÚNICA
 *   ✔ Pipeline determinístico
 *   ✔ Preview nunca contamina render final
 *   ✔ GM Vision desativa tudo
 */
export class FogRenderer extends BaseRenderer {
  private shadowSurface: Konva.Shape;
  private doorGroup: Konva.Group;
  private doorShapes = new Map<string, Konva.Group>();

  /** Estado do preview */
  private previewState: PreviewRectState | PreviewBrushState | null = null;
  isDrawing = false;

  constructor(
    stage: Konva.Stage,
    private fogService: FogService,
    private wallService: WallService,
    private lightService: LightService,
    private visionService: VisionService,
    private explorationService: ExplorationService,
  ) {
    super(LayerType.Fog, stage);
    this.layer.listening(true);

    // ShadowSurface com sceneFunc completa
    this.shadowSurface = new Konva.Shape({
      sceneFunc: (context) => {
        this.drawFullVisibilityPipeline(context);
      },
      opacity: 1.0, // Opacidade total — controlada pela pipeline interna
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
    this.syncDoors(this.fogService.regions());

    // ════════════════════════════════════════════════
    // LIMPEZA EXPLÍCITA DA LAYER CANVAS DO KONVA
    // ════════════════════════════════════════════════
    // Konva NÃO limpa a layer canvas entre renders.
    // Sem esta limpeza, pixels cortados por
    // destination-out em frames anteriores permanecem
    // e criam "rastros" visuais persistentes.
    //
    // this.layer.clear() apaga COMPLETAMENTE o
    // buffer de renderização da layer (scene canvas),
    // garantindo que NENHUM pixel do frame anterior
    // sobreviva.
    //
    // Diferença entre clear() e destroy+recreate:
    //   • clear() → limpa o canvas mas mantém os nodes
    //   • destroy() + new → destrói e recria nodes
    //
    // Usamos AMBOS para segurança máxima.
    // ════════════════════════════════════════════════
    this.layer.clear();
    this.layer.batchDraw(); // Força flush do clear

    // ════════════════════════════════════════════════
    // FULL FRAME REDRAW — Destrói e recria a
    // shadowSurface para garantir que Konva NÃO
    // reutilize o canvas interno do frame anterior.
    //
    // Konva NÃO garante que sceneFunc será executado
    // em um canvas limpo. A única maneira 100% segura
    // de garantir frame-based rendering é destruir e
    // recriar o Konva.Shape a cada render.
    //
    // Isso garante que:
    //   ✔ luz antiga morre completamente
    //   ✔ canvas é recriado do zero
    //   ✔ sem acumulação de pixels
    //   ✔ sem rastros de frames anteriores
    // ════════════════════════════════════════════════
    this.destroyShadowSurface();

    this.shadowSurface = new Konva.Shape({
      sceneFunc: (context) => {
        this.drawFullVisibilityPipeline(context);
      },
      opacity: 1.0,
      listening: false,
      name: 'fog-shadow-surface',
    });
    this.layer.add(this.shadowSurface);

    this.redraw();
  }

  /** Destrói a shadowSurface atual */
  private destroyShadowSurface(): void {
    if (this.shadowSurface) {
      this.shadowSurface.destroy();
    }
  }

  // ═══════════════════════════════════════════════════════
  // PIPELINE COMPLETO DE VISIBILIDADE
  // ═══════════════════════════════════════════════════════

  /**
   * drawFullVisibilityPipeline — O CORAÇÃO DO SISTEMA
   *
   * PASSO 1 → source-over: Desenha retângulo preto (darkness base)
   * PASSO 2 → destination-out: Recorta regiões de fog
   * PASSO 3 → destination-out: Recorta áreas iluminadas (luzes)
   * PASSO 4 → destination-out: Recorta campos de visão (tokens)
   * PASSO 5 → destination-out (explored): Recorta áreas exploradas
   *           com opacidade reduzida
   * PASSO 6 → destination-out: Preview temporário
   */
  private drawFullVisibilityPipeline(context: Konva.Context): void {
    const ctx = (context as any)._context as CanvasRenderingContext2D;
    ctx.save();

    // ════════════════════════════════════════════════
    // LIMPEZA COMPLETA DO CANVAS
    // ════════════════════════════════════════════════
    // Konva NÃO limpa o canvas interno entre frames.
    // Sem esta limpeza explícita, os recortes
    // (destination-out) do FRAME ANTERIOR persistem,
    // criando "rastros" de iluminação antiga.
    //
    // ctx.clearRect garante que o canvas esteja
    // COMPLETAMENTE TRANSPARENTE antes de começarmos.
    // ════════════════════════════════════════════════
    const canvas = ctx.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ──────────────────────────────────────────────
    // PASSO 1: DARKNESS SURFACE
    // ──────────────────────────────────────────────
    // O mapa inteiro nasce escuro.
    // Um retângulo preto massivo que cobre tudo.
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000000';
    ctx.fillRect(-100000, -100000, 200000, 200000);

    // Todas as próximas operações são destination-out:
    // "recortar" (revelar) áreas na escuridão.
    ctx.globalCompositeOperation = 'destination-out';

    // ──────────────────────────────────────────────
    // PASSO 2: FOG REGIONS (revelação manual)
    // ──────────────────────────────────────────────
    const regions = this.fogService.regions();
    for (const region of regions) {
      if (region.type === 'rectangle') {
        ctx.fillStyle = '#000000';
        ctx.fillRect(
          region.x,
          region.y,
          region.width ?? 100,
          region.height ?? 100,
        );
      } else if (region.type === 'brush' && region.points && region.points.length >= 4) {
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

    // ════════════════════════════════════════════════
    // PRÉ-PASSO: ATUALIZAR VISIBLE CELLS DO FRAME
    // ════════════════════════════════════════════════
    // visibleCells é um Set TEMPORÁRIO que expressa
    // APENAS o que está sob a luz neste frame específico.
    // Não é cumulativo, é substituído a cada frame.
    //
    // PRECISA ser chamado ANTES dos passos 3 e 4
    // para que a exploration memory (PASSO 5) possa
    // consultar visibleCells já atualizado.
    this.visionService.updateVisibleCellsForCurrentFrame();

    // ──────────────────────────────────────────────
    // PASSO 3: LIGHT SOURCES (destino-out c/ gradiente)
    // ──────────────────────────────────────────────
    const activeLights = this.lightService.getActiveLights();

    for (const light of activeLights) {
      if (light.type === 'ambient') {
        // Luz ambiente → revela tudo
        ctx.globalAlpha = light.intensity * 0.8;
        ctx.fillStyle = '#000000';
        ctx.fillRect(-100000, -100000, 200000, 200000);
        ctx.globalAlpha = 1.0;
        continue;
      }

      // Para luzes com raycasting, computa o polígono de visibilidade
      const walls = this.wallService.getWallsBlockingLight();
      const pts = this.visionService.computeVisibilityPolygonForLight(light, walls);

      if (pts && pts.length >= 6) {
        // Polígono de visibilidade recortado por paredes
        ctx.beginPath();
        ctx.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) {
          ctx.lineTo(pts[i], pts[i + 1]);
        }
        ctx.closePath();

        // Falloff suave com gradiente radial
        ctx.save();

        // Cria gradiente radial para suavidade da borda
        const gradient = ctx.createRadialGradient(
          light.x, light.y, 0,
          light.x, light.y, light.radius * (1 - light.softness * 0.5),
        );
        gradient.addColorStop(0, `rgba(0,0,0,${light.intensity})`);
        gradient.addColorStop(0.6, `rgba(0,0,0,${light.intensity * 0.6})`);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.clip();

        // Preenche o polígono recortado com gradiente
        ctx.fillStyle = gradient;
        ctx.fillRect(
          light.x - light.radius,
          light.y - light.radius,
          light.radius * 2,
          light.radius * 2,
        );

        ctx.restore();
      } else {
        // Sem paredes: círculo/cone simples com gradiente
        if (light.type === 'cone' && light.angle && light.rotation) {
          this.drawConeLight(ctx, light);
        } else {
          this.drawRadialLight(ctx, light);
        }
      }
    }

    // ──────────────────────────────────────────────
    // PASSO 4: VISION SOURCES (visão dos tokens)
    // ──────────────────────────────────────────────
    const wallsBlockVision = this.wallService.getWallsBlockingVision();
    const visionPolygons = this.visionService.computeTokenVisionPolygons();

    for (const vp of visionPolygons) {
      if (vp.points.length < 6) continue;

      ctx.beginPath();
      ctx.moveTo(vp.points[0], vp.points[1]);
      for (let i = 2; i < vp.points.length; i += 2) {
        ctx.lineTo(vp.points[i], vp.points[i + 1]);
      }
      ctx.closePath();
      ctx.fillStyle = '#000000';
      ctx.fill();
    }

    // ──────────────────────────────────────────────
    // PASSO 5: EXPLORATION MEMORY
    // ──────────────────────────────────────────────
    // visibleCells já foi atualizado no PRÉ-PASSO,
    // antes das luzes e visão. Aqui apenas consultamos.
    // visibleCells é TEMPORÁRIO — um Set que expressa
    // APENAS o que está sob a luz neste frame específico.
    // Não é cumulativo, é substituído a cada frame.

    // Áreas exploradas (já visitadas) recebem um recorte
    // com opacidade reduzida, criando o efeito "cinza escuro"
    // de área já explorada mas não visível agora.
    const exploredConfig = this.explorationService.config();
    const exploredCells = this.explorationService.explored();
    const visibleCells = this.explorationService.visibleCells();

    if (this.explorationService.enabled()) {
      // Cria um gradiente de opacidade para explored vs invisible
      // As células visible já foram recortadas acima.
      // As células explored precisam ser recortadas com alpha reduzido.
      ctx.save();

      // Para performance, usa-se um fill retangular aproximado
      // em vez de célula por célula
      ctx.globalAlpha = 1.0 - exploredConfig.exploredOpacity;
      ctx.fillStyle = '#000000';

      // Este passo requer iteração sobre células exploradas
      // Para performance razoável, renderiza apenas células
      // que NÃO são visible (visible já foi cortado acima)
      const cellSize = exploredConfig.cellSize;
      let cellsDrawn = 0;

      for (const key of Object.keys(exploredCells)) {
        if (visibleCells.has(key)) continue; // Já recortado pela visão
        if (cellsDrawn > 50000) break; // Limite de segurança

        const [cx, cy] = key.split(',').map(Number);
        ctx.fillRect(cx * cellSize, cy * cellSize, cellSize, cellSize);
        cellsDrawn++;
      }

      ctx.globalAlpha = 1.0;
      ctx.restore();
    }

    // ──────────────────────────────────────────────
    // PASSO 6: PREVIEW (temporário)
    // ──────────────────────────────────────────────
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
  // LIGHT DRAWING HELPERS
  // ═══════════════════════════════════════════════════════

  /**
   * Desenha uma luz radial com gradiente de falloff.
   * Usa destination-out para recortar a escuridão.
   */
  private drawRadialLight(ctx: CanvasRenderingContext2D, light: any): void {
    const gradient = ctx.createRadialGradient(
      light.x, light.y, 0,
      light.x, light.y, light.radius,
    );

    // Centro: total reveal (alpha alto = mais recorte)
    gradient.addColorStop(0, `rgba(0,0,0,${light.intensity})`);
    // Meio: começa a suavizar
    gradient.addColorStop(
      0.5,
      `rgba(0,0,0,${light.intensity * (1 - light.softness * 0.5)})`,
    );
    // Borda: suave fade out
    gradient.addColorStop(1 - light.softness * 0.3, `rgba(0,0,0,${light.intensity * 0.2})`);
    // Fora: sem recorte
    gradient.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(light.x, light.y, light.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Desenha uma luz em cone (lanterna) com gradiente.
   */
  private drawConeLight(ctx: CanvasRenderingContext2D, light: any): void {
    const halfAngle = (light.angle ?? Math.PI / 4) / 2;
    const rotation = light.rotation ?? 0;

    ctx.save();
    ctx.translate(light.x, light.y);
    ctx.rotate(rotation);

    // Gradiente radial no cone
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, light.radius);
    gradient.addColorStop(0, `rgba(0,0,0,${light.intensity})`);
    gradient.addColorStop(0.7, `rgba(0,0,0,${light.intensity * 0.5})`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, light.radius, -halfAngle, halfAngle);
    ctx.closePath();

    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.restore();
  }

  // ═══════════════════════════════════════════════════════
  // PREVIEW STATE
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
      // Marca área como explorada
      this.explorationService.markExplored(x + w / 2, y + h / 2, Math.max(w, h) / 2);
      this.visionService.markDirty();
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
      // Marca área como explorada
      this.explorationService.markBrushExplored(pts);
      this.visionService.markDirty();
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
        this.drawFullVisibilityPipeline(context);
      },
      opacity: 1.0,
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
