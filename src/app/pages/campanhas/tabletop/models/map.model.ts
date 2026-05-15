/**
 * Dados de um mapa carregado no Tabletop VTT.
 */
export interface MapData {
  /** Identificador único */
  id: string;
  /** Nome do mapa */
  name: string;
  /** URL/caminho da imagem do mapa */
  imageUrl: string;
  /** Largura original da imagem em pixels */
  width: number;
  /** Altura original da imagem em pixels */
  height: number;
  /** Escala aplicada ao mapa (eixo X) */
  scaleX: number;
  /** Escala aplicada ao mapa (eixo Y, normalmente igual a scaleX) */
  scaleY: number;
  /** Posição X no mundo */
  x: number;
  /** Posição Y no mundo */
  y: number;
  /** Se o mapa está bloqueado (não pode ser movido/redimensionado) */
  locked: boolean;
  /** Escala única (compatibilidade) */
  scale: number;
  /** Objeto de imagem em cache para evitar double-load */
  imageObj?: HTMLImageElement;
  /** Ordem Z (maior = mais na frente) */
  zIndex: number;
}

/** Estado inicial padrão para um mapa */
export const DEFAULT_MAP_STATE: Partial<MapData> = {
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  x: 0,
  y: 0,
  locked: false,
};
