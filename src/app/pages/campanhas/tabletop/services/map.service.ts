import { Injectable, signal } from '@angular/core';
import { MapData } from '../models';

/**
 * Serviço de gerenciamento de mapas.
 * Responsável por carregar, trocar e posicionar mapas no background.
 */
@Injectable({ providedIn: 'root' })
export class MapService {
  private currentMap = signal<MapData | null>(null);
  private maps = signal<MapData[]>([]);
  private isLoading = signal(false);

  readonly map = this.currentMap.asReadonly();
  readonly mapList = this.maps.asReadonly();
  readonly loading = this.isLoading.asReadonly();

  /**
   * Carrega um mapa a partir de um arquivo de imagem.
   * Suporta JPG, PNG, WebP.
   * O arquivo é lido como dataURL para renderização no canvas.
   */
  loadMapFromFile(file: File): Promise<MapData> {
    return new Promise((resolve, reject) => {
      this.isLoading.set(true);

      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const img = new Image();
        img.onload = () => {
          const mapData: MapData = {
            id: crypto.randomUUID(),
            name: file.name.replace(/\.[^/.]+$/, ''),
            imageUrl: e.target?.result as string,
            width: img.width,
            height: img.height,
            scale: 1,
            x: 0,
            y: 0,
            locked: false,
            imageObj: img,
          };

          this.currentMap.set(mapData);
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

  /** Troca para um mapa já carregado */
  setMap(map: MapData): void {
    this.currentMap.set({ ...map });
  }

  /** Remove um mapa da lista */
  removeMap(id: string): void {
    this.maps.update((list) => list.filter((m) => m.id !== id));
    const current = this.currentMap();
    if (current?.id === id) {
      this.currentMap.set(null);
    }
  }

  /** Atualiza propriedades do mapa atual */
  updateMap(partial: Partial<MapData>): void {
    this.currentMap.update((m) => (m ? { ...m, ...partial } : m));
    // Sync com a lista
    const current = this.currentMap();
    if (current) {
      this.maps.update((list) =>
        list.map((item) => (item.id === current.id ? { ...current } : item)),
      );
    }
  }

  /** Centraliza o mapa no centro da tela sem alterar a escala */
  centerMap(containerWidth: number, containerHeight: number): void {
    const map = this.currentMap();
    if (!map) return;

    this.updateMap({
      x: (containerWidth / 2) - (map.width * map.scale) / 2,
      y: (containerHeight / 2) - (map.height * map.scale) / 2,
    });
  }

  /** Ajusta a escala do mapa para caber na tela e o centraliza */
  fitToScreen(containerWidth: number, containerHeight: number): void {
    const map = this.currentMap();
    if (!map) return;

    const scaleX = containerWidth / map.width;
    const scaleY = containerHeight / map.height;
    const fitScale = Math.min(scaleX, scaleY) * 0.95;

    this.updateMap({
      scale: fitScale,
      x: (containerWidth / 2) - (map.width * fitScale) / 2,
      y: (containerHeight / 2) - (map.height * fitScale) / 2,
    });
  }

  /** Retorna a escala para 1:1 original */
  resetScale(): void {
    this.updateMap({ scale: 1 });
  }

  /** Trava ou destrava a edição do mapa */
  toggleLock(): void {
    const map = this.currentMap();
    if (map) {
      this.updateMap({ locked: !map.locked });
    }
  }

  /** Limpa o mapa atual */
  clear(): void {
    this.currentMap.set(null);
  }
}
