import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  ChangeDetectionStrategy,
  signal,
  computed,
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
  FogCollisionService,
  ToolService,
  VttEventService,
  PersistenceService,
} from './services';
import { ToolMode } from './models';
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
 * Ordem de camadas: Grid → Mapas → Fog → Tokens → UI
 */
@Component({
  selector: 'app-tabletop-canvas',
  standalone: true,
  imports: [CommonModule, MapContextMenuComponent],
  template: `
    <div class="vtt-container">
      <!-- Toolbar lateral esquerda -->
      <aside class="toolbar">
        <div class="tool-group">
          <!-- Selecionar -->
          <button
            class="tool-btn"
            [class.active]="activeTool() === 'select'"
            title="Selecionar (1)"
            (click)="selectTool('select')"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
            </svg>
          </button>

          <!-- Fog (com submenu) -->
          <div class="tool-with-submenu" (mouseenter)="onFogSubmenuEnter()" (mouseleave)="onFogSubmenuLeave()">

            <button
              class="tool-btn"
              [class.active]="activeTool() === 'fog-rectangle' || activeTool() === 'fog-brush'"
              title="Fog of War"
              (click)="toggleFog()"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M18 10a4 4 0 00-7.6-1.8A3 3 0 008 11a3 3 0 000 6h10a2 2 0 000-4z" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity="0.2"/>
              </svg>
            </button>

            @if (showFogSubmenu()) {
              <div class="submenu">
                <button class="submenu-btn" [class.active]="activeTool() === 'fog-rectangle'" (click)="selectTool('fog-rectangle'); $event.stopPropagation()">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.5"/>
                  </svg>
                  Retângulo
                </button>
                <button class="submenu-btn" [class.active]="activeTool() === 'fog-brush'" (click)="selectTool('fog-brush'); $event.stopPropagation()">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M3 17l4 4L19 9a2.83 2.83 0 00-4-4L3 17z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                    <path d="M14 6l4 4" stroke="currentColor" stroke-width="1.5"/>
                  </svg>
                  Caneta
                </button>
                <div class="submenu-divider"></div>
                <button class="submenu-btn danger" (click)="clearFog(); $event.stopPropagation()">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                  Limpar todas
                </button>
              </div>
            }
          </div>
        </div>

        <div class="tool-divider"></div>

        <!-- GM Vision toggle -->
        <button class="tool-btn" [class.active]="gmVision()" title="GM Vision" (click)="toggleGmVision()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.5"/>
            <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/>
          </svg>
        </button>

        <!-- Reset Zoom -->
        <button class="tool-btn" title="Reset Zoom" (click)="resetCamera()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/>
            <path d="M8 12h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>

        <!-- Grid Toggle -->
        <button class="tool-btn" title="Grid (G)" (click)="toggleGrid()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/>
            <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/>
            <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/>
            <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/>
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

        <!-- Indicador de ferramenta ativa -->
        @if (activeTool() !== 'select') {

          <div class="tool-indicator">{{ toolLabel() }}</div>
        }
      </div>

      <!-- File upload input -->
      <input #mapFileInput type="file" accept="image/jpeg,image/png,image/webp" (change)="handleMapUpload($event)" hidden />
      <input #tokenFileInput type="file" accept="image/*" (change)="handleTokenUpload($event)" hidden />

      <!-- Menu contextual -->
      <app-map-context-menu />

      <!-- Modal de aviso de tamanho -->
      @if (showSizeWarning()) {
        <div class="modal-overlay" (click)="closeSizeWarning()">
          <div class="modal-content" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#f44336" stroke-width="1.5"/>
                <path d="M12 8v4M12 16h.01" stroke="#f44336" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <h3>Imagem muito grande</h3>
            </div>
            <div class="modal-body">
              @if (sizeWarningData(); as data) {
                <p>O arquivo <strong>{{ data.name }}</strong> tem <strong>{{ data.fileSizeMB }}MB</strong>.</p>
                <p>O limite máximo permitido é de <strong>{{ data.maxSizeMB }}MB</strong> por imagem.</p>
              }
              <p class="modal-hint">Imagens grandes não cabem no armazenamento local do navegador (localStorage).</p>
            </div>
            <div class="modal-footer">
              <button class="modal-btn" (click)="closeSizeWarning()">Entendi</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    .vtt-container { display: flex; width: 100%; height: 100%; background: #1a1a2e; position: relative; overflow: hidden; }
    .canvas-container { flex: 1; position: relative; outline: none; cursor: default; }
    .canvas-container canvas { display: block; }
    .zoom-indicator { position: absolute; bottom: 12px; right: 12px; background: rgba(0,0,0,0.6); color: #aaa; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-family: monospace; pointer-events: none; z-index: 10; }
    .tool-indicator { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); background: rgba(79,195,247,0.15); color: #4fc3f7; padding: 4px 14px; border-radius: 6px; font-size: 13px; font-weight: 500; border: 1px solid rgba(79,195,247,0.3); pointer-events: none; z-index: 10; }
    .toolbar { width: 48px; background: #16162a; border-right: 1px solid #2a2a4a; display: flex; flex-direction: column; align-items: center; padding: 8px 0; gap: 4px; z-index: 5; }
    .tool-group { display: flex; flex-direction: column; gap: 2px; }
    .tool-divider { width: 28px; height: 1px; background: #2a2a4a; margin: 6px 0; }
    .tool-btn { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: transparent; border: 1px solid transparent; border-radius: 6px; color: #6a6a8a; cursor: pointer; transition: all 0.15s ease; }
    .tool-btn:hover { color: #ccc; background: #1e1e3a; }
    .tool-btn.active { color: #4fc3f7; background: rgba(79, 195, 247, 0.1); border-color: rgba(79,195,247,0.3); }
    .map-quick-actions { position: absolute; top: 12px; left: 56px; background: rgba(22,22,42,0.85); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 3px; display: flex; gap: 2px; z-index: 10; box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
    .quick-btn { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; border-radius: 4px; color: #8a8aaa; cursor: pointer; transition: all 0.15s; }
    .quick-btn:hover { color: #fff; background: rgba(255,255,255,0.1); }
    .tool-with-submenu { position: relative; }
    .submenu { position: absolute; left: 100%; top: -4px; margin-left: 4px; background: #1e1e3a; border: 1px solid #2a2a4a; border-radius: 8px; padding: 4px; min-width: 160px; z-index: 1000; box-shadow: 0 8px 24px rgba(0,0,0,0.5); display: flex; flex-direction: column; gap: 2px; }
    .submenu-btn { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: transparent; border: none; border-radius: 4px; color: #b0b0c0; font-size: 13px; cursor: pointer; transition: all 0.12s; white-space: nowrap; }
    .submenu-btn:hover { background: rgba(79,195,247,0.1); color: #e0e0e0; }
    .submenu-btn.active { background: rgba(79,195,247,0.15); color: #4fc3f7; }
    .submenu-btn.danger:hover { background: rgba(244,67,54,0.1); color: #f44336; }
    .submenu-divider { height: 1px; background: #2a2a4a; margin: 4px 8px; }
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal-content { background: #1e1e3a; border: 1px solid #2a2a4a; border-radius: 12px; padding: 0; width: 400px; max-width: 90vw; box-shadow: 0 8px 32px rgba(0,0,0,0.5); }
    .modal-header { display: flex; align-items: center; gap: 10px; padding: 16px 20px; border-bottom: 1px solid #2a2a4a; }
    .modal-header h3 { margin: 0; font-size: 16px; font-weight: 600; color: #e0e0e0; }
    .modal-body { padding: 20px; color: #b0b0c0; font-size: 14px; line-height: 1.6; }
    .modal-body strong { color: #e0e0e0; }
    .modal-hint { margin-top: 12px; font-size: 12px; color: #6a6a8a; font-style: italic; }
    .modal-footer { padding: 12px 20px; border-top: 1px solid #2a2a4a; display: flex; justify-content: flex-end; }
    .modal-btn { background: #4fc3f7; color: #0a0a1a; border: none; border-radius: 6px; padding: 8px 24px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
    .modal-btn:hover { background: #39a9db; }
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

  // Limte: ~3MB de arquivo original ≈ ~4MB de dataURL
  private readonly MAX_IMAGE_FILE_BYTES = 3 * 1024 * 1024;

  // Modal de erro
  readonly showSizeWarning = signal(false);
  readonly sizeWarningData = signal<{ name: string; fileSizeMB: string; maxSizeMB: string } | null>(null);

  // Submenu fog — com delay para permitir mouse sair do botão em direção ao submenu
  readonly showFogSubmenu = signal(false);
  private fogSubmenuTimer: ReturnType<typeof setTimeout> | null = null;

  protected onFogSubmenuEnter(): void {
    if (this.fogSubmenuTimer) {
      clearTimeout(this.fogSubmenuTimer);
      this.fogSubmenuTimer = null;
    }
    this.showFogSubmenu.set(true);
  }

  protected onFogSubmenuLeave(): void {
    this.fogSubmenuTimer = setTimeout(() => {
      this.showFogSubmenu.set(false);
    }, 200);
  }

  // Tool label for indicator
  readonly toolLabel = computed(() => {
    const tool = this.activeTool();
    if (tool === 'select') return '';
    const sub = tool === 'fog-rectangle' ? '▭ Retângulo' : '✏ Caneta';
    return `🌫 Esconder (${sub})`;
  });

  // Serviços
  private ngZone = inject(NgZone);
  private cameraService = inject(CameraService);
  private gridService = inject(GridService);
  private mapService = inject(MapService);
  private tokenService = inject(TokenService);
  private fogService = inject(FogService);
  private fogCollisionService = inject(FogCollisionService);
  private toolService = inject(ToolService);
  private eventService = inject(VttEventService);
  private persistence = inject(PersistenceService);
  private route = inject(ActivatedRoute);

  // Signals UI
  readonly activeTool = this.toolService.currentTool;
  readonly zoomLevel = this.cameraService.scale;
  readonly gmVision = this.fogService.gmVision;
  readonly selectedMap = this.mapService.selectedMap;

  // Stage Konva
  private stage!: Konva.Stage;
  private backgroundRenderer!: BackgroundRenderer;
  private gridRenderer!: GridRenderer;
  private fogRenderer!: FogRenderer;
  private tokenRenderer!: TokenRenderer;
  private renderers: any[] = [];
  private isSpaceDown = false;
  private isMiddleMouseDown = false;

  constructor() {
    effect(() => {
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
    this.applyCameraToStage();
  }

  ngOnDestroy(): void {
    this.eventService.completeAll();
    this.renderers.forEach((r: any) => r.destroy());
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
    // Ordem de adição no stage determina z-order
    // 1) Grid (mais ao fundo)
    this.gridRenderer = new GridRenderer(this.stage, this.gridService);
    // 2) Background (mapas)
    this.backgroundRenderer = new BackgroundRenderer(this.stage, this.mapService);
    // 3) Fog
    this.fogRenderer = new FogRenderer(this.stage, this.fogService);
    // 4) Tokens
    this.tokenRenderer = new TokenRenderer(this.stage, this.tokenService, this.gridService, this.eventService, this.fogCollisionService);

    this.renderers = [this.gridRenderer, this.backgroundRenderer, this.fogRenderer, this.tokenRenderer];

    // Callback: clique no fundo do background → deseleciona
    this.backgroundRenderer.onBackgroundClick = () => {
      this.ngZone.run(() => {
        this.mapService.deselectMap();
        this.renderAll();
      });
    };

    // Callback: botão direito no mapa → menu contextual
    this.backgroundRenderer.onContextMenu = (mapId: string, clientX: number, clientY: number) => {
      this.ngZone.run(() => {
        if (this.contextMenuComponent) {
          this.contextMenuComponent.open(mapId, clientX, clientY);
        }
      });
    };
  }

  /** Converte coordenadas da tela para coordenadas do mundo (considerando zoom/pan) */
  private screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const containerRect = this.containerRef.nativeElement.getBoundingClientRect();
    const screenX = clientX - containerRect.left;
    const screenY = clientY - containerRect.top;
    const stageX = this.stage.x();
    const stageY = this.stage.y();
    const scale = this.stage.scaleX();
    return {
      x: (screenX - stageX) / scale,
      y: (screenY - stageY) / scale,
    };
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

    // ── Mouse down ──
    this.stage.on('mousedown', (e: Konva.KonvaEventObject<MouseEvent>) => {
      const pos = this.stage.getPointerPosition();
      if (!pos) return;

      // Pan com botão do meio ou space
      if (e.evt.button === 1 || this.isSpaceDown) {
        this.cameraService.startPan();
        this.isMiddleMouseDown = true;
        this.stage.container().style.cursor = 'grabbing';
        return;
      }

      // Botão direito ignorado (contextmenu trata)
      if (e.evt.button === 2) return;

      const tool = this.activeTool();

      // ── FOG MODE ──
      if (tool === 'fog-rectangle' || tool === 'fog-brush') {
        const world = this.screenToWorld(e.evt.clientX, e.evt.clientY);
        if (tool === 'fog-rectangle') {
          this.fogRenderer.startRect(world.x, world.y);
        } else {
          this.fogRenderer.startBrush(world.x, world.y);
        }
        return;
      }

      // ── SELECT - deseleciona ao clicar no fundo ──
      if (e.target === this.stage) {
        this.mapService.deselectMap();
        this.tokenService.deselectAll();
      }
    });

    // ── Mouse move ──
    this.stage.on('mousemove', (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Pan
      if (this.isMiddleMouseDown || this.isSpaceDown) {
        this.stage.x(this.stage.x() + e.evt.movementX);
        this.stage.y(this.stage.y() + e.evt.movementY);
        this.cameraService.updateState(this.stage.x(), this.stage.y(), this.stage.scaleX());
        this.renderAll();
        return;
      }

      const tool = this.activeTool();

      // ── FOG ──
      if (tool === 'fog-rectangle' || tool === 'fog-brush') {
        const world = this.screenToWorld(e.evt.clientX, e.evt.clientY);
        if (tool === 'fog-rectangle' && this.fogRenderer.isDrawing) {
          this.fogRenderer.updateRect(world.x, world.y);
        } else if (tool === 'fog-brush' && this.fogRenderer.isDrawing) {
          this.fogRenderer.updateBrush(world.x, world.y);
        }
        return;
      }
    });

    // ── Mouse up ──
    this.stage.on('mouseup', () => {
      if (this.isMiddleMouseDown) {
        this.cameraService.endPan();
        this.isMiddleMouseDown = false;
        this.stage.container().style.cursor = 'default';
        return;
      }

      const tool = this.activeTool();

      // ── FOG — finish ──
      if (tool === 'fog-rectangle') {
        this.fogRenderer.finishRect();
        this.renderAll();
        return;
      }

      if (tool === 'fog-brush') {
        this.fogRenderer.finishBrush();
        this.renderAll();
        return;
      }
    });

    // Context menu no stage
    this.stage.on('contextmenu', (e: Konva.KonvaEventObject<PointerEvent>) => {
      e.evt.preventDefault();
      const target = e.target;
      if (target && target.name()?.startsWith('map-image-')) {
        const mapId = target.name()!.replace('map-image-', '');
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
  // FERRAMENTAS
  // ════════════════════════════════════════════════════════

  protected selectTool(tool: ToolMode): void {
    this.toolService.setTool(tool);
    // Fecha submenu ao selecionar
    if (tool === 'fog-rectangle' || tool === 'fog-brush') {
      this.showFogSubmenu.set(false);
      // Garante que o fog está ativado para o desenho aparecer
      if (!this.fogService.enabled()) {
        this.fogService.toggleEnabled();
      }
      this.renderAll();
    }
  }

  protected toggleGmVision(): void {
    this.fogService.toggleGmVision();
    this.renderAll();
  }

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
    this.fogService.toggleEnabled();
    this.renderAll();
  }

  protected clearFog(): void {
    this.fogService.clear();
    this.fogRenderer.clear();
    this.renderAll();
    this.showFogSubmenu.set(false);
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
      this.showFogSubmenu.set(false);
      // Se escolheu ferramenta de fog, garante que fog está ativado
      const tool = this.activeTool();
      if (tool === 'fog-rectangle' || tool === 'fog-brush') {
        if (!this.fogService.enabled()) {
          this.fogService.toggleEnabled();
        }
        this.renderAll();
      }
      return;
    }

    if (event.key === 'Escape') {
      // Cancela desenho de fog em progresso + volta pra select
      this.fogRenderer.cancelDrawing();
      this.toolService.revertToSelect();
      this.mapService.deselectMap();
      this.tokenService.deselectAll();
      this.renderAll();
      return;
    }

    switch (event.key) {
      case 'g': case 'G': this.toggleGrid(); break;
      case 'f': case 'F': this.toggleGmVision(); break;
      case 'Delete': case 'Backspace': this.tokenService.removeSelected(); this.renderAll(); break;
      case 'c': if (event.ctrlKey) this.tokenService.copySelected(); break;
      case 'v': if (event.ctrlKey) { this.tokenService.pasteFromClipboard(); this.renderAll(); } break;
      case 'd': if (event.ctrlKey) { this.tokenService.duplicateSelected(); this.renderAll(); } break;
      case 'z': if (event.ctrlKey) { /* future: undo */ } break;
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
  // AÇÕES DO MAPA
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

    if (file.size > this.MAX_IMAGE_FILE_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      const maxMB = (this.MAX_IMAGE_FILE_BYTES / (1024 * 1024)).toFixed(0);
      this.sizeWarningData.set({ name: file.name, fileSizeMB: mb, maxSizeMB: maxMB });
      this.showSizeWarning.set(true);
      target.value = '';
      return;
    }

    this.mapService.loadMapFromFile(file).then((map) => {
      const size = this.cameraService.getContainerSize();
      this.mapService.centerMap(map.id, size.width, size.height);
      this.renderAll();
      target.value = '';
    });
  }

  protected closeSizeWarning(): void {
    this.showSizeWarning.set(false);
    this.sizeWarningData.set(null);
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
  }

  // ════════════════════════════════════════════════════════
  // LOAD
  // ════════════════════════════════════════════════════════

  private applyCameraToStage(): void {
    const cam = this.cameraService.getSnapshot();
    this.stage.position({ x: cam.x, y: cam.y });
    this.stage.scale({ x: cam.scale, y: cam.scale });
  }

  private loadCampaignData(): void {
    this.persistence.load();
  }
}
