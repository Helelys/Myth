import Konva from 'konva';
import { BaseRenderer } from './base-renderer';
import { LayerType, Token } from '../models';
import {
  CameraService,
  TokenService,
  GridService,
  VttEventService,
  FogCollisionService,
} from '../services';
import { CoordinateUtils } from '../utils';
import { TokenBarRenderer } from './token-bar.renderer';
import { TokenStatsRenderer } from './token-stats.renderer';

/**
 * Renderer de tokens com barras configuráveis.
 *
 * Renderiza cada token com:
 * - Imagem do token (ou placeholder com iniciais)
 * - Aura (se configurada)
 * - Sombra
 * - Nome acima
 * - Barras configuráveis (0-3, via TokenBarRenderer)
 * - Atributos abaixo das barras (via TokenStatsRenderer)
 * - Seleção visual (outline)
 * - Hover highlight
 *
 * Otimizações:
 * - Cache de grupos Konva
 * - Culling: só renderiza tokens na viewport
 * - Updates granulares sem recriar tudo
 */
export class TokenRenderer extends BaseRenderer {
  /** Cache de grupos Konva por token ID */
  private tokenGroups = new Map<string, Konva.Group>();
  /** ID do token sob hover */
  private hoveredTokenId: string | null = null;
  /** Cache de imagens carregadas */
  private imageCache = new Map<string, HTMLImageElement>();

  constructor(
    stage: Konva.Stage,
    private tokenService: TokenService,
    private gridService: GridService,
    private eventService: VttEventService,
    private fogCollisionService: FogCollisionService,
  ) {
    super(LayerType.Token, stage);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.layer.on('mouseenter', (e: Konva.KonvaEventObject<MouseEvent>) => {
      const group = e.target?.getParent();
      if (group?.name()?.startsWith('token-group-')) {
        const tokenId = group.name().replace('token-group-', '');
        this.hoveredTokenId = tokenId;
        this.eventService.emitHoverStart(tokenId);
        this.updateTokenVisuals(tokenId);
      }
    });

    this.layer.on('mouseleave', () => {
      if (this.hoveredTokenId) {
        const prevId = this.hoveredTokenId;
        this.hoveredTokenId = null;
        this.eventService.emitHoverEnd();
        this.updateTokenVisuals(prevId);
      }
    });
  }

  override render(camera: CameraService): void {
    const tokens = this.tokenService.getSortedTokens();
    const viewport = CoordinateUtils.getVisibleViewport(
      camera.getSnapshot(),
      camera.getContainerSize().width,
      camera.getContainerSize().height,
    );

    // Track IDs atuais para limpar tokens que sumiram
    const currentIds = new Set(tokens.map((t) => t.id));

    // Remove tokens que não existem mais
    for (const [id] of this.tokenGroups) {
      if (!currentIds.has(id)) {
        this.tokenGroups.get(id)?.destroy();
        this.tokenGroups.delete(id);
      }
    }

    // Renderiza cada token
    for (const token of tokens) {
      if (!token.visible) continue;

      // Culling (com espaço extra para barras e stats)
      const extraHeight = 80;
      if (!CoordinateUtils.isInViewport(token.x, token.y, token.width, token.height + extraHeight, viewport)) {
        const existing = this.tokenGroups.get(token.id);
        if (existing) existing.visible(false);
        continue;
      }

      const group = this.getOrCreateTokenGroup(token, camera);
      group.visible(true);
      this.updateTokenPosition(token, group, camera);
    }

    this.redraw();
  }

