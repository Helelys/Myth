import { Injectable, signal, computed, Signal } from '@angular/core';
import { MapData } from '../models';

/**
 * Serviço de gerenciamento de mapas.
 *
 * Suporta MÚLTIPLOS MAPAS simultaneamente.
 * Cada mapa possui:
 * - id único
 * - estado próprio (locked, scale, position)
 * - transformer próprio
 * - zIndex próprio
 *
 * Estado é um array maps: MapData[].
 * NÃO existe "currentMap" único.
 */
@Injectable({ providedIn: 'root' })
export class MapService {
  private maps = signal<MapData[]>([]);
  private selectedMapId = signal<string | null>(null);
  private isLoading = signal(false);

  readonly mapList = this.maps.asReadonly();
  readonly loading = this.isLoading.asReadonly();
  readonly selectedId = this.selectedMapId.asReadonly();

  /** Retorna o mapa selecionado ou null */
  readonly selectedMap = computed(() => {
    const id = this.selectedMapId();
    if (!id) return null;
    return this.maps().find((m) => m.id === id) ?? null;
  });

  /** Retorna os mapas ordenados por zIndex */
  readonly sortedMaps = computed(() =>
    [...this.maps()].sort((a, b) => a.zIndex - b.zIndex),
  );

  /**
   * Cria um signal computado para buscar mapa por ID.
   * Usado pelo MapContextMenuComponent para reatividade.
   */
  getMapByIdSignal(idSignal: Signal<string | null>): Signal<MapData | undefined> {
    return computed(() => {
      const id = idSignal();
      if (!id) return undefined;
      return this.maps().find((m) => m.id === id);
    });
  }

  /**
   * Carrega um mapa a partir de um arquivo de imagem.
   * Adiciona à lista — NUNCA substitui.
   */
  loadMapFromFile(file: File): Promise<MapData> {
    return new Promise((resolve, reject) => {
      this.isLoading.set(true);

      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const img = new Image();
        img.onload = () => {
          const maxZ = Math.max(...this.maps().map((m) => m.zIndex), 0);
          const mapData: MapData = {
            id: crypto.randomUUID(),
            name: file.name.replace(/\.[^/.]+$/, ''),
            imageUrl: e.target?.result as string,
            width: img.width,
            height: img.height,
            scale: 1,
            scaleX: 1,
            scaleY: 1,
            x: 0,
            y: 0,
            locked: false,
            imageObj: img,
            zIndex: maxZ + 1,
          };

          this.maps.update((list) => [...list, mapData]);
          this.isLoading.set(false);
          resolve(mapData);
        };
        img.onerror = () => {
          this.isLoading.set(false);
          reject(new Error('Falha ao carregar imagem do mapa'));
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        this.isLoading.set(false);
        reject(new Error('Falha ao ler arquivo'));
      };
      reader.readAsDataURL(file);
    });
  }

  /** Remove um mapa da lista */
  removeMap(id: string): void {
    this.maps.update((list) => list.filter((m) => m.id !== id));
    if (this.selectedMapId() === id) {
      this.selectedMapId.set(null);
    }
  }

  /** Atualiza propriedades de um mapa específico */
  updateMap(id: string, partial: Partial<MapData>): void {
    this.maps.update((list) =>
      list.map((m) => {
        if (m.id !== id) return m;
        const updated = { ...m, ...partial };
        // Mantém compatibilidade entre scale / scaleX / scaleY
        if (partial.scaleX !== undefined && partial.scaleY === undefined) {
          updated.scaleY = partial.scaleX;
          updated.scale = partial.scaleX;
        }
        if (partial.scaleY !== undefined && partial.scaleX === undefined) {
          updated.scaleX = partial.scaleY;
          updated.scale = partial.scaleY;
        }
        if (partial.scale !== undefined) {
          if (updated.scaleX === undefined || partial.scaleX === undefined) {
            updated.scaleX = partial.scale;
            updated.scaleY = partial.scale;
          }
        }
        return updated;
      }),
    );
  }

  /** Seleciona um mapa para edição */
  selectMap(id: string): void {
    this.selectedMapId.set(id);
  }

  /** Desmarca mapa selecionado */
  deselectMap(): void {
    this.selectedMapId.set(null);
  }

