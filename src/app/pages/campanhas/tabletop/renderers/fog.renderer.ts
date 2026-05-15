import Konva from 'konva';
import { BaseRenderer } from './base-renderer';
import { LayerType, FogShape } from '../models';
import { CameraService, FogService } from '../services';

/**
 * Renderer do Fog of War — VERSÃO BASEADA EM SHAPES.
 *
 * Renderiza shapes de fog como Konva.Rect e Konva.Line.
 *
 * Cada fog shape é um retângulo preto ou uma linha (brush) preta.
 * A opacidade da layer controla a intensidade da neblina.
 */
export class FogRenderer extends BaseRenderer {
  private shapeNodes = new Map<string, Konva.Rect | Konva.Line>();
  private drawingRect: Konva.Rect | null = null;
  private brushPoints: number[] = [];
  private brushLine: Konva.Line | null = null;
  isDrawing = false;

  constructor(
    stage: Konva.Stage,
    private fogService: FogService,
  ) {
    super(LayerType.Fog, stage);
    this.layer.listening(true);
  }

  override render(camera: CameraService): void {
    const fogEnabled = this.fogService.enabled();
    const gmVision = this.fogService.gmVision();

    if (!fogEnabled || gmVision) {
      this.layer.visible(false);
      return;
    }

    this.layer.visible(true);
    this.layer.opacity(this.fogService.opacity());

    const currentShapes = this.fogService.shapes();
    const currentIds = new Set(currentShapes.map((s) => s.id));

    for (const [id, node] of this.shapeNodes) {
      if (!currentIds.has(id)) {
        node.destroy();
        this.shapeNodes.delete(id);
      }
    }

    for (const shape of currentShapes) {
      this.getOrCreateShapeNode(shape);
    }

    this.redraw();
  }

  private getOrCreateShapeNode(shape: FogShape): void {
    if (this.shapeNodes.has(shape.id)) return;

    let node: Konva.Rect | Konva.Line;

    if (shape.type === 'rectangle') {
      node = new Konva.Rect({
        x: shape.x,
        y: shape.y,
        width: shape.width ?? 100,
        height: shape.height ?? 100,
        fill: '#000000',
        stroke: '#000000',
        strokeWidth: 0,
        listening: false,
        name: `fog-rect-${shape.id}`,
      });
    } else {
      node = new Konva.Line({
        points: shape.points ?? [],
        stroke: '#000000',
        strokeWidth: 40,
        lineCap: 'round',
        lineJoin: 'round',
        tension: 0.3,
        closed: false,
        listening: false,
        name: `fog-brush-${shape.id}`,
      });
    }

    this.shapeNodes.set(shape.id, node);
    this.layer.add(node);
    this.redraw();
  }

  startRect(worldX: number, worldY: number): void {
    this.drawingRect = new Konva.Rect({
      x: worldX,
      y: worldY,
      width: 0,
      height: 0,
      fill: '#000000',
      stroke: '#000000',
      strokeWidth: 0,
      listening: false,
      name: 'fog-drawing-rect',
    });
    this.layer.add(this.drawingRect);
    this.isDrawing = true;
  }

  updateRect(worldX: number, worldY: number): void {
    if (!this.drawingRect || !this.isDrawing) return;
    const startX = this.drawingRect.x();
    const startY = this.drawingRect.y();
    this.drawingRect.x(Math.min(startX, worldX));
    this.drawingRect.y(Math.min(startY, worldY));
    this.drawingRect.width(Math.abs(worldX - startX));
    this.drawingRect.height(Math.abs(worldY - startY));
    this.redraw();
  }

  finishRect(): void {
    if (!this.drawingRect) return;
    const rect = this.drawingRect;
    const rx = rect.x();
    const ry = rect.y();
    const rw = rect.width();
    const rh = rect.height();

    if (this.fogService.revealMode()) {
      // REVEAL: remove shapes na área do retângulo
      this.fogService.removeShapesInRect(rx, ry, rw, rh);
    } else {
      // ESCONDE: adiciona shape
      const shape = this.fogService.addShape({
        type: 'rectangle',
        x: rx,
        y: ry,
        width: rw,
        height: rh,
      });
      const node = new Konva.Rect({
        x: shape.x,
        y: shape.y,
        width: shape.width ?? 0,
        height: shape.height ?? 0,
        fill: '#000000',
        stroke: '#000000',
        strokeWidth: 0,
        listening: false,
        name: `fog-rect-${shape.id}`,
      });
      this.shapeNodes.set(shape.id, node);
      this.layer.add(node);
    }

    rect.destroy();
    this.drawingRect = null;
    this.isDrawing = false;
    this.redraw();
  }

  startBrush(worldX: number, worldY: number): void {
    this.brushPoints = [worldX, worldY];
    this.brushLine = new Konva.Line({
      points: this.brushPoints,
      stroke: '#000000',
      strokeWidth: 40,
      lineCap: 'round',
      lineJoin: 'round',
      tension: 0.3,
      closed: false,
      listening: false,
      name: 'fog-drawing-brush',
    });
    this.layer.add(this.brushLine);
    this.isDrawing = true;
  }

  updateBrush(worldX: number, worldY: number): void {
    if (!this.isDrawing || !this.brushLine) return;
    this.brushPoints.push(worldX, worldY);
    this.brushLine.points(this.brushPoints);
    this.redraw();
  }

  finishBrush(): void {
    if (!this.brushLine || this.brushPoints.length < 4) {
      this.brushLine?.destroy();
      this.brushLine = null;
      this.brushPoints = [];
      this.isDrawing = false;
      this.redraw();
      return;
    }

    const pts = [...this.brushPoints];

    if (this.fogService.revealMode()) {
      // REVEAL: remove shapes que interseptam o brush stroke
      this.fogService.removeShapesInBrushBounds(pts, 40);
    } else {
      // ESCONDE: adiciona shape
      const shape = this.fogService.addShape({
        type: 'brush',
        x: pts[0],
        y: pts[1],
        points: pts,
      });
      const node = new Konva.Line({
        points: shape.points ?? [],
        stroke: '#000000',
        strokeWidth: 40,
        lineCap: 'round',
        lineJoin: 'round',
        tension: 0.3,
        closed: false,
        listening: false,
        name: `fog-brush-${shape.id}`,
      });
      this.shapeNodes.set(shape.id, node);
      this.layer.add(node);
    }

    this.brushLine.destroy();
    this.brushLine = null;
    this.brushPoints = [];
    this.isDrawing = false;
    this.redraw();
  }

  cancelDrawing(): void {
    if (this.drawingRect) {
      this.drawingRect.destroy();
      this.drawingRect = null;
    }
    if (this.brushLine) {
      this.brushLine.destroy();
      this.brushLine = null;
    }
    this.brushPoints = [];
    this.isDrawing = false;
    this.redraw();
  }

  override clear(): void {
    for (const [, node] of this.shapeNodes) {
      node.destroy();
    }
    this.shapeNodes.clear();
    this.cancelDrawing();
    super.clear();
  }
}
