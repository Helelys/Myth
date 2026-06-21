/**
 * ═══════════════════════════════════════════════════════════
 * EXPLORATION MEMORY — Memória de exploração do mapa
 * ═══════════════════════════════════════════════════════════
 *
 * Um sistema moderno de VTT possui 3 estados de visibilidade:
 *
 *   1. INVISÍVEL  — nunca foi visto, completamente escuro
 *   2. EXPLORADO  — já foi visto, mas não está no campo de visão agora
 *   3. VISÍVEL    — está no campo de visão agora (iluminado/revelado)
 *
 * Renderização:
 *   - INVISÍVEL: preto total (opacidade = darknessOpacity)
 *   - EXPLORADO: cinza escuro (opacidade = exploredOpacity, ~0.5)
 *   - VISÍVEL:   transparente (0% escuridão)
 *
 * A memória de exploração é armazenada como:
 *   - Grid-based: divisão do mapa em células de cellSize
 *   - Cada célula tem um estado (invisible, explored, visible)
 *   - Persistente entre sessões
 *
 * Performance:
 *   - Grid espacial (células de ~50px)
 *   - Apenas marca células como explored quando visitadas
 *   - Visible é recalculado a cada frame (apenas luzes ativas)
 *   - Invisible/Explored são persistentes
 */

/** Estados de visibilidade de uma célula */
export type CellVisibility = 'invisible' | 'explored' | 'visible';

/** Configuração do grid de exploração */
export interface ExplorationConfig {
    /** Tamanho da célula em pixels do mundo */
    cellSize: number;
    /** Opacidade da escuridão para células invisíveis */
    darknessOpacity: number;
    /** Opacidade da escuridão para células exploradas */
    exploredOpacity: number;
}

/** Dados de exploração persistente */
export interface ExplorationData {
    /** Grid de células: chave = "cellX,cellY", valor = true (explored) */
    explored: Record<string, boolean>;
    /** Configuração usada */
    config: ExplorationConfig;
}

/** Valores padrão */
export const DEFAULT_EXPLORATION_CONFIG: ExplorationConfig = {
    cellSize: 50,
    darknessOpacity: 1.0,
    exploredOpacity: 0.5,
};

export const DEFAULT_EXPLORATION_DATA: ExplorationData = {
    explored: {},
    config: { ...DEFAULT_EXPLORATION_CONFIG },
};
