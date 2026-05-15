/**
 * Uma shape de fog (retângulo ou brush).
 * Armazenada como dado serializável — NUNCA guarda referência Konva.
 */
export interface FogShape {
  id: string;
  type: 'rectangle' | 'brush';
  /** Posição (rect: canto superior esquerdo) */
  x: number;
  y: number;
  /** Dimensões (rect) */
  width?: number;
  height?: number;
  /** Pontos do brush (array alternado x,y) */
  points?: number[];
}

/**
 * Dados do Fog of War.
 * Agora baseado em vetores/shapes, não em canvas image.
 */
export interface FogData {
  /** Caminho/identificador da campanha */
  campaignId: string;
  /** Shapes de fog */
  shapes: FogShape[];
  /** Opacidade da fog (0-1) */
  opacity: number;
  /** Se a fog está ativa */
  enabled: boolean;
  /** Se o GM pode ver através da fog */
  gmVision: boolean;
}

/** Valores padrão para Fog */
export const DEFAULT_FOG_DATA: Omit<FogData, 'campaignId'> = {
  shapes: [],
  opacity: 0.75,
  enabled: true,
  gmVision: true,
};
