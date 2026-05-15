/**
 * Representa a viewport visível (a área que o usuário vê na tela).
 * Usado para culling e renderização eficiente.
 */
export interface VttViewport {
  /** Coordenada X no mundo do canto superior esquerdo */
  worldX: number;
  /** Coordenada Y no mundo do canto superior esquerdo */
  worldY: number;
  /** Largura da viewport em coordenadas do mundo */
  worldWidth: number;
  /** Altura da viewport em coordenadas do mundo */
  worldHeight: number;
  /** Largura da tela em pixels */
  screenWidth: number;
  /** Altura da tela em pixels */
  screenHeight: number;
  /** Escala atual */
  scale: number;
}
