/**
 * ═══════════════════════════════════════════════════════════
 * WALL — Geometria de obstrução para visibilidade e colisão
 * ═══════════════════════════════════════════════════════════
 *
 * A parede (Wall) é a unidade fundamental do sistema de
 * visibilidade e colisão do tabletop.
 *
 * FUNÇÕES:
 *   ✔ Bloquear MOVIMENTO de tokens (collision)
 *   ✔ Bloquear LUZ (light occlusion)
 *   ✔ Bloquear VISÃO (line of sight)
 *   ✔ Servir de suporte para PORTAS
 *
 * Arquitetura:
 *   - Walls são INDEPENDENTES de FogRegion
 *   - Walls NÃO são renderizadas no canvas principal (apenas debug/edição)
 *   - Walls formam a base para raycasting
 *   - Portas são um atributo de Wall, não de FogRegion
 *
 * Tipo de parede:
 *   - 'wall':    parede normal (bloqueia movimento, luz e visão)
 *   - 'window':  janela (bloqueia movimento, permite luz/visão)
 *   - 'door':    porta (bloqueia condicionalmente baseado no estado)
 *   - 'invisible': parede invisível (bloqueia movimento mas não é visível)
 */

/** Direções que uma parede pode bloquear */
export interface WallFlags {
    /** Bloqueia passagem de tokens */
    blocksMovement: boolean;
    /** Bloqueia passagem de luz */
    blocksLight: boolean;
    /** Bloqueia linha de visão */
    blocksVision: boolean;
}

/** Uma porta integrada a uma parede */
export interface WallDoor {
    /** ID único */
    id: string;
    /** Nome da porta (ex: "Porta da masmorra") */
    name: string;
    /** Se está aberta */
    open: boolean;
    /** Posição ao longo da parede (0-1) */
    position: number;
    /** Largura da abertura */
    width: number;
}

/** Uma parede no mundo do tabletop */
export interface Wall {
    /** ID único */
    id: string;
    /** Ponto inicial */
    x1: number;
    y1: number;
    /** Ponto final */
    x2: number;
    y2: number;
    /** Flags de bloqueio */
    flags: WallFlags;
    /** Porta (opcional) */
    door?: WallDoor;
    /** Se está visível no modo edição */
    visible: boolean;
    /** Cor personalizada (opcional, para debug) */
    color?: string;
}

/** Dados persistentes de paredes */
export interface WallData {
    walls: Wall[];
}

/** Valores padrão */
export const DEFAULT_WALL_FLAGS: WallFlags = {
    blocksMovement: true,
    blocksLight: true,
    blocksVision: true,
};

export const DEFAULT_WALL_DATA: WallData = {
    walls: [],
};
