/**
 * ═══════════════════════════════════════════════════════════
 * FOG REGION — Sistema de visibilidade com máscara única
 * ═══════════════════════════════════════════════════════════
 *
 * ARQUITETURA PROFISSIONAL (Foundry/Owlbear)
 * ─────────────────────────────────────────
 *
 * Fog NÃO é "pintar preto sobre o mapa".
 * Fog é "revelar áreas visíveis em uma superfície escura única".
 *
 * Conceito:
 *   ✔ A tela JÁ NASCE completamente escura (Shadow Surface única)
 *   ✔ Cada FogRegion representa um RECORTE (área revelada)
 *   ✔ O renderizador usa destination-out para REMOVER escuridão
 *   ✔ NUNCA existem múltiplas sombras empilhadas
 *   ✔ NUNCA existe alpha stacking
 *
 * Estrutura:
 *   - geometria (tipo + coordenadas) — define ONDE REVELAR
 *   - bordas computadas (FogEdge[]) — para colisão vetorial
 *   - portas (FogDoor[]) — nas bordas, para passagem controlada
 *
 * FogRegion é uma "região de revelação" (RevealRegion),
 * NÃO uma "região de escuridão" (FogRect antigo).
 */

// ═══════════════════════════════════════════════════════════
// SUPPORTING TYPES
// ═══════════════════════════════════════════════════════════

/** Um segmento de reta 2D */
export interface LineSegment {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

/** Ponto 2D */
export interface Point2D {
    x: number;
    y: number;
}

// ═══════════════════════════════════════════════════════════
// FOG DOOR
// ═══════════════════════════════════════════════════════════

/**
 * Uma porta em uma borda de fog.
 *
 * Porta é um segmento dentro de uma FogEdge onde a colisão é
 * SUPRIMIDA se a porta estiver aberta.
 *
 * Cada porta tem:
 * - posição na borda (centro da porta)
 * - largura
 * - estado (aberta/fechada)
 */
export interface FogDoor {
    /** ID único */
    id: string;
    /** ID da região à qual pertence */
    regionId: string;
    /** ID da borda onde a porta está */
    edgeIndex: number;
    /** Posição central X da porta no mundo */
    x: number;
    /** Posição central Y da porta no mundo */
    y: number;
    /** Largura da porta (abertura) em unidades do mundo */
    width: number;
    /** Se a porta está aberta (permite passagem) */
    open: boolean;
    /** Ângulo da porta (normal à borda) — computado automaticamente */
    angle: number;
}

// ═══════════════════════════════════════════════════════════
// FOG EDGE (borda)
// ═══════════════════════════════════════════════════════════

/**
 * Uma borda de uma FogRegion.
 *
 * Borda é um segmento de reta definido por dois pontos (início e fim).
 * A borda é a "parede" da fog — tokens não podem cruzá-la sem uma porta aberta.
 */
export interface FogEdge {
    /** Índice da borda (0-3 para retângulo) */
    index: number;
    /** Ponto inicial */
    x1: number;
    y1: number;
    /** Ponto final */
    x2: number;
    y2: number;
    /** Comprimento da borda */
    length: number;
    /** Ângulo da borda em radianos */
    angle: number;
    /** IDs das portas nesta borda */
    doorIds: string[];
}

// ═══════════════════════════════════════════════════════════
// FOG REGION
// ═══════════════════════════════════════════════════════════

/**
 * Região de fog — unidade principal do sistema.
 *
 * FogRegion representa uma REGIÃO DE REVELAÇÃO (RevealRegion).
 * Ela descreve ONDE a escuridão deve ser REMOVIDA, não onde
 * a escuridão deve ser ADICIONADA.
 *
 * O renderizador usa destination-out para recortar estas
 * áreas da Shadow Surface única.
 *
 * Para retângulos: 4 bordas (top, right, bottom, left)
 * Para brush: bordas computadas a partir dos pontos do brush
 */
export interface FogRegion {
    /** ID único */
    id: string;
    /** Tipo de geometria */
    type: 'rectangle' | 'brush';
    /** Posição (canto superior esquerdo para retângulo) */
    x: number;
    y: number;
    /** Dimensões (retângulo) */
    width?: number;
    height?: number;
    /** Pontos do brush (array alternado x,y) */
    points?: number[];
    /** Bordas computadas (preenchidas automaticamente) */
    edges: FogEdge[];
    /** Portas nesta região */
    doors: FogDoor[];
}

// ═══════════════════════════════════════════════════════════
// FOG DATA (atualizado)
// ═══════════════════════════════════════════════════════════

/**
 * Dados completos do Fog of War.
 * Agora baseado em FogRegion[].
 */
export interface FogData {
    campaignId: string;
    /** Regiões de fog */
    regions: FogRegion[];
    /** Opacidade da fog (0-1) — aplicada à máscara ÚNICA */
    opacity: number;
    /** Se a fog está ativa */
    enabled: boolean;
    /** Se o GM pode ver através da fog */
    gmVision: boolean;
}

/** Valores padrão para Fog */
export const DEFAULT_FOG_DATA: Omit<FogData, 'campaignId'> = {
    regions: [],
    opacity: 0.75,
    enabled: true,
    gmVision: true,
};

// ═══════════════════════════════════════════════════════════
// COLLISION RESULT
// ═══════════════════════════════════════════════════════════

/** Resultado de uma verificação de colisão */
export interface CollisionResult {
    /** Se houve colisão (cruzou borda sem porta aberta) */
    blocked: boolean;
    /** Região onde a colisão ocorreu */
    regionId: string | null;
    /** Borda onde a colisão ocorreu */
    edgeIndex: number | null;
    /** Ponto de interseção */
    intersectionX: number | null;
    intersectionY: number | null;
    /** Se havia uma porta aberta no local (permitiu passagem) */
    passedThroughDoor: boolean;
}