  private getOrCreateTokenGroup(token: Token, camera: CameraService): Konva.Group {
    let group = this.tokenGroups.get(token.id);
    if (group) return group;

    group = new Konva.Group({
      name: `token-group-${token.id}`,
      draggable: !token.locked,
    });

    // Aura (se tiver raio > 0)
    if (token.auraRadius > 0) {
      const aura = new Konva.Circle({
        radius: token.auraRadius,
        fill: token.auraColor,
        opacity: 0.2,
        name: 'aura',
      });
      group.add(aura);
    }

    // Sombra
    const shadow = new Konva.Rect({
      width: token.width,
      height: token.height,
      fill: 'black',
      opacity: 0.2,
      offsetX: 0,
      offsetY: 2,
      cornerRadius: 4,
      name: 'shadow',
      listening: false,
    });
    group.add(shadow);

    // Imagem do token
    if (token.image) {
      const imgElement = this.getOrLoadImage(token.image);
      if (imgElement) {
        // Simula object-fit: cover
        const imageRatio = imgElement.width / imgElement.height;
        const targetRatio = token.width / token.height;

        let cropWidth = imgElement.width;
        let cropHeight = imgElement.height;
        let cropX = 0;
        let cropY = 0;

        if (imageRatio > targetRatio) {
          cropWidth = imgElement.height * targetRatio;
          cropX = (imgElement.width - cropWidth) / 2;
        } else {
          cropHeight = imgElement.width / targetRatio;
          cropY = (imgElement.height - cropHeight) / 2;
        }

        const img = new Konva.Image({
          image: imgElement,
          width: token.width,
          height: token.height,
          crop: { x: cropX, y: cropY, width: cropWidth, height: cropHeight },
          name: 'token-image',
        });
        group.add(img);
      }
    } else {
      // Placeholder colorido com iniciais
      const placeholder = new Konva.Rect({
        width: token.width,
        height: token.height,
        fill: '#4a90d9',
        stroke: '#2c5f8a',
        strokeWidth: 1,
        strokeScaleEnabled: false,
        cornerRadius: 4,
        name: 'token-placeholder',
        listening: false,
      });
      group.add(placeholder);

      const initials = new Konva.Text({
        text: token.name.substring(0, 2).toUpperCase(),
        fontSize: Math.min(token.width, token.height) * 0.3,
        fill: 'white',
        align: 'center',
        verticalAlign: 'middle',
        width: token.width,
        height: token.height,
        name: 'token-initials',
        listening: false,
      });
      group.add(initials);
    }

    // Nome acima do token
    const nameText = new Konva.Text({
      text: token.name,
      fontSize: 12,
      fontFamily: 'sans-serif',
      fontStyle: 'bold',
      fill: '#ffffff',
      align: 'center',
      width: token.width + 40,
      offsetX: 20,
      y: -18,
      name: 'token-name',
      shadowColor: 'black',
      shadowBlur: 3,
      shadowOpacity: 0.8,
      shadowOffsetY: 1,
      listening: false,
    });
    group.add(nameText);

    // Barras configuráveis (HP, Mana, etc.)
    TokenBarRenderer.createBars(group, token.width, token.height, token.bars);

    // Stats abaixo das barras
    const barsHeight = TokenBarRenderer.getBarsHeight(token.bars);
    TokenStatsRenderer.createStats(group, token, barsHeight);

    // Selection outline (invisível por padrão)
    const selectionRect = new Konva.Rect({
      width: token.width + 6,
      height: token.height + 6,
      x: -3,
      y: -3,
      stroke: '#4fc3f7',
      strokeWidth: 2,
      strokeScaleEnabled: false,
      dash: [4, 4],
      visible: false,
      name: 'selection-outline',
      listening: false,
    });
    group.add(selectionRect);

    // Eventos de clique
    group.on('click', (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Ignora clique direito (tratado no contextmenu)
      if (e.evt.button === 2) return;
      e.cancelBubble = true;
      this.tokenService.selectToken(token.id, e.evt.shiftKey || e.evt.ctrlKey);
    });

    // Botão direito = Editor de Token
    group.on('contextmenu', (e: Konva.KonvaEventObject<PointerEvent>) => {
      e.evt.preventDefault();
      e.cancelBubble = true;
      this.tokenService.openEditor(token.id);
    });

    // Eventos de drag
    group.on('dragstart', (e: Konva.KonvaEventObject<DragEvent>) => {
      this.tokenService.selectToken(token.id, false);
      // Eleva o z-index temporariamente no canvas
      group.moveToTop();
      // Altera o cursor
      if (group.getStage()) {
        group.getStage()!.container().style.cursor = 'grabbing';
      }

      // Destaca outline
      const outline = group.findOne('.selection-outline') as Konva.Rect;
      if (outline) {
        outline.visible(true);
        outline.stroke('#00ff00');
      }

      // Efeito de sombra ao arrastar
      const shadow = group.findOne('.shadow') as Konva.Rect;
      if (shadow) {
        shadow.offsetY(6);
        shadow.opacity(0.4);
      }
    });

    group.on('dragmove', () => {
      // Movimento fluido puramente Konva (o grupo move seu transform local)
    });

    group.on('dragend', () => {
      // Restaura cursor
      if (group.getStage()) {
        group.getStage()!.container().style.cursor = 'default';
      }

      // Restaura outline
      const outline = group.findOne('.selection-outline') as Konva.Rect;
      if (outline) {
        outline.stroke('#4fc3f7');
        // A visibilidade será restaurada pelo updateTokenVisuals baseado no state do token
      }

      // Restaura a sombra
      const shadow = group.findOne('.shadow') as Konva.Rect;
      if (shadow) {
        shadow.offsetY(2);
        shadow.opacity(0.2);
      }

      let worldX = group.x();
      let worldY = group.y();

      if (this.gridService.snapToGrid()) {
        worldX = CoordinateUtils.snapToGrid(worldX, this.gridService.cellSize());
        worldY = CoordinateUtils.snapToGrid(worldY, this.gridService.cellSize());
      }

      // Atualiza o estado real no Angular
      this.tokenService.moveToken(token.id, worldX, worldY);

      // Reposiciona com os cálculos finais (garante snap visual instantâneo)
      this.updateTokenPosition(token, group);
    });

    this.layer.add(group);
    this.tokenGroups.set(token.id, group);

    return group;
  }