  /** Alterna o locked de um mapa */
  toggleLock(id: string): void {
    const map = this.maps().find((m) => m.id === id);
    if (map) {
      this.updateMap(id, { locked: !map.locked });
    }
  }

  /** Traz mapa para frente */
  bringToFront(id: string): void {
    const maxZ = Math.max(...this.maps().map((m) => m.zIndex), 0);
    this.updateMap(id, { zIndex: maxZ + 1 });
  }

  /** Envia mapa para trás */
  sendToBack(id: string): void {
    const minZ = Math.min(...this.maps().map((m) => m.zIndex), 0);
    this.updateMap(id, { zIndex: minZ - 1 });
  }

  /** Centraliza o mapa no centro da tela sem alterar a escala */
  centerMap(id: string, containerWidth: number, containerHeight: number): void {
    const map = this.maps().find((m) => m.id === id);
    if (!map) return;
    this.updateMap(id, {
      x: (containerWidth / 2) - (map.width * map.scaleX) / 2,
      y: (containerHeight / 2) - (map.height * map.scaleY) / 2,
    });
  }

  /** Ajusta a escala do mapa para caber na tela */
  fitToScreen(id: string, containerWidth: number, containerHeight: number): void {
    const map = this.maps().find((m) => m.id === id);
    if (!map) return;
    const scaleX = containerWidth / map.width;
    const scaleY = containerHeight / map.height;
    const fitScale = Math.min(scaleX, scaleY) * 0.95;
    this.updateMap(id, {
      scale: fitScale,
      scaleX: fitScale,
      scaleY: fitScale,
      x: (containerWidth / 2) - (map.width * fitScale) / 2,
      y: (containerHeight / 2) - (map.height * fitScale) / 2,
    });
  }

  /** Retorna a escala para 1:1 original */
  resetScale(id: string): void {
    this.updateMap(id, { scale: 1, scaleX: 1, scaleY: 1 });
  }

  /** Obtém um mapa por ID */
  getMapById(id: string): MapData | undefined {
    return this.maps().find((m) => m.id === id);
  }

  /** Obtém o snapshot para serialização (STRIPPA imageObj — não serializável!) */
  getSnapshot(): MapData[] {
    const snap = this.maps().map((m) => {
      const { imageObj, ...rest } = m;
      return rest as MapData;
    });
    console.log('[MAPSERVICE] getSnapshot() — maps count:', snap.length);
    snap.forEach((m, i) => {
      console.log(`[MAPSERVICE] map[${i}]:`, {
        id: m.id,
        name: m.name,
        imageUrlLen: m.imageUrl?.length || 0,
        imageUrlStart: m.imageUrl?.substring(0, 60) || 'NONE',
      });
    });
    const totalBytes = snap.reduce((acc, m) => acc + (m.imageUrl?.length || 0), 0);
    console.log('[MAPSERVICE] Total imageUrl bytes:', totalBytes, `(~${Math.round(totalBytes / 1024)}KB)`);
    return snap;
  }

  /** Carrega mapas de um snapshot */
  loadFromSnapshot(maps: MapData[]): void {
    console.log('[MAPSERVICE] loadFromSnapshot() — recebidos', maps.length, 'mapas');
    // Limpa imageObj — não serializável (JSON.stringify transforma em {}).
    // O BackgroundRenderer recarregará a imagem via imageUrl (data URL) com onload.
    const clean = maps.map((m) => {
      const { imageObj, ...rest } = m;
      return { ...rest, imageObj: undefined } as unknown as MapData;
    });
    clean.forEach((m, i) => {
      console.log(`[MAPSERVICE] loadFromSnapshot map[${i}]:`, {
        id: m.id,
        name: m.name,
        imageUrlLen: m.imageUrl?.length || 0,
        imageUrlOk: m.imageUrl?.length > 100,
      });
    });
    console.log('[MAPSERVICE] loadFromSnapshot — setando maps signal com', clean.length, 'mapas');
    this.maps.set(clean);
    console.log('[MAPSERVICE] loadFromSnapshot — CONFIRMADO mapList length:', this.maps().length);
  }

  /** Remove todos os mapas */
  clear(): void {
    this.maps.set([]);
    this.selectedMapId.set(null);
  }
}
