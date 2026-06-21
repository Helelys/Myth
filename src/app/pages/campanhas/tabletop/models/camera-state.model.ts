/**
 * Estado da câmera (viewport) do Tabletop VTT.
 * Controla zoom e pan sobre o canvas.
 */
export interface CameraState {
  /** Posição X da câmera no mundo */
  x: number;
  /** Posição Y da câmera no mundo */
  y: number;
  /** Escala do zoom (1 = 100%) */
  scale: number;
  /** Escala mínima permitida */
  minScale: number;
  /** Escala máxima permitida */
  maxScale: number;
  /** Se o pan está ativo no momento */
  isPanning: boolean;
  /** Suavização do movimento (0-1, mais alto = mais suave) */
  smoothing: number;
}

/** Valores padrão para a câmera */
export const DEFAULT_CAMERA_STATE: CameraState = {
  x: 0,
  y: 0,
  scale: 1,
  minScale: 0.1,
  maxScale: 5,
  isPanning: false,
  smoothing: 0.1,
};
