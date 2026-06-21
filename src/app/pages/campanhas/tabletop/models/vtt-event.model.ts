import Konva from 'konva';

/**
 * Evento de mouse do VTT com coordenadas do mundo.
 */
export interface VttMouseEvent {
  /** Posição X no canvas/screen */
  screenX: number;
  /** Posição Y no canvas/screen */
  screenY: number;
  /** Posição X no mundo (após transformação de câmera) */
  worldX: number;
  /** Posição Y no mundo (após transformação de câmera) */
  worldY: number;
  /** Evento Konva original */
  originalEvent: Konva.KonvaEventObject<MouseEvent>;
  /** Botão do mouse pressionado */
  button: number;
}

/**
 * Evento de drag do VTT.
 */
export interface VttDragEvent {
  /** Posição de início do drag no mundo */
  startX: number;
  /** Posição de início do drag no mundo */
  startY: number;
  /** Posição atual do drag no mundo */
  currentX: number;
  /** Posição atual do drag no mundo */
  currentY: number;
  /** Delta X desde o último evento */
  deltaX: number;
  /** Delta Y desde o último evento */
  deltaY: number;
  /** Token sendo arrastado (se aplicável) */
  tokenId?: string;
}

/**
 * Evento de scroll/zoom.
 */
export interface VttWheelEvent {
  /** Delta do scroll */
  delta: number;
  /** Posição X do mouse na tela */
  screenX: number;
  /** Posição Y do mouse na tela */
  screenY: number;
  /** Nova escala após o zoom */
  newScale: number;
}

/**
 * Evento genérico do VTT (para uso futuro com Socket.IO).
 */
export interface VttEvent {
  /** Tipo do evento */
  type: string;
  /** Timestamp do evento */
  timestamp: number;
  /** ID do usuário que gerou o evento */
  userId?: string;
  /** Dados do evento */
  data: Record<string, unknown>;
}
