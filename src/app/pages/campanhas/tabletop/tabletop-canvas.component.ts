import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  ChangeDetectionStrategy,
  signal,
  effect,
  inject,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import Konva from 'konva';

import {
  CameraService,
  GridService,
  MapService,
  TokenService,
  FogService,
  ToolService,
  VttEventService,
} from './services';
import { ToolType } from './models';
import {
  BackgroundRenderer,
  GridRenderer,
  TokenRenderer,
  FogRenderer,
} from './renderers';
import { MapContextMenuComponent } from './map-context-menu.component';

/**
 * Componente principal do Tabletop VTT.
 *
 * SIMPLIFICADO:
 * - SEM toolbar flutuante de mapa
 * - Botão direito abre menu contextual HTML real (MapContextMenuComponent)
 * - Múltiplos mapas suportados simultaneamente via MapService
 * - Render loop via renderAll()
 */
@Component({
  selector: 'app-tabletop-canvas',
  standalone: true,
  imports: [CommonModule, MapContextMenuComponent],
  template: `
    <div class="vtt-container">
      <!-- Toolbar lateral esquerda (global do canvas) -->
      <aside class="toolbar">
        <div class="tool-group">
          @for (tool of tools; track tool.type) {
            <button
              class="tool-btn"
              [class.active]="activeTool() === tool.type"
              [title]="tool.label + ' (' + tool.shortcut + ')'"
              (click)="selectTool(tool.type)"
            >
              <span [innerHTML]="tool.icon"></span>
            </button>
          }
        </div>
        <div class="tool-divider"></div>
        <button class="tool-btn" title="Reset Zoom" (click)="resetCamera()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/>
            <path d="M8 12h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
        <button class="tool-btn" title="Grid Toggle (G)" (click)="toggleGrid()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/>
            <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/>
            <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/>
            <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/>
          </svg>
        </button>
        <button class="tool-btn" title="Fog Toggle (F)" (click)="toggleFog()" [class.active]="fogEnabled()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M3 12h18M3 16h12M3 20h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </aside>

      <!-- Canvas principal -->
      <div class="canvas-container" #canvasContainer
        (contextmenu)="preventContextMenu($event)"
        (keydown)="handleKeyDown($event)"
        (keyup)="handleKeyUp($event)"
        tabindex="0"
      >
        <!-- Indicador de zoom -->
        <div class="zoom-indicator">{{ zoomLevel() }}%</div>

        <!-- Botões rápidos para o mapa selecionado -->
        @if (selectedMap(); as map) {
          <div class="map-quick-actions">
            <button class="quick-btn" title="Centralizar" (click)="centerMap()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 12h16M12 4v16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
            <button class="quick-btn" title="Ajustar à Tela" (click)="fitMapToScreen()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="quick-btn" title="Escala 1:1" (click)="resetMapScale()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>
        }
      </div>

      <!-- File upload input -->
      <input #mapFileInput type="file" accept="image/jpeg,image/png,image/webp" (change)="handleMapUpload($event)" hidden />
      <input #tokenFileInput type="file" accept="image/*" (change)="handleTokenUpload($event)" hidden />

      <!-- ════════════════════════════════════════════════════
           MENU CONTEXTUAL — COMPONENTE SEPARADO (fora do Konva)
           ════════════════════════════════════════════════════ -->
      <app-map-context-menu />
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    .vtt-container {
      display: flex;
      width: 100%;
      height: 100%;
      background: #1a1a2e;
      position: relative;
      overflow: hidden;
    }
    .canvas-container {
      flex: 1;
      position: relative;
      outline: none;
      cursor: default;
    }
    .canvas-container canvas { display: block; }
    .zoom-indicator {
      position: absolute;
      bottom: 12px; right: 12px;
      background: rgba(0,0,0,0.6);
      color: #aaa;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 12px;
      font-family: monospace;
      pointer-events: none;
      z-index: 10;
    }
    .toolbar {
      width: 48px;
      background: #16162a;
      border-right: 1px solid #2a2a4a;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px 0;
      gap: 4px;
      z-index: 5;
    }
    .tool-group { display: flex; flex-direction: column; gap: 2px; }
    .tool-divider { width: 28px; height: 1px; background: #2a2a4a; margin: 6px 0; }
    .tool-btn {
      width: 36px; height: 36px;
      display: flex; align-items: center; justify-content: center;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 6px;
      color: #6a6a8a;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .tool-btn:hover { color: #ccc; background: #1e1e3a; }
    .tool-btn.active { color: #4fc3f7; background: rgba(79, 195, 247, 0.1); }
    .map-quick-actions {
      position: absolute;
      top: 12px; left: 50%; transform: translateX(-50%);
      background: rgba(22,22,42,0.85);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 3px; display: flex; gap: 2px;
      z-index: 10; box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    }
    .quick-btn {
      width: 28px; height: 28px;
      display: flex; align-items: center; justify-content: center;
      background: transparent; border: none; border-radius: 4px;
      color: #8a8aaa; cursor: pointer; transition: all 0.15s;
    }
    .quick-btn:hover { color: #fff; background: rgba(255,255,255,0.1); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabletopCanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer', { static: true })
  private containerRef!: ElementRef<HTMLDivElement>;

  @ViewChild('mapFileInput', { static: true })
  private mapFileInput!: ElementRef<HTMLInputElement>;

  @ViewChild('tokenFileInput', { static: true })
  private tokenFileInput!: ElementRef<HTMLInputElement>;

  @ViewChild(MapContextMenuComponent)
  private contextMenuComponent!: MapContextMenuComponent;

  // Serviços
  private ngZone = inject(NgZone);
  private cameraService = inject(CameraService);
  private gridService = inject(GridService);
  private mapService = inject(MapService);
  private tokenService = inject(TokenService);
  private fogService = inject(FogService);
  private toolService = inject(ToolService);
  private eventService = inject(VttEventService);
  private route = inject(ActivatedRoute);

  // Signals UI
  readonly activeTool = this.toolService.currentTool;
  readonly zoomLevel = this.cameraService.scale;
  readonly fogEnabled = this.fogService.enabled;
  readonly selectedMap = this.mapService.selectedMap;

  protected tools = [
    { type: ToolType.Select, label: 'Selecionar', shortcut: '1', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>' },
    { type: ToolType.Pan, label: 'Mover', shortcut: 'Space', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
    { type: ToolType.FogReveal, label: 'Revelar', shortcut: '3', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" fill="currentColor" opacity="0.3"/><circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="1.5"/></svg>' },
    { type: ToolType.FogHide, label: 'Esconder', shortcut: '4', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" fill="currentColor"/><path d="M3 3l18 18" stroke="currentColor" stroke-width="1.5"/></svg>' },
  ];
  protected activeToolLabel = this.toolService.currentTool;

  // Stage Konva
  private stage!: Konva.Stage;
  private backgroundRenderer!: BackgroundRenderer;
  private renderers: (GridRenderer | TokenRenderer | FogRenderer)[] = [];
  private isSpaceDown = false;
  private isMiddleMouseDown = false;

  constructor() {
    effect(() => {
      // Monitora alterações nos signals e re-renderiza
      this.tokenService.tokenList();
      this.mapService.mapList();
      if (this.stage) {
        this.renderAll();
      }
    });
  }

  ngAfterViewInit(): void {
    this.initStage();
    this.initRenderers();
    this.setupEventListeners();
    this.loadCampaignData();
    console.log('[TabletopCanvas] Inicializado', {
      stageExists: !!this.stage,
      bgRendererExists: !!this.backgroundRenderer,
    });
  }

  ngOnDestroy(): void {
    this.eventService.completeAll();
    this.renderers.forEach((r) => r.destroy());
    this.backgroundRenderer?.destroy();
    this.stage?.destroy();
  }

  private initStage(): void {
    const container = this.containerRef.nativeElement;
    const { width, height } = container.getBoundingClientRect();
    this.stage = new Konva.Stage({ container, width, height });
    this.cameraService.setContainerSize(width, height);
  }

  private initRenderers(): void {
    this.backgroundRenderer = new BackgroundRenderer(this.stage, this.mapService);

    // Callback: clique no fundo → deseleciona
    this.backgroundRenderer.onBackgroundClick = () => {
      this.ngZone.run(() => {
        this.mapService.deselectMap();
        this.renderAll();
      });
    };

    // Callback: botão direito no mapa → abre menu contextual HTML
    this.backgroundRenderer.onContextMenu = (mapId: string, clientX: number, clientY: number) => {
      console.log('[ContextMenu] onContextMenu callback chamado', { mapId, clientX, clientY });
      this.ngZone.run(() => {
        if (this.contextMenuComponent) {
          this.contextMenuComponent.open(mapId, clientX, clientY);
        } else {
          console.warn('[ContextMenu] contextMenuComponent não disponível');
        }
      });
    };

    this.renderers = [
      new GridRenderer(this.stage, this.gridService),
      new TokenRenderer(this.stage, this.tokenService, this.gridService, this.eventService),
      new FogRenderer(this.stage, this.fogService),
    ];
  }

  private setupEventListeners(): void {
    const container = this.containerRef.nativeElement;

    // Resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        this.stage.width(width);
        this.stage.height(height);
        this.cameraService.setContainerSize(width, height);
        this.renderAll();
      }
    });
    resizeObserver.observe(container);

    // Wheel (zoom)
    this.stage.on('wheel', (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const pointer = this.stage.getPointerPosition();
      if (!pointer) return;
      const oldScale = this.stage.scaleX();
      const scaleBy = 1.05;
      const mousePointTo = {
        x: (pointer.x - this.stage.x()) / oldScale,
        y: (pointer.y - this.stage.y()) / oldScale,
      };
      const direction = e.evt.deltaY > 0 ? -1 : 1;
      let newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
      newScale = Math.max(0.1, Math.min(5, newScale));
      this.stage.scale({ x: newScale, y: newScale });
      const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      };
      this.stage.position(newPos);
      this.cameraService.updateState(newPos.x, newPos.y, newScale);
      this.renderAll();
    });

    // Mouse down
    this.stage.on('mousedown', (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!this.stage.getPointerPosition()) return;
      if (e.evt.button === 1 || this.isSpaceDown) {
        this.cameraService.startPan();
        this.isMiddleMouseDown = true;
        this.stage.container().style.cursor = 'grabbing';
        return;
      }
      if (e.evt.button === 2) return; // botão direito tratado via contextmenu
      if (e.target === this.stage) {
        this.mapService.deselectMap();
        this.tokenService.deselectAll();
      }
    });

    // Mouse move (pan)
    this.stage.on('mousemove', (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!this.isMiddleMouseDown && !this.isSpaceDown) return;
      this.stage.x(this.stage.x() + e.evt.movementX);
      this.stage.y(this.stage.y() + e.evt.movementY);
      this.cameraService.updateState(this.stage.x(), this.stage.y(), this.stage.scaleX());
      this.renderAll();
    });

    // Mouse up
    this.stage.on('mouseup', () => {
      if (this.isMiddleMouseDown) {
        this.cameraService.endPan();
        this.isMiddleMouseDown = false;
        this.stage.container().style.cursor = 'default';
      }
    });

    // Context menu no stage tenta identificar qual shape está sob o mouse
    this.stage.on('contextmenu', (e: Konva.KonvaEventObject<PointerEvent>) => {
      e.evt.preventDefault();
      console.log('[ContextMenu] Stage contextmenu disparado', {
        targetName: e.target?.name?.() ?? 'unknown',
        clientX: e.evt.clientX,
        clientY: e.evt.clientY,
      });

      const target = e.target;
      // Verifica se clicou em uma imagem de mapa
      if (target && target.name()?.startsWith('map-image-')) {
        const mapId = target.name()!.replace('map-image-', '');
        console.log('[ContextMenu] Clicou no mapa:', mapId);
        this.ngZone.run(() => {
          this.mapService.selectMap(mapId);
          if (this.contextMenuComponent) {
            this.contextMenuComponent.open(mapId, e.evt.clientX, e.evt.clientY);
          }
        });
      }
    });
  }

  // ════════════════════════════════════════════════════════
  // CÂMERA E FERRAMENTAS
  // ════════════════════════════════════════════════════════

  protected resetCamera(): void {
    this.cameraService.reset();
    this.stage.scale({ x: 1, y: 1 });
    this.stage.position({ x: 0, y: 0 });
    this.renderAll();
  }

  protected toggleGrid(): void {
    this.gridService.toggle();
    this.renderAll();
  }

  protected toggleFog(): void {
    this.fogService.toggle();
    this.renderAll();
  }

  protected selectTool(toolType: ToolType): void {
    this.toolService.setTool(toolType);
  }

  protected preventContextMenu(e: Event): void {
    e.preventDefault();
  }

  protected handleKeyDown(event: KeyboardEvent): void {
    this.eventService.emitKeyDown(event);
    if (event.key === ' ') {
      this.isSpaceDown = true;
      event.preventDefault();
      return;
    }
    if (this.toolService.handleShortcut(event.key)) {
      event.preventDefault();
      return;
    }
    if (event.key === 'Escape') {
      this.mapService.deselectMap();
      this.tokenService.deselectAll();
      this.renderAll();
      return;
    }
    switch (event.key) {
      case 'g': case 'G': this.toggleGrid(); break;
      case 'f': case 'F': this.toggleFog(); break;
      case 'Delete': case 'Backspace': this.tokenService.removeSelected(); this.renderAll(); break;
      case 'c': if (event.ctrlKey) this.tokenService.copySelected(); break;
      case 'v': if (event.ctrlKey) { this.tokenService.pasteFromClipboard(); this.renderAll(); } break;
      case 'd': if (event.ctrlKey) { this.tokenService.duplicateSelected(); this.renderAll(); } break;
    }
  }

  protected handleKeyUp(event: KeyboardEvent): void {
    this.eventService.emitKeyUp(event);
    if (event.key === ' ') {
      this.isSpaceDown = false;
      if (this.isMiddleMouseDown) {
        this.cameraService.endPan();
        this.isMiddleMouseDown = false;
        this.stage.container().style.cursor = 'default';
      }
    }
  }

  // ════════════════════════════════════════════════════════
  // AÇÕES DO MAPA (quick actions)
  // ════════════════════════════════════════════════════════

  centerMap(): void {
    const map = this.mapService.selectedMap();
    if (!map) return;
    const size = this.cameraService.getContainerSize();
    this.mapService.centerMap(map.id, size.width, size.height);
    this.renderAll();
  }

  fitMapToScreen(): void {
    const map = this.mapService.selectedMap();
    if (!map) return;
    const size = this.cameraService.getContainerSize();
    this.mapService.fitToScreen(map.id, size.width, size.height);
    this.renderAll();
  }

  resetMapScale(): void {
    const map = this.mapService.selectedMap();
    if (!map) return;
    this.mapService.resetScale(map.id);
    this.renderAll();
  }

  // ════════════════════════════════════════════════════════
  // UPLOAD
  // ════════════════════════════════════════════════════════

  openMapUpload(): void {
    this.mapFileInput?.nativeElement?.click();
  }

  openTokenUpload(): void {
    this.tokenFileInput?.nativeElement?.click();
  }

  protected handleMapUpload(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    this.mapService.loadMapFromFile(file).then((map) => {
      const size = this.cameraService.getContainerSize();
      this.mapService.centerMap(map.id, size.width, size.height);
      this.renderAll();
      target.value = '';
      console.log('[TabletopCanvas] Mapa carregado:', map.name, 'total mapas:', this.mapService.mapList().length);
    });
  }

  protected handleTokenUpload(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      const img = new Image();
      img.onload = () => {
        const cellSize = this.gridService.cellSize();
        const centerX = (this.stage.width() / 2 - this.stage.x()) / this.stage.scaleX();
        const centerY = (this.stage.height() / 2 - this.stage.y()) / this.stage.scaleY();
        this.tokenService.createToken({
          image: img.src,
          x: centerX - cellSize / 2,
          y: centerY - cellSize / 2,
          width: cellSize,
          height: cellSize,
        });
        this.renderAll();
        target.value = '';
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  // ════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════

  renderAll(): void {
    if (!this.stage) return;
    for (const renderer of this.renderers) {
      renderer.render(this.cameraService);
    }
    this.backgroundRenderer?.render(this.cameraService);
  }

  // ════════════════════════════════════════════════════════
  // LOAD
  // ════════════════════════════════════════════════════════

  private loadCampaignData(): void {
    const campaignId = this.route.snapshot.paramMap.get('id');
    if (campaignId) {
      this.fogService.setCampaignId(campaignId);
      this.fogService.loadFromStorage(campaignId);
      const saved = localStorage.getItem(`mythmaker_vtt_tokens_${campaignId}`);
      if (saved) {
        try {
          const tokens = JSON.parse(saved);
          this.tokenService.loadFromSnapshot(tokens);
        } catch { /* ignore */ }
      }
    }
  }
}
