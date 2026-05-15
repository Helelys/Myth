/**
 * Modo da ferramenta de Fog of War.
 */
export enum FogMode {
  /** Revela área (remove fog) */
  Reveal = 'reveal',
  /** Esconde área (adiciona fog) */
  Hide = 'hide',
  /** Pincel para revelar */
  Brush = 'brush',
  /** Apagar revelação */
  Erase = 'erase',
}

/**
 * Dados do Fog of War.
 * A fog é armazenada como uma imagem canvas (dataURL) para performance.
 */
export interface FogData {
  /** Caminho/identificador da campanha */
  campaignId: string;
  /** Dados da imagem da fog em base64/dataURL */
  fogImage: string;
  /** Opacidade da fog (0-1) */
  opacity: number;
  /** Se a fog está ativa */
  enabled: boolean;
  /** Se o GM pode ver através da fog */
  gmVision: boolean;
  /** Raio do pincel para revelar/esconder */
  brushRadius: number;
}

/** Valores padrão para Fog */
export const DEFAULT_FOG_DATA: Omit<FogData, 'campaignId' | 'fogImage'> = {
  opacity: 0.7,
  enabled: true,
  gmVision: true,
  brushRadius: 60,
};
