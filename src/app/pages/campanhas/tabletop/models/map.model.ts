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
  /** Escala aplicada ao mapa */
  scale: number;
  /** Posição X no mundo */
  x: number;
  /** Posição Y no mundo */
  y: number;
  /** Se o mapa está bloqueado (não pode ser movido) */
  locked: boolean;
  /** Objeto de imagem em cache para evitar double-load */
  imageObj?: HTMLImageElement;
}
