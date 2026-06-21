import { Injectable, signal, computed } from '@angular/core';
import { FogRegion, FogDoor, FogData, DEFAULT_FOG_DATA } from '../models/fog-region.model';
import { createRectRegion, createBrushRegion } from '../utils/geometry-utils';

/**
 * ═══════════════════════════════════════════════════════════
 * FOG SERVICE (REFATORADO) — Sistema de neblina baseado em regiões
 * ═══════════════════════════════════════════════════════════
 *
 * AGORA usa FogRegion[] em vez de FogShape[].
 *
 * Mudanças principais:
 * - FogRegion tem bordas computadas (para colisão)
 * - FogRegion tem portas
 * - Manutenção de compatibilidade com FogData (serialização)
 * - addShape() migrado para criar FogRegion
 */
@Injectable({ providedIn: 'root' })
export class FogService {
  // ═══════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════

  private regionsSignal = signal<FogRegion[]>([]);
  private enabledSignal = signal(true);
  private gmVisionSignal = signal(true);
  private opacitySignal = signal(0.75);

  /** Regiões de fog ativas */
  readonly regions = this.regionsSignal.asReadonly();

  /** Se fog está habilitada */
  readonly enabled = this.enabledSignal.asReadonly();

  /** Se GM pode ver através da fog */
  readonly gmVision = this.gmVisionSignal.asReadonly();

  /** Opacidade da fog */
  readonly opacity = this.opacitySignal.asReadonly();

  /** Número de regiões de fog */
  readonly regionCount = computed(() => this.regionsSignal().length);

  // ═══════════════════════════════════════════════════════
  // FOG TOGGLE
  // ═══════════════════════════════════════════════════════

  toggleEnabled(): void {
    this.enabledSignal.update(v => !v);
  }

  toggleGmVision(): void {
    this.gmVisionSignal.update(v => !v);
  }

  setOpacity(value: number): void {
    this.opacitySignal.set(Math.max(0, Math.min(1, value)));
  }

  // ═══════════════════════════════════════════════════════
  // REGION CRUD
  // ═══════════════════════════════════════════════════════

  /**
   * Adiciona uma região retangular.
   * Mantido para compatibilidade com addShape({ type: 'rectangle', ... }).
   */
  addRectRegion(x: number, y: number, width: number, height: number): FogRegion {
    const region = createRectRegion(x, y, width, height);
    this.regionsSignal.update(list => [...list, region]);
    return region;
  }

  /**
   * Adiciona uma região brush.
   * Mantido para compatibilidade com addShape({ type: 'brush', ... }).
   */
  addBrushRegion(points: number[]): FogRegion {
    const region = createBrushRegion(points);
    this.regionsSignal.update(list => [...list, region]);
    return region;
  }

  /**
   * API de compatibilidade: aceita FogShape-like params e cria FogRegion.
   */
  addShape(shape: { type: 'rectangle' | 'brush'; x: number; y: number; width?: number; height?: number; points?: number[] }): FogRegion {
    if (shape.type === 'rectangle') {
      return this.addRectRegion(shape.x, shape.y, shape.width ?? 100, shape.height ?? 100);
    } else {
      return this.addBrushRegion(shape.points ?? [shape.x, shape.y, shape.x + 50, shape.y + 50]);
    }
  }

  /** Remove uma região */
  removeRegion(id: string): void {
    this.regionsSignal.update(list => list.filter(r => r.id !== id));
  }

  /** Obtém região por ID */
  getRegionById(id: string): FogRegion | undefined {
    return this.regionsSignal().find(r => r.id === id);
  }

  /** Remove todas as regiões */
  clearRegions(): void {
    this.regionsSignal.set([]);
  }

  // ═══════════════════════════════════════════════════════
  // DOOR MANAGEMENT
  // ═══════════════════════════════════════════════════════

  /** Adiciona uma porta a uma região */
  addDoor(regionId: string, door: FogDoor): void {
    this.regionsSignal.update(list =>
      list.map(r => {
        if (r.id !== regionId) return r;

        // Atualiza edge para incluir doorId
        const updatedEdges = r.edges.map(e => {
          if (e.index !== door.edgeIndex) return e;
          return {
            ...e,
            doorIds: [...e.doorIds, door.id],
          };
        });

        return {
          ...r,
          doors: [...r.doors, door],
          edges: updatedEdges,
        };
      }),
    );
  }

  /** Remove uma porta */
  removeDoor(doorId: string): void {
    this.regionsSignal.update(list =>
      list.map(r => {
        const door = r.doors.find(d => d.id === doorId);
        if (!door) return r;

        return {
          ...r,
          doors: r.doors.filter(d => d.id !== doorId),
          edges: r.edges.map(e => {
            if (e.index !== door.edgeIndex) return e;
            return {
              ...e,
              doorIds: e.doorIds.filter(id => id !== doorId),
            };
          }),
        };
      }),
    );
  }

  /** Alterna estado de uma porta */
  toggleDoor(doorId: string): void {
    this.regionsSignal.update(list =>
      list.map(r => ({
        ...r,
        doors: r.doors.map(d =>
          d.id === doorId ? { ...d, open: !d.open } : d,
        ),
      })),
    );
  }

  // ═══════════════════════════════════════════════════════
  // SNAPSHOT / SERIALIZATION
  // ═══════════════════════════════════════════════════════

  /** Obtém snapshot para serialização */
  getSnapshot(): FogData {
    return {
      campaignId: '',
      regions: this.regionsSignal(),
      opacity: this.opacitySignal(),
      enabled: this.enabledSignal(),
      gmVision: this.gmVisionSignal(),
    };
  }

  /** Carrega estado de um snapshot */
  loadFromSnapshot(data: FogData): void {
    this.regionsSignal.set(data.regions ?? []);
    this.opacitySignal.set(data.opacity ?? 0.75);
    this.enabledSignal.set(data.enabled ?? true);
    this.gmVisionSignal.set(data.gmVision ?? true);
  }

  /** Reseta para estado padrão */
  clear(): void {
    this.regionsSignal.set([]);
    this.opacitySignal.set(DEFAULT_FOG_DATA.opacity);
    this.enabledSignal.set(DEFAULT_FOG_DATA.enabled);
    this.gmVisionSignal.set(DEFAULT_FOG_DATA.gmVision);
  }

  // ═══════════════════════════════════════════════════════
  // COMPATIBILIDADE COM FogShape antigo
  // ═══════════════════════════════════════════════════════

  /**
   * @deprecated Use regions() diretamente.
   * Mantido para compatibilidade com código que ainda usa shapes.
   */
  shapes(): any[] {
    return this.regionsSignal().map(r => ({
      id: r.id,
      type: r.type,
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      points: r.points,
    }));
  }
}
