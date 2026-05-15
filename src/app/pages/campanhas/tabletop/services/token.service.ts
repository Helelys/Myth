import { Injectable, signal, computed } from '@angular/core';
import { Token, DEFAULT_TOKEN } from '../models';

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
 */
@Injectable({ providedIn: 'root' })
export class TokenService {
  private tokens = signal<Token[]>([]);
  private clipboard = signal<Token | null>(null);
  private editingTokenId = signal<string | null>(null);

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

  /** Move um token */
  moveToken(id: string, x: number, y: number): void {
    this.updateToken(id, { x, y });
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

  /** Obtém o snapshot para serialização */
  getSnapshot(): Token[] {
    return this.tokens();
  }

  /** Carrega tokens de um snapshot */
  loadFromSnapshot(tokens: Token[]): void {
    this.tokens.set(tokens);
  }
}
