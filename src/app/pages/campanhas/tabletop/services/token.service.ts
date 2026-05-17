import { Injectable, signal, computed, inject, Injector } from '@angular/core';
import { Token, DEFAULT_TOKEN, TokenLight, TokenVision } from '../models';
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
  }

  /** Remove todos os tokens selecionados */
  removeSelected(): void {
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

  /** Atualiza HP (mantido para compatibilidade) */
  setHp(id: string, hp: number): void {
    const token = this.tokens().find((t) => t.id === id);
    if (token) {
      const hpBar = token.bars.find((b) => b.id === 'hp');
      if (hpBar) this.updateBarValue(id, 'hp', hp);
    }
  }

  /** Atualiza Mana (mantido para compatibilidade) */
  setMana(id: string, mana: number): void {
    const token = this.tokens().find((t) => t.id === id);
    if (token) {
      const manaBar = token.bars.find((b) => b.id === 'mana');
      if (manaBar) this.updateBarValue(id, 'mana', mana);
    }
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
  // TOKEN LIGHT — Sincronização com LightService
  // ═══════════════════════════════════════════════════════

  /**
   * Ativa/desativa a luz de um token.
   * Quando ativa, cria uma LightSource no LightService para que
   * o FogRenderer a processe no pipeline de destination-out.
   */
  setTokenLight(tokenId: string, lightConfig?: Partial<TokenLight>): void {
    const token = this.getTokenById(tokenId);
    if (!token) return;

    const newLight: TokenLight | undefined = lightConfig
      ? {
        enabled: true,
        radius: 200,
        color: '#ffdd88',
        intensity: 0.8,
        softness: 0.4,
        type: 'radial',
        flicker: false,
        ...lightConfig,
      }
      : undefined;

    this.updateToken(tokenId, { light: newLight });

    // Sincroniza com LightService
    if (newLight?.enabled) {
      const centerX = token.x + token.width / 2;
      const centerY = token.y + token.height / 2;
      this.lightService.createTokenLight(tokenId, newLight.radius, newLight.color);
      this.lightService.updateLight(
        `light-${tokenId}`,
        { x: centerX, y: centerY, intensity: newLight.intensity, enabled: true },
      );
    } else {
      this.lightService.removeTokenLight(tokenId);
    }

    this.visionService.markDirty();
  }

  /**
   * Atualiza a luz de um token (quando os parâmetros mudam).
   */
  updateTokenLight(tokenId: string, changes: Partial<TokenLight>): void {
    const token = this.getTokenById(tokenId);
    if (!token || !token.light) return;

    const updatedLight: TokenLight = { ...token.light, ...changes };
    this.updateToken(tokenId, { light: updatedLight });

    // Sincroniza com LightService
    this.lightService.updateLight(
      `light-${tokenId}`,
      {
        radius: updatedLight.radius,
        intensity: updatedLight.intensity,
        color: updatedLight.color,
        enabled: updatedLight.enabled,
        type: updatedLight.type,
        angle: updatedLight.angle,
        rotation: updatedLight.rotation,
      },
    );

    this.visionService.markDirty();
  }

  /**
   * Remove a luz de um token.
   */
  removeTokenLight(tokenId: string): void {
    this.updateToken(tokenId, { light: undefined });
    this.lightService.removeTokenLight(tokenId);
    this.visionService.markDirty();
  }

  // ═══════════════════════════════════════════════════════
  // TOKEN VISION — Gerenciamento de visão
  // ═══════════════════════════════════════════════════════

  /**
   * Atualiza a configuração de visão de um token.
   */
  setTokenVision(tokenId: string, visionConfig?: Partial<TokenVision>): void {
    const token = this.getTokenById(tokenId);
    if (!token) return;

    const newVision: TokenVision | undefined = visionConfig
      ? {
        enabled: true,
        radius: 300,
        darkvision: false,
        blindsight: false,
        tremorsense: false,
        cone: false,
        angle: Math.PI / 3,
        ...visionConfig,
      }
      : undefined;

    this.updateToken(tokenId, { vision: newVision });
    this.visionService.markDirty();
  }

  /**
   * Remove a visão configurada de um token (volta a usar fallback).
   */
  removeTokenVision(tokenId: string): void {
    this.updateToken(tokenId, { vision: undefined });
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

    // Sincroniza posição da luz no LightService
    if (token.light?.enabled) {
      this.lightService.updateTokenLightPosition(id, centerX, centerY);
    }

    // ── Salva exploração QUANDO o token se move ──
    // Usa o raio de visão do token, ou 300px como fallback.
    // Se exploration memory estiver desativada, markExplored
    // retorna silenciosamente sem fazer nada.
    const visionRadius = token.vision?.radius ?? 300;
    this.explorationService.markExplored(centerX, centerY, visionRadius);

    // Marca para recalcular visibilidade (luz + visão)
    // SEMPRE que o token se move, para garantir que:
    //   ✔ A luz antiga desapareça
    //   ✔ A luz nova apareça na nova posição
    //   ✔ visibleCells seja recalculado do zero
    this.visionService.markDirty();
  }

  /** Obtém o snapshot para serialização */
  getSnapshot(): Token[] {
    return this.tokens();
  }

  /** Carrega tokens de um snapshot */
  loadFromSnapshot(tokens: Token[]): void {
    this.tokens.set(tokens);
    // Re-sincroniza luzes
    for (const token of tokens) {
      if (token.light?.enabled) {
        const centerX = token.x + token.width / 2;
        const centerY = token.y + token.height / 2;
        this.lightService.createTokenLight(token.id, token.light.radius, token.light.color);
        this.lightService.updateLight(
          `light-${token.id}`,
          {
            x: centerX,
            y: centerY,
            radius: token.light.radius,
            intensity: token.light.intensity,
            color: token.light.color,
            enabled: token.light.enabled,
            type: token.light.type,
            angle: token.light.angle,
            rotation: token.light.rotation,
          },
        );
      }
    }
  }
}
