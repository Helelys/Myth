// ═══════════════════════════════════════════════════════════
// TOKEN LIGHT — Iluminação emitida pelo token
// ═══════════════════════════════════════════════════════════

/**
 * Configuração de luz do token.
 * Define como o token ilumina o ambiente ao redor.
 *
 * A luz NÃO é apenas visual — ela RECORTA a Darkness Surface,
 * revelando áreas para todos os jogadores que possuem visão.
 *
 * Token pode ter luz MAS SEM visão (ex: tocha no chão).
 */
export interface TokenLight {
  /** Se a luz está ativa */
  enabled: boolean;
  /** Raio da luz em unidades do mundo (px) */
  radius: number;
  /** Cor da luz em hex */
  color: string;
  /** Intensidade (0-1) */
  intensity: number;
  /** Suavidade da borda (0 = dura, 1 = muito suave) */
  softness: number;
  /** Tipo de luz */
  type: 'radial' | 'cone';
  /** Ângulo do cone (radianos, para cone) */
  angle?: number;
  /** Rotação do cone (radianos) */
  rotation?: number;
  /** Se a luz deve tremer (tocha) */
  flicker?: boolean;
}

// ═══════════════════════════════════════════════════════════
// TOKEN VISION — Campo de visão do token
// ═══════════════════════════════════════════════════════════

/**
 * Configuração de visão do token.
 * Define como o token enxerga o ambiente.
 *
 * VISÃO ≠ LUZ
 * Token pode enxergar sem emitir luz (darkvision).
 * Token pode emitir luz sem enxergar (tocha estática).
 *
 * A visão SEMPRE respeita:
 * - Paredes (raycasting)
 * - Portas (abertas/fechadas)
 * - Line of sight
 */
export interface TokenVision {
  /** Se a visão está ativa */
  enabled: boolean;
  /** Raio de visão em unidades do mundo (px) */
  radius: number;
  /** Darkvision — enxerga no escuro sem precisar de luz */
  darkvision: boolean;
  /** Blindsight — enxerga sem precisar de linha de visão */
  blindsight: boolean;
  /** Tremorsense — detecta vibrações no solo */
  tremorsense: boolean;
  /** Se a visão é em cone (visão de criatura) */
  cone: boolean;
  /** Ângulo do cone de visão (radianos) */
  angle: number;
}

/**
 * Configurable bar on a token (HP, Mana, Sanity, etc.)
 */
export interface TokenBar {
  id: string;
  label: string;
  value: number;
  maxValue: number;
  color: string;
  visible: boolean;
}

/**
 * Configuração de Armadura/Defesa
 */
export interface TokenArmor {
  enabled: boolean;
  label: string;
  value: number;
}

/**
 * Representa um token de personagem/criatura no Tabletop VTT.
 * Cada token possui propriedades visuais, status e metadados.
 *
 * ═══════════════════════════════════════════════════════════
 * NOVO: O token agora é uma ENTIDADE DE VISÃO E ILUMINAÇÃO
 * ═══════════════════════════════════════════════════════════
 *
 * Cada token possui:
 *   1. Dados visuais (imagem, nome, aura)
 *   2. Dados de iluminação (TokenLight)
 *   3. Dados de visão (TokenVision)
 *   4. Dados de colisão (locked, layer)
 *   5. Estado de exploração (contribui para exploration grid)
 *
 * Fluxo correto:
 *   Token move → VisionService recalcula → Raycasting executa →
 *   Visibility polygon atualiza → Darkness mask é recortada → Mapa ilumina
 */
export interface Token {
  /** Identificador único do token */
  id: string;
  /** Nome exibido acima do token */
  name: string;
  /** URL da imagem do token (base64 ou path) */
  image: string;
  /** Posição X no mundo (pixels, antes do zoom/pan) */
  x: number;
  /** Posição Y no mundo (pixels, antes do zoom/pan) */
  y: number;
  /** Largura do token em pixels do mundo */
  width: number;
  /** Altura do token em pixels do mundo */
  height: number;
  /** Rotação em graus */
  rotation: number;
  /** Barras configuráveis (0-3) */
  bars: TokenBar[];
  /** Configuração de Armadura/CA */
  armor?: TokenArmor;
  /** ═══ NOVO: Configuração de luz emitida pelo token ═══ */
  light?: TokenLight;
  /** ═══ NOVO: Configuração de visão do token ════ */
  vision?: TokenVision;
  /** Lista de condições aplicadas (ex: 'envenenado', 'paralisado') */
  conditions: string[];
  /** Se o token está selecionado */
  selected: boolean;
  /** Ordem Z para renderização */
  zIndex: number;
  /** Cor da aura ao redor do token (hex) */
  auraColor: string;
  /** Raio da aura em pixels do mundo */
  auraRadius: number;
  /** Se o token está visível */
  visible: boolean;
  /** Layer à qual o token pertence */
  layer: string;
  /** Se o token está travado (não pode mover) */
  locked: boolean;
  /** Opacidade durante drag */
  dragOpacity: number;
}

/** Default bar colors */
export const BAR_COLORS = [
  { label: 'HP', color: '#4caf50' },
  { label: 'Mana', color: '#2196f3' },
  { label: 'Stamina', color: '#ff9800' },
  { label: 'Sanidade', color: '#9c27b0' },
  { label: 'Escudo', color: '#00bcd4' },
  { label: 'Fome', color: '#795548' },
  { label: 'Energia', color: '#ffeb3b' },
  { label: 'Fé', color: '#e0e0e0' },
];

/** Cria um bar padrão */
export function createDefaultBar(label: string, color: string, value = 10, maxValue = 10): TokenBar {
  return { id: crypto.randomUUID(), label, value, maxValue, color, visible: true };
}

/**
 * Cria valores padrão para um novo token.
 * width/height são definidos dinamicamente baseados no cellSize do grid.
 */
export function createDefaultToken(gridCellSize = 64): Omit<Token, 'id'> & { oldHp?: number; oldMana?: number } {
  return {
    name: 'Novo Token',
    image: '',
    x: 0,
    y: 0,
    width: gridCellSize,
    height: gridCellSize,
    rotation: 0,
    bars: [
      createDefaultBar('HP', '#4caf50', 10, 10),
      createDefaultBar('Mana', '#2196f3', 5, 5),
    ],
    armor: {
      enabled: false,
      label: 'CA',
      value: 10,
    },
    conditions: [],
    selected: false,
    zIndex: 1,
    auraColor: '#4fc3f7',
    auraRadius: 0,
    visible: true,
    layer: 'token',
    locked: false,
    dragOpacity: 1,
  };
}

/** Valores padrão antigos para compatibilidade */
export const DEFAULT_TOKEN = createDefaultToken(64);
