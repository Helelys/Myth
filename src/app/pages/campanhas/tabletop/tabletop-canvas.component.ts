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
  LayerService,
} from './services';
import { ToolType, FogMode } from './models';
import {
  BackgroundRenderer,
  GridRenderer,
  TokenRenderer,
  FogRenderer,
} from './renderers';
import { CoordinateUtils } from './utils';

/**
 * Componente principal do Tabletop VTT.
 *
 * Gerencia:
 * - Inicialização do Stage Konva
 * - Render loop com requestAnimationFrame
 * - Eventos de mouse/teclado
 * - Zoom/Pan da câmera
 * - Coordenação entre renderers e serviços
 *
 * Performance:
 * - ChangeDetectionStrategy.OnPush
 * - Signals para estado reativo
 * - Render loop em rAF
 * - Culling no renderer de tokens
 * - Grid desenhado apenas para viewport visível
 */
@Component({
  selector: 'app-tabletop-canvas',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="vtt-container">
      <!-- Toolbar lateral esquerda -->
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
        <!-- Map Toolbar -->
        @if (currentMap()) {
          <div class="map-toolbar">
            <button class="tool-btn" title="Centralizar Mapa" (click)="centerMap()">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M4 12h16M12 4v16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
            <button class="tool-btn" title="Ajustar à Tela (Fit)" (click)="fitMapToScreen()">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button class="tool-btn" title="Escala Original (1:1)" (click)="resetMapScale()">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/>
                <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
            <div class="tool-divider horizontal"></div>
            <button class="tool-btn" [title]="currentMap()?.locked ? 'Destravar Mapa' : 'Travar Mapa'" [class.active]="currentMap()?.locked" (click)="toggleMapLock()">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M7 11V7a5 5 0 0110 0v4M5 11h14v10H5V11z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        }

        <!-- Indicador de zoom -->
        <div class="zoom-indicator">
          {{ zoomLevel() }}%
        </div>

        <!-- Indicador de ferramenta ativa -->
        <div class="tool-indicator">
          {{ activeToolLabel() }}
        </div>
      </div>

      <!-- File upload input (oculto) -->
      <input #mapFileInput type="file" accept="image/jpeg,image/png,image/webp" (change)="handleMapUpload($event)" hidden />
      <input #tokenFileInput type="file" accept="image/*" (change)="handleTokenUpload($event)" hidden />
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
      bottom: 12px;
      right: 12px;
      background: rgba(0,0,0,0.6);
      color: #aaa;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 12px;
      font-family: monospace;
      pointer-events: none;
      z-index: 10;
    }
    .tool-indicator {
      position: absolute;
      top: 12px;
      left: 12px;
      background: rgba(0,0,0,0.6);
      color: #ccc;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
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
    .tool-divider {
      width: 28px;
      height: 1px;
      background: #2a2a4a;
      margin: 6px 0;
    }
    .tool-btn {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 6px;
      color: #6a6a8a;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .tool-btn:hover { color: #ccc; background: #1e1e3a; }
    .btn-sm.danger:hover { background: #3a1a1a; border-color: #e05a5a; }
    
    .map-toolbar {
      position: absolute;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(22, 22, 42, 0.9);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 4px;
      display: flex;
      gap: 4px;
      z-index: 10;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    }
    .tool-divider.horizontal {
      width: 1px;
      height: 28px;
      margin: 4px 2px;
      background: rgba(255, 255, 255, 0.1);
    }
    .map-toolbar .tool-btn {
      width: 32px;
      height: 32px;
    }
    .map-toolbar .tool-btn.active {
      color: #e05a5a;
      background: rgba(224, 90, 90, 0.1);
    }
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

  // Serviços injetados
  private cameraService = inject(CameraService);
  private gridService = inject(GridService);
  private mapService = inject(MapService);
  private tokenService = inject(TokenService);
  private fogService = inject(FogService);
  private toolService = inject(ToolService);
  private eventService = inject(VttEventService);
  private layerService = inject(LayerService);
  private route = inject(ActivatedRoute);

  // Signals para UI
  readonly activeTool = this.toolService.currentTool;
  readonly zoomLevel = this.cameraService.scale;
  readonly fogEnabled = this.fogService.enabled;
  readonly currentMap = this.mapService.map;

  // Ferramentas disponíveis
  protected tools = [
    { type: ToolType.Select, label: 'Selecionar', shortcut: '1', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>' },
    { type: ToolType.Pan, label: 'Mover', shortcut: 'Space', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
    { type: ToolType.FogReveal, label: 'Revelar', shortcut: '3', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" fill="currentColor" opacity="0.3"/><circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="1.5"/></svg>' },
    { type: ToolType.FogHide, label: 'Esconder', shortcut: '4', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" fill="currentColor"/><path d="M3 3l18 18" stroke="currentColor" stroke-width="1.5"/></svg>' },
  ];

  // Estado
  protected activeToolLabel = this.toolService.currentTool;

  // Stage Konva
  private stage!: Konva.Stage;
  private renderers: (BackgroundRenderer | GridRenderer | TokenRenderer | FogRenderer)[] = [];
  private animationFrameId: number | null = null;

  // Event state
  private isSpaceDown = false;
  private isMiddleMouseDown = false;
  private lastPointerPos = { x: 0, y: 0 };

  constructor() {
    effect(() => {
      // Monitora alterações na lista de tokens
      this.tokenService.tokenList();

      // Se o stage já estiver inicializado, renderiza
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
  }

  ngOnDestroy(): void {
    this.eventService.completeAll();
    this.renderers.forEach((r) => r.destroy());
    this.stage?.destroy();
  }

  private initStage(): void {
    const container = this.containerRef.nativeElement;
    const { width, height } = container.getBoundingClientRect();

    this.stage = new Konva.Stage({
      container,
      width,
      height,
    });

    this.cameraService.setContainerSize(width, height);
  }

  private initRenderers(): void {
    this.renderers = [
      new BackgroundRenderer(this.stage, this.mapService),
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

      // Clamp scale
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
      const pos = this.stage.getPointerPosition();
      if (!pos) return;

      // Botão do meio ou Space = pan
      if (e.evt.button === 1 || this.isSpaceDown) {
        this.cameraService.startPan();
        this.isMiddleMouseDown = true;
        this.stage.container().style.cursor = 'grabbing';
        return;
      }

      // Botão direito = contexto
      if (e.evt.button === 2) return;

      // Clique no canvas vazio = deselect
      if (e.target === this.stage) {
        this.tokenService.deselectAll();
      }
    });

    // Mouse move
    this.stage.on('mousemove', (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (this.isMiddleMouseDown || this.isSpaceDown) {
        // Nativo pan
        const dx = e.evt.movementX;
        const dy = e.evt.movementY;
        this.stage.x(this.stage.x() + dx);
        this.stage.y(this.stage.y() + dy);
        this.cameraService.updateState(this.stage.x(), this.stage.y(), this.stage.scaleX());
        this.renderAll();
      }
    });

    // Mouse up
    this.stage.on('mouseup', () => {
      if (this.isMiddleMouseDown) {
        this.cameraService.endPan();
        this.isMiddleMouseDown = false;
        this.stage.container().style.cursor = 'default';
      }
    });

    // Duplo clique removido conforme a nova regra.
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

    // Shortcuts de ferramentas
    if (this.toolService.handleShortcut(event.key)) {
      event.preventDefault();
      return;
    }

    switch (event.key) {
      case 'g':
      case 'G':
        this.toggleGrid();
        break;
      case 'f':
      case 'F':
        this.toggleFog();
        break;
      case 'Delete':
      case 'Backspace':
        this.tokenService.removeSelected();
        this.renderAll();
        break;
      case 'c':
        if (event.ctrlKey) {
          this.tokenService.copySelected();
        }
        break;
      case 'v':
        if (event.ctrlKey) {
          this.tokenService.pasteFromClipboard();
          this.renderAll();
        }
        break;
      case 'd':
        if (event.ctrlKey) {
          this.tokenService.duplicateSelected();
          this.renderAll();
        }
        break;
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

  // --- Map Controls ---
  centerMap(): void {
    const size = this.cameraService.getContainerSize();
    this.mapService.centerMap(size.width, size.height);
    this.renderAll();
  }

  fitMapToScreen(): void {
    const size = this.cameraService.getContainerSize();
    this.mapService.fitToScreen(size.width, size.height);
    this.renderAll();
  }

  resetMapScale(): void {
    this.mapService.resetScale();
    this.renderAll();
  }

  toggleMapLock(): void {
    this.mapService.toggleLock();
    this.renderAll();
  }

  // --- Upload ---

  openMapUpload(): void {
    if (this.mapFileInput) {
      this.mapFileInput.nativeElement.click();
    }
  }

  openTokenUpload(): void {
    if (this.tokenFileInput) {
      this.tokenFileInput.nativeElement.click();
    }
  }

  protected handleMapUpload(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    this.mapService.loadMapFromFile(file).then(() => {
      this.mapService.centerMap(
        this.cameraService.getContainerSize().width,
        this.cameraService.getContainerSize().height,
      );
      this.renderAll();
      target.value = '';
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
        
        // Posição central visível
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

  // --- Propriedades do Token ---
  // Foram removidas pois agora são gerenciadas pelo TokenEditorPanelComponent

  /**
   * Renderiza todas as camadas, chamando o render() de cada renderer.
   * Deve ser chamado sempre que o estado da câmera, tokens, mapa ou fog mudar.
   */
  private renderAll(): void {
    const cameraSnapshot = this.cameraService.getSnapshot();
    // Recria um CameraService compatível para os renderers que esperam o serviço completo
    for (const renderer of this.renderers) {
      renderer.render(this.cameraService);
    }
    // Também renderiza a fog, já que FogRenderer está registrado em this.renderers
  }

  // --- Load / Save ---

  private loadCampaignData(): void {
    const campaignId = this.route.snapshot.paramMap.get('id');
    if (campaignId) {
      this.fogService.setCampaignId(campaignId);
      this.fogService.loadFromStorage(campaignId);
      this.loadSavedTokens(campaignId);
    }
  }

  private loadSavedTokens(campaignId: string): void {
    const saved = localStorage.getItem(`mythmaker_vtt_tokens_${campaignId}`);
    if (saved) {
      try {
        const tokens = JSON.parse(saved);
        this.tokenService.loadFromSnapshot(tokens);
      } catch {
        // Ignora dados corrompidos
      }
    }
  }
}
