/**
 * Tipos de camadas (layers) disponíveis no sistema.
 * Cada layer é renderizada em um canvas Konva separado.
 */
export enum LayerType {
  Background = 'background',
  Grid = 'grid',
  Object = 'object',
  Token = 'token',
  Effect = 'effect',
  Fog = 'fog',
  UI = 'ui',
}

/**
 * Dados de configuração de uma layer.
 */
export interface LayerData {
  /** Identificador único da layer */
  id: string;
  /** Tipo da layer */
  type: LayerType;
  /** Nome amigável para exibição */
  name: string;
  /** Se está visível */
  visible: boolean;
  /** Se está bloqueada (não permite interação) */
  locked: boolean;
  /** Ordem de renderização (menor = mais ao fundo) */
  order: number;
  /** Opacidade da layer */
  opacity: number;
}

/** Configuração padrão de todas as layers do sistema */
export const DEFAULT_LAYERS: LayerData[] = [
  { id: 'bg', type: LayerType.Background, name: 'Background', visible: true, locked: false, order: 0, opacity: 1 },
  { id: 'grid', type: LayerType.Grid, name: 'Grid', visible: true, locked: true, order: 1, opacity: 1 },
  { id: 'obj', type: LayerType.Object, name: 'Objects', visible: true, locked: false, order: 2, opacity: 1 },
  { id: 'token', type: LayerType.Token, name: 'Tokens', visible: true, locked: false, order: 3, opacity: 1 },
  { id: 'effect', type: LayerType.Effect, name: 'Effects', visible: true, locked: false, order: 4, opacity: 1 },
  { id: 'fog', type: LayerType.Fog, name: 'Fog of War', visible: true, locked: false, order: 5, opacity: 1 },
  { id: 'ui', type: LayerType.UI, name: 'UI Overlay', visible: true, locked: true, order: 6, opacity: 1 },
];
