import { Injectable, signal, computed, inject, Injector } from '@angular/core';
import { Token, DEFAULT_TOKEN, TokenVision } from '../models';
import { LightService } from './light.service';
import { VisionService } from './vision.service';
import { ExplorationService } from './exploration.service';

/**
 * Serviço centralizado de gerenciamento de tokens.
 *
 * Gerencia:
 * - CRUD de tokens
 * - Seleção (única e múltipla)
 * - Ordem Z
 * - Drag and drop
 * - Copy/paste
 * - Duplicação
 *
 * Visão e Iluminação AGORA unificados:
 * Quando um token tem visão ativa, ele automaticamente
 * cria uma LightSource no LightService para iluminar
 * o ambiente. O tipo, cor, suavidade e ângulo são
 * lidos diretamente do TokenVision.
 *
 * ⚠ Evita injeção direta de VisionService para quebrar
 * dependência circular (VisionService → TokenService → VisionService).
 */
@Injectable({ providedIn: 'root' })
export class TokenService {
  private tokens = signal<Token[]>([]);
  private clipboard = signal<Token | null>(null);
  private editingTokenId = signal<string | null>(null);

  // ═══ Serviços ═══
  private lightService = inject(LightService);
  private explorationService = inject(ExplorationService);
  private injector = inject(Injector);

  /** Lazy VisionService para quebrar circular dependency */
  private _visionService: VisionService | null = null;
  private get visionService(): VisionService {
    if (!this._visionService) {
      this._visionService = this.injector.get(VisionService);
    }
    return this._visionService;
  }

  readonly tokenList = this.tokens.asReadonly();
  readonly selectedTokens = computed(() => this.tokens().filter((t) => t.selected));
  readonly selectedCount = computed(() => this.selectedTokens().length);
  readonly hasSelection = computed(() => this.selectedCount() > 0);
  readonly editingToken = computed(() => this.tokens().find(t => t.id === this.editingTokenId()) || null);

  /** Abre o editor para um token específico (botão direito) */
  openEditor(id: string): void {
    this.editingTokenId.set(id);
  }

  /** Fecha o editor de token */
  closeEditor(): void {
    this.editingTokenId.set(null);
  }

  /** Cria um novo token com valores padrão */
  createToken(partial?: Partial<Token>): Token {
    const token: Token = {
      ...DEFAULT_TOKEN,
      id: crypto.randomUUID(),
      ...partial,
    };

    this.tokens.update((list) => [...list, token]);
    return token;
  }

  /** Adiciona um token (importado) */
  addToken(token: Token): void {
    this.tokens.update((list) => [...list, token]);
  }

  /** Remove um token pelo ID */
  removeToken(id: string): void {
    this.tokens.update((list) => list.filter((t) => t.id !== id));
    this.lightService.removeTokenLight(id);
  }

  /** Remove todos os tokens selecionados */
  removeSelected(): void {
    const selected = this.tokens().filter(t => t.selected);
    for (const t of selected) {
      this.lightService.removeTokenLight(t.id);
    }
    this.tokens.update((list) => list.filter((t) => !t.selected));
  }

  /** Atualiza um token específico */
  updateToken(id: string, partial: Partial<Token>): void {
    this.tokens.update((list) =>
      list.map((t) => (t.id === id ? { ...t, ...partial } : t)),
    );
  }

  /** Aplica snap ao grid em um token */

  snapTokenToGrid(id: string, cellSize: number): void {
    this.tokens.update((list) =>
      list.map((t) => {
        if (t.id !== id) return t;
        return {
          ...t,
          x: Math.round(t.x / cellSize) * cellSize,
          y: Math.round(t.y / cellSize) * cellSize,
        };
      }),
    );
  }

