import { Injectable, signal, computed } from '@angular/core';
import { FogData, FogMode, DEFAULT_FOG_DATA } from '../models';

/**
 * Serviço de gerenciamento do Fog of War.
 *
 * A fog é implementada como um canvas separado sobreposto ao jogo.
 * Utiliza composite operations (destination-out) para revelar áreas.
 *
 * Estrutura:
 * - Uma camada de fog preta cobre todo o canvas
 * - Áreas reveladas usam destination-out para tornar transparente
 * - O GM pode ver tudo (gmVision)
 * - Uma segunda camada de "descoberta" registra áreas já exploradas
 */
@Injectable({ providedIn: 'root' })
export class FogService {
  private state = signal<FogData>({
    campaignId: '',
    fogImage: '',
    ...DEFAULT_FOG_DATA,
  });

  private mode = signal<FogMode>(FogMode.Reveal);

  readonly enabled = computed(() => this.state().enabled);
  readonly opacity = computed(() => this.state().opacity);
  readonly gmVision = computed(() => this.state().gmVision);
  readonly brushRadius = computed(() => this.state().brushRadius);
  readonly fogImage = computed(() => this.state().fogImage);
  readonly currentMode = this.mode.asReadonly();

  setCampaignId(id: string): void {
    this.state.update((s) => ({ ...s, campaignId: id }));
  }

  setMode(mode: FogMode): void {
    this.mode.set(mode);
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

  setBrushRadius(radius: number): void {
    this.state.update((s) => ({
      ...s,
      brushRadius: Math.max(10, Math.min(200, radius)),
    }));
  }

  /** Atualiza a imagem da fog (após operações de pincel) */
  setFogImage(dataUrl: string): void {
    this.state.update((s) => ({ ...s, fogImage: dataUrl }));
  }

  /** Limpa toda a fog (revela tudo) */
  clearAll(): void {
    this.state.update((s) => ({ ...s, fogImage: '' }));
  }

  /** Restaura a fog completa (esconde tudo) */
  resetAll(canvasWidth: number, canvasHeight: number): void {
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      this.state.update((s) => ({ ...s, fogImage: canvas.toDataURL() }));
    }
  }

  getSnapshot(): FogData {
    return this.state();
  }

  loadFromSnapshot(fog: FogData): void {
    this.state.set(fog);
  }

  /** Salva a fog no localStorage (persistência) */
  saveToStorage(campaignId: string): void {
    const data = this.state();
    localStorage.setItem(`mythmaker_fog_${campaignId}`, JSON.stringify(data));
  }

  /** Carrega a fog do localStorage */
  loadFromStorage(campaignId: string): void {
    const saved = localStorage.getItem(`mythmaker_fog_${campaignId}`);
    if (saved) {
      try {
        const data = JSON.parse(saved) as FogData;
        this.state.set(data);
      } catch {
        // Ignora dados corrompidos
      }
    }
  }
}
