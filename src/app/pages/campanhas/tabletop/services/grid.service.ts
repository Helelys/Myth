import { Injectable, signal, computed } from '@angular/core';
import { GridConfig, DEFAULT_GRID_CONFIG } from '../models';

/**
 * Serviço de gerenciamento do grid.
 * Controla configurações de grid como tamanho da célula, cor e visibilidade.
 */
@Injectable({ providedIn: 'root' })
export class GridService {
  private state = signal<GridConfig>({ ...DEFAULT_GRID_CONFIG });

  readonly cellSize = computed(() => this.state().cellSize);
  readonly color = computed(() => this.state().color);
  readonly opacity = computed(() => this.state().opacity);
  readonly enabled = computed(() => this.state().enabled);
  readonly snapToGrid = computed(() => this.state().snapToGrid);

  update(partial: Partial<GridConfig>): void {
    this.state.update((s) => ({ ...s, ...partial }));
  }

  setCellSize(size: number): void {
    this.state.update((s) => ({ ...s, cellSize: Math.max(10, Math.min(200, size)) }));
  }

  setColor(color: string): void {
    this.state.update((s) => ({ ...s, color }));
  }

  setOpacity(opacity: number): void {
    this.state.update((s) => ({ ...s, opacity: Math.max(0, Math.min(1, opacity)) }));
  }

  toggle(): void {
    this.state.update((s) => ({ ...s, enabled: !s.enabled }));
  }

  toggleSnap(): void {
    this.state.update((s) => ({ ...s, snapToGrid: !s.snapToGrid }));
  }

  getSnapshot(): GridConfig {
    return this.state();
  }
}