  /** Seleciona um token (ou adiciona à seleção com Shift) */
  selectToken(id: string, addToSelection = false): void {
    if (addToSelection) {
      this.tokens.update((list) =>
        list.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t)),
      );
    } else {
      this.tokens.update((list) =>
        list.map((t) => ({ ...t, selected: t.id === id })),
      );
    }
  }

  /** Limpa toda a seleção */
  deselectAll(): void {
    this.tokens.update((list) => list.map((t) => ({ ...t, selected: false })));
  }

  /** Duplica tokens selecionados */
  duplicateSelected(): void {
    this.tokens.update((list) => {
      const newTokens: Token[] = [];
      for (const t of list) {
        if (t.selected) {
          newTokens.push({
            ...t,
            id: crypto.randomUUID(),
            name: `${t.name} (cópia)`,
            x: t.x + 20,
            y: t.y + 20,
            selected: false,
          });
        }
      }
      return [...list, ...newTokens];
    });
  }

  /** Copia tokens selecionados para o clipboard */
  copySelected(): void {
    const selected = this.tokens().find((t) => t.selected);
    if (selected) {
      this.clipboard.set({ ...selected });
    }
  }

  /** Cola tokens do clipboard */
  pasteFromClipboard(): void {
    const clip = this.clipboard();
    if (!clip) return;

    const newToken: Token = {
      ...clip,
      id: crypto.randomUUID(),
      name: `${clip.name} (colado)`,
      x: clip.x + 30,
      y: clip.y + 30,
      selected: false,
    };

    this.tokens.update((list) => [...list, newToken]);
  }

  /** Altera a ordem Z de um token */
  setZIndex(id: string, zIndex: number): void {
    this.updateToken(id, { zIndex });
  }

  /** Traz token para frente */
  bringToFront(id: string): void {
    const maxZ = Math.max(...this.tokens().map((t) => t.zIndex), 0);
    this.updateToken(id, { zIndex: maxZ + 1 });
  }

  /** Envia token para trás */
  sendToBack(id: string): void {
    const minZ = Math.min(...this.tokens().map((t) => t.zIndex), 0);
    this.updateToken(id, { zIndex: minZ - 1 });
  }

  /** Atualiza o valor de uma barra específica pelo ID */
  updateBarValue(tokenId: string, barId: string, value: number): void {
    this.tokens.update((list) =>
      list.map((t) => {
        if (t.id !== tokenId) return t;
        return {
          ...t,
          bars: t.bars.map((b) =>
            b.id === barId ? { ...b, value: Math.max(0, Math.min(b.maxValue, value)) } : b,
          ),
        };
      }),
    );
  }

  /** Atualiza o valor máximo de uma barra específica pelo ID */
  updateBarMaxValue(tokenId: string, barId: string, maxValue: number): void {
    this.tokens.update((list) =>
      list.map((t) => {
        if (t.id !== tokenId) return t;
        return {
          ...t,
          bars: t.bars.map((b) =>
            b.id === barId ? { ...b, maxValue: Math.max(1, maxValue) } : b,
          ),
        };
      }),
    );
  }

  /** Altera a visibilidade de uma barra */
  toggleBarVisibility(tokenId: string, barId: string): void {
    this.tokens.update((list) =>
      list.map((t) => {
        if (t.id !== tokenId) return t;
        return {
          ...t,
          bars: t.bars.map((b) =>
            b.id === barId ? { ...b, visible: !b.visible } : b,
          ),
        };
      }),
    );
  }

  /** Retorna os tokens ordenados por Z index */
  getSortedTokens(): Token[] {
    return [...this.tokens()].sort((a, b) => a.zIndex - b.zIndex);
  }

  /** Obtém um token por ID */
  getTokenById(id: string): Token | undefined {
    return this.tokens().find((t) => t.id === id);
  }

  // ═══════════════════════════════════════════════════════
  // TOKEN VISION — Gerenciamento unificado de visão + luz
  // ═══════════════════════════════════════════════════════

  /**
   * Sincroniza a LightSource de um token com base na sua visão.
   * Chamado sempre que a visão é ativada ou alterada.
   */
  private syncVisionToLight(token: Token): void {
    const vision = token.vision;
    if (!vision?.enabled) {
      this.lightService.removeTokenLight(token.id);
      return;
    }

    const centerX = token.x + token.width / 2;
    const centerY = token.y + token.height / 2;

    const existingLight = this.lightService.getLightById(`light-${token.id}`);
    if (existingLight) {
      // Atualiza luz existente
      this.lightService.updateLight(`light-${token.id}`, {
        x: centerX,
        y: centerY,
        radius: vision.radius,
        intensity: vision.intensity,
        color: vision.color,
        softness: vision.softness,
        type: vision.type === 'cone' ? 'cone' : 'token',
        angle: vision.type === 'cone' ? vision.angle : undefined,
        rotation: vision.rotation,
        enabled: vision.enabled,
        useRaycasting: true,
      });
    } else {
      // Cria nova luz
      this.lightService.createTokenLight(token.id, vision.radius, vision.color);
      this.lightService.updateLight(`light-${token.id}`, {
        x: centerX,
        y: centerY,
        intensity: vision.intensity,
        softness: vision.softness,
        type: vision.type === 'cone' ? 'cone' : 'token',
        angle: vision.type === 'cone' ? vision.angle : undefined,
        rotation: vision.rotation,
        useRaycasting: true,
      });
    }
  }

  /**
   * Atualiza a configuração de visão de um token.
   * Automaticamente sincroniza a luz no LightService.
   */
  setTokenVision(tokenId: string, visionConfig?: Partial<TokenVision>): void {
    const token = this.getTokenById(tokenId);
    if (!token) return;

    const newVision: TokenVision | undefined = visionConfig
      ? {
        enabled: true,
        radius: 300,
        // ═══ Iluminação ═══
        type: 'radial',
        softness: 0.5,
        intensity: 0.8,
        color: '#ffdd88',
        rotation: 0,
        // ═══ Visão ═══
        darkvision: false,
        blindsight: false,
        tremorsense: false,
        cone: false,
        angle: Math.PI / 3,
        ...visionConfig,
      }
      : undefined;

    this.updateToken(tokenId, { vision: newVision });

    // Sincroniza LightService
    if (newVision?.enabled) {
      this.syncVisionToLight({ ...token, vision: newVision });
    } else {
      this.lightService.removeTokenLight(tokenId);
    }

    this.visionService.markDirty();
  }

  /**
   * Remove a visão configurada de um token (volta a usar fallback).
   * Também remove a luz associada.
   */
  removeTokenVision(tokenId: string): void {
    this.updateToken(tokenId, { vision: undefined });
    this.lightService.removeTokenLight(tokenId);
    this.visionService.markDirty();
  }

  // ═══════════════════════════════════════════════════════
  // OVERRIDE: moveToken com sincronização de luz
  // ═══════════════════════════════════════════════════════

  /**
   * Move um token e sincroniza a posição da luz associada.
   *
   * ═══════════════════════════════════════════════════════════
   * EXPLORATION MEMORY — Salva APENAS quando o token se move
   * ═══════════════════════════════════════════════════════════
   *
   * A exploração (explored) é salva SOMENTE aqui, quando o
   * token realmente se move fisicamente. Isso garante que:
   *
   *   ✔ Áreas visitadas ficam marcadas como exploradas
   *   ✔ Áreas não visitadas permanecem escuras
   *   ✔ NÃO há acumulação permanente a cada frame
   *   ✔ A escuridão RETORNA quando o token se afasta
   *     (visible é recalculado do zero a cada render)
   */
  moveToken(id: string, x: number, y: number): void {
    const token = this.getTokenById(id);
    if (!token) return;

    this.updateToken(id, { x, y });

    const centerX = x + (token.width ?? 64) / 2;
    const centerY = y + (token.height ?? 64) / 2;

    // Sincroniza posição da luz no LightService (se visão ativa)
    if (token.vision?.enabled) {
      this.lightService.updateTokenLightPosition(id, centerX, centerY);
    }

    // ── Salva exploração QUANDO o token se move ──
    // Usa o raio de visão do token, ou 300px como fallback.
    // Se exploration memory estiver desativada, markExplored
    // retorna silenciosamente sem fazer nada.
    const visionRadius = token.vision?.radius ?? 300;
    this.explorationService.markExplored(centerX, centerY, visionRadius);

    // Marca para recalcular visibilidade (luz + visão)
    this.visionService.markDirty();
  }

  /** Obtém o snapshot para serialização */
  getSnapshot(): Token[] {
    return this.tokens();
  }

  /** Carrega tokens de um snapshot */
  loadFromSnapshot(tokens: Token[]): void {
    this.tokens.set(tokens);
    // Re-sincroniza luzes a partir da visão
    for (const token of tokens) {
      if (token.vision?.enabled) {
        const centerX = token.x + token.width / 2;
        const centerY = token.y + token.height / 2;
        this.lightService.createTokenLight(token.id, token.vision.radius, token.vision.color);
        this.lightService.updateLight(
          `light-${token.id}`,
          {
            x: centerX,
            y: centerY,
            radius: token.vision.radius,
            intensity: token.vision.intensity ?? 0.8,
            color: token.vision.color,
            softness: token.vision.softness ?? 0.5,
            enabled: token.vision.enabled,
            type: token.vision.type === 'cone' ? 'cone' : 'token',
            angle: token.vision.type === 'cone' ? token.vision.angle : undefined,
            rotation: token.vision.rotation,
          },
        );
      }
    }
  }
}
