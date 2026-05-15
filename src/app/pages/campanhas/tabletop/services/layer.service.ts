import { Injectable, signal, computed } from '@angular/core';
import { LayerData, LayerType, DEFAULT_LAYERS } from '../models';

/**
 * Serviço de gerenciamento de camadas (layers).
 * Controla visibilidade, bloqueio e ordem das layers.
 */
@Injectable({ providedIn: 'root' })
export class LayerService {
  private layers = signal<LayerData[]>([...DEFAULT_LAYERS]);

  readonly layerList = this.layers.asReadonly();
  readonly visibleLayers = computed(() => this.layers().filter((l) => l.visible));
  readonly unlockedLayers = computed(() => this.layers().filter((l) => !l.locked));

  /** Obtém dados de uma layer específica */
  getLayer(type: LayerType): LayerData | undefined {
    return this.layers().find((l) => l.type === type);
  }

  /** Alterna visibilidade de uma layer */
  toggleVisibility(layerId: string): void {
    this.layers.update((list) =>
      list.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l)),
    );
  }

  /** Alterna bloqueio de uma layer */
  toggleLock(layerId: string): void {
    this.layers.update((list) =>
      list.map((l) => (l.id === layerId ? { ...l, locked: !l.locked } : l)),
    );
  }

  /** Move layer para cima na ordem */
  moveUp(layerId: string): void {
    this.layers.update((list) => {
      const idx = list.findIndex((l) => l.id === layerId);
      if (idx <= 0) return list;
      const newList = [...list];
      [newList[idx], newList[idx - 1]] = [newList[idx - 1], newList[idx]];
      return newList.map((l, i) => ({ ...l, order: i }));
    });
  }

  /** Move layer para baixo na ordem */
  moveDown(layerId: string): void {
    this.layers.update((list) => {
      const idx = list.findIndex((l) => l.id === layerId);
      if (idx >= list.length - 1) return list;
      const newList = [...list];
      [newList[idx], newList[idx + 1]] = [newList[idx + 1], newList[idx]];
      return newList.map((l, i) => ({ ...l, order: i }));
    });
  }

  /** Define opacidade de uma layer */
  setOpacity(layerId: string, opacity: number): void {
    this.layers.update((list) =>
      list.map((l) =>
        l.id === layerId ? { ...l, opacity: Math.max(0, Math.min(1, opacity)) } : l,
      ),
    );
  }

  /** Verifica se uma layer está visível */
  isVisible(type: LayerType): boolean {
    return this.layers().find((l) => l.type === type)?.visible ?? true;
  }

  /** Verifica se uma layer está bloqueada */
  isLocked(type: LayerType): boolean {
    return this.layers().find((l) => l.type === type)?.locked ?? false;
  }

  getSnapshot(): LayerData[] {
    return this.layers();
  }
}
