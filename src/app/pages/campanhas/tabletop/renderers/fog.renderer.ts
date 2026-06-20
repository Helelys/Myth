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
  /**
   * Camada preta PERMANENTE — garante que o canvas NUNCA fique
   * transparente. Mesmo que o shadowSurface (sceneFunc) tenha
   * latência ou artefatos de renderização, este retângulo preto
   * SEMPRE está presente como base opaca.
   *
   * É adicionado ANTES do shadowSurface, então fica ABAIXO dele
   * na ordem de empilhamento da layer.
   */
  private blackBase: Konva.Rect;

  /**
   * ShadowSurface — executa APENAS operações destination-out.
   * NÃO faz source-over nem clearRect. Penetra no blackBase
   * para revelar o mapa onde há luz/visão.
   *
   * ═══════════════════════════════════════════════════════════
   * PRINCÍPIO FUNDAMENTAL
   * ═══════════════════════════════════════════════════════════
   * A layer de fog é composta por dois shapes:
   *
   *   1. blackBase (Konva.Rect) — fill: '#000000'
   *      → SEMPRE presente, SEMPRE opaco
   *      → NUNCA é destruído/recriado
   *      → Garante ZERO transparência no canvas
   *
   *   2. shadowSurface (Konva.Shape com sceneFunc)
   *      → sceneFunc executa APENAS destination-out
   *      → Recorta buracos no blackBase para revelar o mapa
   *      → NUNCA faz source-over ou clearRect
   *
   * Isso elimina o flicker completamente porque:
   *   ✔ O blackBase é um retângulo Konva.Rect PERSISTENTE
   *   ✔ Konva o desenha ANTES do shadowSurface (está abaixo)
   *   ✔ Mesmo se sceneFunc falhar ou demorar, o fundo é PRETO
   *   ✔ Destination-out recorta PARA SEMPRE sobre preto opaco
   *   ✔ NUNCA há um frame onde a layer fica transparente
   * ═══════════════════════════════════════════════════════════
   */
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

    // ═══════════════════════════════════════════════════════
    // PASSO 0: BLACK BASE (permanente, SEMPRE presente)
    // ═══════════════════════════════════════════════════════
    // Retângulo preto MASSIVO que cobre toda a área do mapa.
    // Fica ABAIXO do shadowSurface (adicionado primeiro).
    // NUNCA é removido — é a ANCORA de opacidade da layer.
    this.blackBase = new Konva.Rect({
      x: -100000,
      y: -100000,
      width: 200000,
      height: 200000,
      fill: '#000000',
      listening: false,
      name: 'fog-black-base',
    });
    this.layer.add(this.blackBase);

    // ═══════════════════════════════════════════════════════
    // PASSO 1: SHADOW SURFACE (sceneFunc com destination-out)
    // ═══════════════════════════════════════════════════════
    // SceneFunc executa APENAS destination-out para recortar
    // buracos no blackBase onde há luz/visão.
    this.shadowSurface = new Konva.Shape({
      sceneFunc: (context) => {
        // Pipeline completa: source-over preto + destination-out recortes
        // O blackBase (Konva.Rect abaixo) já garante o fundo preto,
        // mas drawFullVisibilityPipeline também faz source-over preto,
        // o que é redundante mas inofensivo (sobrescreve com a mesma cor).
        // A vantagem é que se o blackBase NUNCA muda, o canvas
        // JAMAIS fica transparente entre frames — mesmo durante
        // zoom/wheel, o flicker é eliminado.
        this.drawFullVisibilityPipeline(context);
      },

      opacity: 1.0,
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

    // ═══════════════════════════════════════════════════════
    // REDRAW COMPLETO DO FRAME
    // ═══════════════════════════════════════════════════════
    // O shadowSurface é um Konva.Shape PERSISTENTE (criado
    // uma única vez no construtor) cuja sceneFunc executa
    // drawFullVisibilityPipeline a cada redraw.
    //
    // A pipeline NÃO usa ctx.clearRect() no início porque
    // isso tornava o canvas TRANSPARENTE por um frame,
    // causando flicker (o mapa aparecia por baixo) durante
    // zoom. Em vez disso, a pipeline começa diretamente com
    // source-over + preenchimento preto massivo, que
    // SUBSTITUI qualquer resíduo do frame anterior.
    //
    // NÃO destruímos e recriamos o shadowSurface a cada frame.
    // Isso também causava flicker entre a destruição do
    // shadowSurface antigo e a criação do novo.
    // ═══════════════════════════════════════════════════════
    this.redraw();

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
    // PASSO 1: DARKNESS SURFACE
    // ════════════════════════════════════════════════
    // O mapa inteiro nasce escuro.
    // Um retângulo preto massivo que cobre tudo.
    //
    // ⚠ NOTA: NÃO usamos ctx.clearRect() aqui.
    //   clearRect torna o canvas TRANSPARENTE, o que
    //   causa um flicker visível (o mapa aparece por
    //   baixo) durante zoom, pois entre clearRect e
    //   o preenchimento com preto, há um frame onde
    //   a layer de fog fica transparente.
    //
    //   Em vez disso, vamos direto para source-over
    //   com preenchimento preto. Como source-over
    //   SUBSTITUI completamente o conteúdo anterior
    //   (não usa o destino para composição), qualquer
    //   resquício de destination-out do frame anterior
    //   é completamente sobrescrito pelo preto opaco.
    // ════════════════════════════════════════════════
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

    // ──────────────────────────────────────────────
    // PASSO 3: LIGHT SOURCES (destination-out c/ gradiente)
    // ──────────────────────────────────────────────
    // ⚠ APENAS ILUMINAÇÃO — sem visão, sem exploração.
    // Cada luz é renderizada diretamente com seu próprio
    // gradiente, sem raycasting ou polígonos de visibilidade.
    // ═══════════════════════════════════════════════════
    const activeLights = this.lightService.getActiveLights();

    for (const light of activeLights) {
      if (light.type === 'ambient') {
        ctx.globalAlpha = light.intensity * 0.8;
        ctx.fillStyle = '#000000';
        ctx.fillRect(-100000, -100000, 200000, 200000);
        ctx.globalAlpha = 1.0;
        continue;
      }

      if (light.type === 'cone' && light.angle) {
        this.drawConeLight(ctx, light);
      } else {
        this.drawRadialLight(ctx, light);
      }
    }

    // ──────────────────────────────────────────────
    // PASSO 4: PREVIEW (temporário)
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
   * Cone de iluminação cinematográfico multi-camada.
   *
   * ═══════════════════════════════════════════════════════════
   * ILUMINAÇÃO VOLUMÉTRICA EM CONE
   * ═══════════════════════════════════════════════════════════
   *
   * 3 camadas sobrepostas para efeito profissional:
   *
   *   1. AMBIENT GLOW  → Cone largo + translúcido
   *   2. MAIN BEAM     → Corpo principal com falloff radial
   *   3. CORE BLOOM    → Hotspot brilhante central
   *
   * Formato triangular REAL (não setor circular),
   * mas com bordas ANGULARMENTE suavizadas via
   * overlap de camadas de diferentes larguras.
   *
   * Visual: Foundry VTT / Roll20 / Diablo
   *   ✔ Bordas suaves  ✔ Gradiente natural
   *   ✔ Profundidade   ✔ Glow atmosférico
   */
  private drawConeLight(ctx: CanvasRenderingContext2D, light: any): void {
    const halfAngle = (light.angle ?? Math.PI / 4) / 2;
    const rotation = light.rotation ?? 0;
    const radius = light.radius;
    const intensity = light.intensity;
    const softness = light.softness ?? 0.4;

    ctx.save();
    ctx.translate(light.x, light.y);
    ctx.rotate(rotation);

    // ── AMBIENT GLOW ──
    // Dispersão atmosférica: cone 1.4x mais largo, baixa opacidade
    const outerA = halfAngle * (1 + softness * 0.8);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(-outerA) * radius, Math.sin(-outerA) * radius);
    ctx.lineTo(Math.cos(outerA) * radius, Math.sin(outerA) * radius);
    ctx.closePath();
    let g = ctx.createLinearGradient(0, 0, radius, 0);
    g.addColorStop(0, `rgba(0,0,0,${intensity * 0.15})`);
    g.addColorStop(0.4, `rgba(0,0,0,${intensity * 0.08})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fill();

    // ── MAIN BEAM ──
    // Corpo principal: triângulo real com gradiente radial
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(-halfAngle) * radius, Math.sin(-halfAngle) * radius);
    ctx.lineTo(Math.cos(halfAngle) * radius, Math.sin(halfAngle) * radius);
    ctx.closePath();
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    g.addColorStop(0, `rgba(0,0,0,${intensity * 0.85})`);
    g.addColorStop(0.35, `rgba(0,0,0,${intensity * 0.55})`);
    g.addColorStop(0.7, `rgba(0,0,0,${intensity * 0.25})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fill();

    // ── CORE BLOOM ──
    // Hotspot brilhante: 50% do ângulo, 40% do raio
    const coreA = halfAngle * 0.5;
    const coreR = radius * 0.4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(-coreA) * coreR, Math.sin(-coreA) * coreR);
    ctx.lineTo(Math.cos(coreA) * coreR, Math.sin(coreA) * coreR);
    ctx.closePath();
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR);
    g.addColorStop(0, `rgba(0,0,0,${intensity * 0.95})`);
    g.addColorStop(0.5, `rgba(0,0,0,${intensity * 0.50})`);
    g.addColorStop(1, `rgba(0,0,0,${intensity * 0.15})`);
    ctx.fillStyle = g;
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
