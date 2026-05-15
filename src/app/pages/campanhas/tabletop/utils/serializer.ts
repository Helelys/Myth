import { Token, MapData, GridConfig, FogData, LayerData } from '../models';

/**
 * Utilitário de serialização para preparar os dados
 * para transmissão futura via Socket.IO (multiplayer).
 *
 * Todas as entidades do VTT são serializáveis em JSON.
 */
export interface VttSnapshot {
  timestamp: number;
  campaignId: string;
  tokens: Token[];
  maps: MapData[];
  grid: GridConfig;
  fog: FogData;
  layers: LayerData[];
  version: string;
}

export class VttSerializer {
  static readonly CURRENT_VERSION = '1.0.0';

  /**
   * Serializa o estado completo do VTT em um snapshot.
   * Este snapshot pode ser transmitido via Socket.IO.
   */
  static createSnapshot(
    campaignId: string,
    tokens: Token[],
    maps: MapData[],
    grid: GridConfig,
    fog: FogData,
    layers: LayerData[],
  ): VttSnapshot {
    return {
      timestamp: Date.now(),
      campaignId,
      tokens: tokens.map((t) => ({ ...t })),
      maps: maps.map((m) => ({ ...m })),
      grid: { ...grid },
      fog: { ...fog },
      layers: layers.map((l) => ({ ...l })),
      version: this.CURRENT_VERSION,
    };
  }

  /**
   * Aplica um snapshot ao estado atual.
   */
  static applySnapshot(snapshot: VttSnapshot): {
    tokens: Token[];
    maps: MapData[];
    grid: GridConfig;
    fog: FogData;
    layers: LayerData[];
  } {
    return {
      tokens: snapshot.tokens,
      maps: snapshot.maps,
      grid: snapshot.grid,
      fog: snapshot.fog,
      layers: snapshot.layers,
    };
  }

  /**
   * Serializa um token individual para transmissão.
   */
  static serializeToken(token: Token): string {
    return JSON.stringify({
      id: token.id,
      name: token.name,
      image: token.image,
      x: token.x,
      y: token.y,
      width: token.width,
      height: token.height,
      rotation: token.rotation,
      bars: token.bars,
      armor: token.armor,
      conditions: token.conditions,
      auraColor: token.auraColor,
      auraRadius: token.auraRadius,
      visible: token.visible,
      layer: token.layer,
      locked: token.locked,
      zIndex: token.zIndex,
    });
  }

  /**
   * Calcula o diff entre dois snapshots para enviar
   * apenas alterações (otimização para multiplayer).
   */
  static diffSnapshots(
    before: VttSnapshot,
    after: VttSnapshot,
  ): Partial<VttSnapshot> {
    const diff: Partial<VttSnapshot> = {};

    if (before.tokens.length !== after.tokens.length) {
      diff.tokens = after.tokens;
    } else {
      const changedTokens: Token[] = [];
      for (let i = 0; i < after.tokens.length; i++) {
        if (JSON.stringify(before.tokens[i]) !== JSON.stringify(after.tokens[i])) {
          changedTokens.push(after.tokens[i]);
        }
      }
      if (changedTokens.length > 0) {
        diff.tokens = changedTokens;
      }
    }

    if (JSON.stringify(before.grid) !== JSON.stringify(after.grid)) {
      diff.grid = after.grid;
    }

    return diff;
  }
}
