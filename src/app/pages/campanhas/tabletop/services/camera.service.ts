import { Injectable, signal, computed } from '@angular/core';
import { CameraState, DEFAULT_CAMERA_STATE } from '../models';

/**
 * Serviço centralizado de gerenciamento da câmera.
 *
 * A câmera controla:
 * - Zoom (escala): mouse wheel, zoom in/out
 * - Pan: arrasto com botão do meio ou Space + clique
 * - Suavização de movimento
 *
 * Transformações:
 *   screenToWorld: (screenPos - center) / scale + cameraPos
 *   worldToScreen: (worldPos - cameraPos) * scale + center
 */
@Injectable({ providedIn: 'root' })
export class CameraService {
  /** Estado reativo da câmera */
  private state = signal<CameraState>({ ...DEFAULT_CAMERA_STATE });

  /** Observables derivados */
  readonly x = computed(() => this.state().x);
  readonly y = computed(() => this.state().y);
  readonly scale = computed(() => this.state().scale);
  readonly minScale = computed(() => this.state().minScale);
  readonly maxScale = computed(() => this.state().maxScale);
  readonly isPanning = computed(() => this.state().isPanning);

  /** Dimensões do container (atualizadas pelo componente) */
  private containerWidth = 800;
  private containerHeight = 600;

  /** Suavização de movimento */
  private targetX = 0;
  private targetY = 0;
  private targetScale = 1;

  /** Última posição do mouse para pan */
  private lastPanX = 0;
  private lastPanY = 0;

  setContainerSize(width: number, height: number): void {
    this.containerWidth = width;
    this.containerHeight = height;
  }

  getContainerSize(): { width: number; height: number } {
    return { width: this.containerWidth, height: this.containerHeight };
  }

  /** Atualiza o estado da câmera (chamado pelo canvas após aplicar o zoom/pan no Stage) */
  updateState(x: number, y: number, scale: number): void {
    this.state.update((s) => ({ ...s, x, y, scale }));
  }

  /** Inicia o pan (apenas para UI react) */
  startPan(): void {
    this.state.update((s) => ({ ...s, isPanning: true }));
  }

  /** Finaliza o pan */
  endPan(): void {
    this.state.update((s) => ({ ...s, isPanning: false }));
  }

  /** Carrega um snapshot de câmera */
  loadFromSnapshot(snapshot: Partial<CameraState>): void {
    this.state.update((s) => ({ ...s, ...snapshot }));
  }

  /** Reseta a câmera para o estado inicial */
  reset(): void {
    this.state.set({ ...DEFAULT_CAMERA_STATE });
  }

  /** Obtém o estado atual (não reativo, para leitura direta) */
  getSnapshot(): CameraState {
    return this.state();
  }
}
