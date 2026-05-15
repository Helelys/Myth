import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapService } from './services';

/**
 * Componente de menu contextual HTML para mapas.
 *
 * Fica FORA do canvas Konva.
 * Renderiza via signal.
 * Aparece em coordenadas fixed (clientX/clientY).
 */
@Component({
    selector: 'app-map-context-menu',
    standalone: true,
    imports: [CommonModule],
    template: `
    @if (visible()) {
      <!-- Overlay: captura clique fora -->
      <div class="ctx-overlay" (click)="close()" (contextmenu)="close(); $event.preventDefault()"></div>

      <!-- Menu posicionado -->
      <div
        class="ctx-menu"
        [style.left.px]="x()"
        [style.top.px]="y()"
      >
        @let m = mapData();
        @if (m) {
          <button class="ctx-item" (click)="edit()">
            <span class="ctx-icon">✏</span>
            <span>Editar mapa</span>
          </button>

          @if (m.locked) {
            <button class="ctx-item" (click)="unlock()">
              <span class="ctx-icon">🔓</span>
              <span>Destravar mapa</span>
            </button>
          } @else {
            <button class="ctx-item" (click)="lock()">
              <span class="ctx-icon">🔒</span>
              <span>Travar mapa</span>
            </button>
          }

          <button class="ctx-item" (click)="bringToFront()">
            <span class="ctx-icon">⬆</span>
            <span>Trazer frente</span>
          </button>
          <button class="ctx-item" (click)="sendToBack()">
            <span class="ctx-icon">⬇</span>
            <span>Enviar trás</span>
          </button>

          <div class="ctx-divider"></div>

          <button class="ctx-item ctx-danger" (click)="deleteMap()">
            <span class="ctx-icon">🗑</span>
            <span>Excluir mapa</span>
          </button>
        }
      </div>
    }
  `,
    styles: [`
    .ctx-overlay {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      z-index: 999999998;
      background: transparent;
    }
    .ctx-menu {
      position: fixed;
      z-index: 999999999;
      width: 220px;
      background: #161625;
      border-radius: 14px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(10px);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
      padding: 8px;
    }
    .ctx-item {
      width: 100%;
      border: none;
      background: transparent;
      color: white;
      padding: 12px;
      text-align: left;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      transition: background 0.12s;
    }
    .ctx-item:hover {
      background: rgba(255, 255, 255, 0.06);
    }
    .ctx-item.ctx-danger:hover {
      background: rgba(255, 80, 80, 0.15);
      color: #ff6b6b;
    }
    .ctx-icon {
      font-size: 15px;
      width: 20px;
      text-align: center;
      flex-shrink: 0;
    }
    .ctx-divider {
      height: 1px;
      background: rgba(255, 255, 255, 0.08);
      margin: 4px 0;
    }
  `],
})
export class MapContextMenuComponent {
    private mapService = inject(MapService);

    /** Estado do menu */
    readonly visible = signal(false);
    readonly x = signal(0);
    readonly y = signal(0);
    private mapId = signal<string | null>(null);

    /** Dados do mapa atual para o template */
    readonly mapData = this.mapService.getMapByIdSignal(this.mapId);

    /** Abre o menu */
    open(mapId: string, clientX: number, clientY: number): void {
        this.mapId.set(mapId);
        this.x.set(clientX);
        this.y.set(clientY);
        this.visible.set(true);
    }

    /** Fecha o menu */
    close(): void {
        this.visible.set(false);
        this.mapId.set(null);
    }

    protected edit(): void {
        const id = this.mapId();
        if (!id) return;
        this.mapService.selectMap(id);
        this.close();
    }

    protected lock(): void {
        const id = this.mapId();
        if (!id) return;
        this.mapService.updateMap(id, { locked: true });
        this.close();
    }

    protected unlock(): void {
        const id = this.mapId();
        if (!id) return;
        this.mapService.updateMap(id, { locked: false });
        this.close();
    }

    protected bringToFront(): void {
        const id = this.mapId();
        if (!id) return;
        this.mapService.bringToFront(id);
        this.close();
    }

    protected sendToBack(): void {
        const id = this.mapId();
        if (!id) return;
        this.mapService.sendToBack(id);
        this.close();
    }

    protected deleteMap(): void {
        const id = this.mapId();
        if (!id) return;
        this.mapService.removeMap(id);
        this.close();
    }
}
