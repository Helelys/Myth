import { Injectable, signal, computed } from '@angular/core';
import { FogData, FogShape, DEFAULT_FOG_DATA } from '../models';

/**
 * Serviço de gerenciamento do Fog of War.
 *
 * Implementação baseada em SHAPES VETORIAIS (retângulos e brush).
 * Ao contrário da versão anterior (canvas-based), esta versão:
 * - Armazena shapes serializáveis (FogShape[])
 * - Cada shape é um retângulo ou uma linha de brush
 * - Persiste facilmente no localStorage
 * - Renderiza via Konva Rect + Line
 *
 * Modal + Reveal:
 * - fogMode: se o modo fog está ativo (toggle via F)
 * - revealMode: Ctrl+drag revela em vez de esconder
 *
 * Ordem de camadas:
 * Grid → Mapas → Fog → Tokens → UI
 */
@Injectable({ providedIn: 'root' })
export class FogService {
  private state = signal<FogData>({
    campaignId: '',
    ...DEFAULT_FOG_DATA,
  });

  /** Se o modo fog está ativo (modal toggle via F) */
  private _fogMode = signal(false);
  /** Se está em modo reveal (Ctrl pressionado durante drag) */
  private _revealMode = signal(false);

  readonly enabled = computed(() => this.state().enabled);
  readonly opacity = computed(() => this.state().opacity);
  readonly gmVision = computed(() => this.state().gmVision);
  readonly shapes = computed(() => this.state().shapes);
  readonly fogMode = this._fogMode.asReadonly();
  readonly revealMode = this._revealMode.asReadonly();

  private shapeIdCounter = 0;

  setCampaignId(id: string): void {
    this.state.update((s) => ({ ...s, campaignId: id }));
  }

  toggle(): void {
    this.state.update((s) => ({ ...s, enabled: !s.enabled }));
  }

  toggleGmVision(): void {
    this.state.update((s) => ({ ...s, gmVision: !s.gmVision }));
  }

  setOpacity(opacity: number): void {
    this.state.update((s) => ({ ...s, opacity: Math.max(0, Math.min(1, opacity)) }));
  }

  // ════════════════════════════════════════════════════════════
  // FOG MODE (Modal toggle)
  // ════════════════════════════════════════════════════════════

  /** Ativa/desativa o modo fog (modal — fica ativo até desligar) */
  toggleFogMode(): void {
    this._fogMode.update((v) => !v);
  }

  /** Sai do modo fog */
  exitFogMode(): void {
    this._fogMode.set(false);
  }

  // ════════════════════════════════════════════════════════════
  // REVEAL MODE (Ctrl)
  // ════════════════════════════════════════════════════════════

  setRevealMode(revealing: boolean): void {
    this._revealMode.set(revealing);
  }

  // ════════════════════════════════════════════════════════════
  // SHAPES
  // ════════════════════════════════════════════════════════════

  /** Adiciona uma shape de fog */
  addShape(shape: Omit<FogShape, 'id'>): FogShape {
    const id = `fog-${++this.shapeIdCounter}-${Date.now()}`;
    const newShape: FogShape = { id, ...shape };
    this.state.update((s) => ({ ...s, shapes: [...s.shapes, newShape] }));
    return newShape;
  }

  /** Remove uma shape pelo ID */
  removeShape(id: string): void {
    this.state.update((s) => ({
      ...s,
      shapes: s.shapes.filter((sh) => sh.id !== id),
    }));
  }

  /**
   * Remove shapes cujo centro esteja dentro do retângulo.
   * Usado no Reveal Mode com ferramenta retangular.
   */
  removeShapesInRect(rx: number, ry: number, rw: number, rh: number): void {
    this.state.update((s) => ({
      ...s,
      shapes: s.shapes.filter((sh) => {
        const cx = sh.x + (sh.width ?? 0) / 2;
        const cy = sh.y + (sh.height ?? 0) / 2;
        return !(cx >= rx && cx <= rx + rw && cy >= ry && cy <= ry + rh);
      }),
    }));
  }

  /**
   * Remove shapes que interseptam a bounding box de um brush stroke.
   * Usado no Reveal Mode com ferramenta brush.
   */
  removeShapesInBrushBounds(points: number[], brushWidth: number): void {
    if (points.length < 4) return;
    const bbox = this.computeBoundingBox(points, brushWidth);
    this.state.update((s) => ({
      ...s,
      shapes: s.shapes.filter((sh) => {
        const shapeBbox = this.shapeBoundingBox(sh);
        return !this.rectsOverlap(bbox, shapeBbox);
      }),
    }));
  }

  /** Remove todas as shapes */
  clearAll(): void {
    this.state.update((s) => ({ ...s, shapes: [] }));
  }

  getSnapshot(): FogData {
    return this.state();
  }

  loadFromSnapshot(fog: FogData): void {
    this.state.set(fog);
  }

  // ════════════════════════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════════════════════════

  private computeBoundingBox(
    points: number[],
    brushWidth: number,
  ): { x: number; y: number; width: number; height: number } {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < points.length; i += 2) {
      if (points[i] < minX) minX = points[i];
      if (points[i] > maxX) maxX = points[i];
      if (points[i + 1] < minY) minY = points[i + 1];
      if (points[i + 1] > maxY) maxY = points[i + 1];
    }
    const half = brushWidth / 2;
    return {
      x: minX - half,
      y: minY - half,
      width: maxX - minX + brushWidth,
      height: maxY - minY + brushWidth,
    };
  }

  private shapeBoundingBox(shape: FogShape): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    if (shape.type === 'rectangle') {
      return { x: shape.x, y: shape.y, width: shape.width ?? 0, height: shape.height ?? 0 };
    }
    // brush — estimar bounding box pelos points
    const pts = shape.points ?? [];
    return this.computeBoundingBox(pts, 40);
  }

  private rectsOverlap(
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
  ): boolean {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }
}
