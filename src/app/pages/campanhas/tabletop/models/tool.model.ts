/**
 * Tipos de ferramentas disponíveis no Tabletop VTT.
 */
export enum ToolType {
  /** Ferramenta de seleção */
  Select = 'select',
  /** Ferramenta de movimentação */
  Move = 'move',
  /** Revelar fog of war */
  FogReveal = 'fog-reveal',
  /** Esconder fog of war */
  FogHide = 'fog-hide',
  /** Ferramenta de desenho */
  Draw = 'draw',
  /** Ferramenta de ping */
  Ping = 'ping',
  /** Ferramenta de medição */
  Measure = 'measure',
  /** Ferramenta de panorâmica (pan) */
  Pan = 'pan',
}

/**
 * Estado ativo de uma ferramenta.
 */
export interface ToolState {
  /** Tipo da ferramenta ativa */
  activeTool: ToolType;
  /** Cursor CSS customizado */
  cursor: string;
  /** Se a ferramenta está ativa no momento */
  isActive: boolean;
}

/** Mapa de cursores por ferramenta */
export const TOOL_CURSORS: Record<ToolType, string> = {
  [ToolType.Select]: 'default',
  [ToolType.Move]: 'move',
  [ToolType.FogReveal]: 'cell',
  [ToolType.FogHide]: 'cell',
  [ToolType.Draw]: 'crosshair',
  [ToolType.Ping]: 'pointer',
  [ToolType.Measure]: 'crosshair',
  [ToolType.Pan]: 'grab',
};

/** Shortcuts de teclado para cada ferramenta */
export const TOOL_SHORTCUTS: Record<string, ToolType> = {
  '1': ToolType.Select,
  '2': ToolType.Move,
  '3': ToolType.FogReveal,
  '4': ToolType.FogHide,
  '5': ToolType.Draw,
  '6': ToolType.Ping,
  '7': ToolType.Measure,
};
