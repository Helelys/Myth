/**
 * ═══════════════════════════════════════════════════════════
 * LIGHT SOURCE — Fonte de luz dinâmica
 * ═══════════════════════════════════════════════════════════
 *
 * Representa uma fonte de luz no mundo do tabletop.
 *
 * LUZ NÃO é "brilho sobre o mapa".
 * LUZ é "recorte na escuridão".
 *
 * O sistema:
 *   1. Desenha a Darkness Surface (preto total)
 *   2. Para cada luz, computa o polígono de visibilidade (com raycasting)
 *   3. Usa destination-out para recortar a área iluminada
 *   4. Aplica radial gradient para falloff suave
 *
 * Tipos de luz:
 *   - 'radial':    círculo (tocha, magia)
 *   - 'cone':      cone direcional (lanterna)
 *   - 'ambient':   luz ambiente (mapa) — ilumina sem raycasting
 *   - 'token':     luz associada a um token (emissor)
 */

/** Tipo de luz */
export type LightType = 'radial' | 'cone' | 'ambient' | 'token';

/** Fonte de luz */
export interface LightSource {
    /** ID único */
    id: string;

    /** Posição X no mundo */
    x: number;
    /** Posição Y no mundo */
    y: number;

    /** Raio máximo da luz em unidades do mundo */
    radius: number;

    /** Intensidade (0-1) */
    intensity: number;

    /** Cor da luz em hex */
    color: string;

    /** Tipo de luz */
    type: LightType;

    /** Ângulo do cone (radianos, para cone) */
    angle?: number;

    /** Rotação do cone (radianos) */
    rotation?: number;

    /** Se a luz está ativa */
    enabled: boolean;

    /** ID do token associado (se type === 'token') */
    tokenId?: string;

    /** Se deve calcular raycasting contra paredes */
    useRaycasting: boolean;

    /** Suavidade da borda (0 = dura, 1 = muito suave) */
    softness: number;
}

/** Dados persistentes de luzes */
export interface LightData {
    lights: LightSource[];
}

/** Valores padrão */
export const DEFAULT_LIGHT_SOURCE: Omit<LightSource, 'id'> = {
    x: 0,
    y: 0,
    radius: 300,
    intensity: 0.8,
    color: '#ffdd88',
    type: 'radial',
    enabled: true,
    useRaycasting: true,
    softness: 0.4,
};

export const DEFAULT_LIGHT_DATA: LightData = {
    lights: [],
};