  private updateTokenPosition(
    token: Token,
    group: Konva.Group,
    camera?: CameraService,
  ): void {
    group.position({ x: token.x, y: token.y });
    group.rotation(token.rotation);
  }

  private updateTokenVisuals(tokenId: string): void {
    const group = this.tokenGroups.get(tokenId);
    const token = this.tokenService.getTokenById(tokenId);
    if (!group || !token) return;

    // Atualiza outline de seleção
    const selectionRect = group.findOne('.selection-outline') as Konva.Rect;
    if (selectionRect) {
      selectionRect.visible(token.selected);
    }

    // Atualiza barras configuráveis
    TokenBarRenderer.updateBars(group, token.width, token.height, token.bars);

    // Atualiza stats
    const barsHeight = TokenBarRenderer.getBarsHeight(token.bars);
    TokenStatsRenderer.updateStats(group, token, barsHeight);

    // Atualiza nome
    const nameText = group.findOne('.token-name') as Konva.Text;
    if (nameText) {
      nameText.text(token.name);
    }

    // Hover effect
    const img = group.findOne('.token-image') as Konva.Image;
    if (img) {
      img.opacity(this.hoveredTokenId === tokenId ? 0.85 : 1);
    }

    this.layer.batchDraw();
  }

  private getOrLoadImage(url: string): HTMLImageElement | null {
    if (this.imageCache.has(url)) {
      return this.imageCache.get(url) ?? null;
    }

    const img = new Image();
    img.onload = () => {
      this.imageCache.set(url, img);
      // Força rerender para mostrar a imagem carregada
      this.redraw();
    };
    img.src = url;

    if (img.complete && img.naturalWidth > 0) {
      this.imageCache.set(url, img);
    }

    // Cache mesmo não carregado para evitar múltiplos loads
    this.imageCache.set(url, img);
    return img.complete && img.naturalWidth > 0 ? img : null;
  }

  override clear(): void {
    super.clear();
    this.tokenGroups.clear();
  }
}
