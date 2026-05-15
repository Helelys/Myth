/**
 * Configurações do grid do Tabletop VTT.
 */
export interface GridConfig {
  /** Tamanho de cada célula em pixels do mundo */
  cellSize: number;
  /** Cor das linhas do grid */
  color: string;
  /** Opacidade das linhas do grid (0-1) */
  opacity: number;
  /** Se o grid está visível */
  enabled: boolean;
  /** Se o snap ao grid está ativo */
  snapToGrid: boolean;
}

/** Valores padrão para o grid */
export const DEFAULT_GRID_CONFIG: GridConfig = {
  cellSize: 50,
  color: '#4a4a6a',
  opacity: 0.5,
  enabled: true,
  snapToGrid: true,
};
