/**
 * Ferramentas disponíveis no Tabletop VTT.
 * Simplificado para apenas o necessário:
 * - select: selecionar/mover tokens e mapas
 * - fog-rectangle: desenhar retângulo de neblina
 * - fog-brush: desenhar à mão livre na neblina
 */
export type ToolMode = 'select' | 'fog-rectangle' | 'fog-brush';

/**
 * Estado ativo de uma ferramenta.
 */
export interface ToolState {
  /** Tipo da ferramenta ativa */
  activeTool: ToolMode;
  /** Cursor CSS customizado */
  cursor: string;
  /** Se a ferramenta está ativa no momento */
  isActive: boolean;
}

/** Mapa de cursores por ferramenta */
export const TOOL_CURSORS: Record<ToolMode, string> = {
  'select': 'default',
  'fog-rectangle': 'crosshair',
  'fog-brush': 'crosshair',
};

/** Shortcuts de teclado para cada ferramenta */
export const TOOL_SHORTCUTS: Record<string, ToolMode> = {
  '1': 'select',
  '2': 'fog-rectangle',
  '3': 'fog-brush',
};

export const TOOL_LABELS: Record<ToolMode, string> = {
  'select': 'Selecionar',
  'fog-rectangle': 'Retângulo',
  'fog-brush': 'Caneta',
};

export const TOOL_ICONS: Record<ToolMode, string> = {
  'select': 'pointer',
  'fog-rectangle': 'rectangle',
  'fog-brush': 'brush',
};
