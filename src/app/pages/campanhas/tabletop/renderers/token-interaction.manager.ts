import Konva from 'konva';
import { Token } from '../models';
import { TokenService } from '../services';

/**
 * Gerencia interações de tokens:
 * - Drag suave com snap
 * - Seleção visual
 * - Hover e outline
 * - Elevação de z-index durante drag
 */
export class TokenInteractionManager {
  private static readonly SELECTION_COLOR = '#4fc3f7';
  private static readonly HOVER_OPACITY = 0.85;
  private static readonly DRAG_SHADOW_OFFSET = 6;
  private static readonly DRAG_SHADOW_OPACITY = 0.3;

  private tokenService: TokenService;

  constructor(tokenService: TokenService) {
    this.tokenService = tokenService;
  }

  /**
   * Configura eventos de interação em um grupo de token.
   */
  setupInteractions(
    group: Konva.Group,
    token: Token,
    onDragMove?: (worldX: number, worldY: number) => void,
    onDragEnd?: () => void,
  ): void {
    // Click para selecionar
    group.on('click', (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      this.tokenService.selectToken(token.id, e.evt.shiftKey || e.evt.ctrlKey);
    });

    // Double click
    group.on('dblclick', (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      // Will be handled by the component for opening editor
    });

    // Context menu (right click)
    group.on('contextmenu', (e: Konva.KonvaEventObject<PointerEvent>) => {
      e.cancelBubble = true;
      // Will dispatch an event for showing context menu
      this.tokenService.selectToken(token.id, false);
      group.dispatchEvent(new CustomEvent('token-contextmenu', {
        detail: { tokenId: token.id },
        bubbles: true,
      }));
    });

    // Drag start
    group.on('dragstart', () => {
      group.fire('token-dragstart');
    });

    group.on('dragmove', () => {
      if (onDragMove) {
        onDragMove(group.x(), group.y());
      }
    });

    group.on('dragend', () => {
      if (onDragEnd) {
        onDragEnd();
      }
    });
  }

  /**
   * Atualiza visualmente seleção, hover e sombra de drag.
   */
  updateVisuals(
    group: Konva.Group,
    token: Token,
    isHovered: boolean,
  ): void {
    // Selection outline
    const selectionRect = group.findOne('.selection-outline') as Konva.Rect;
    if (selectionRect) {
      selectionRect.visible(token.selected);
    }

    // Shadow (drag vs normal)
    const shadow = group.findOne('.shadow') as Konva.Rect;
    if (shadow) {
      if (token.selected) {
        shadow.offsetY(4);
        shadow.opacity(0.3);
      } else {
        shadow.offsetY(2);
        shadow.opacity(0.15);
      }
    }

    // Image opacity (hover)
    const img = group.findOne('.token-image') as Konva.Image;
    if (img) {
      img.opacity(isHovered ? TokenInteractionManager.HOVER_OPACITY : 1);
    }
  }

  /**
   * Cria o selection outline para um token group.
   */
  static createSelectionOutline(group: Konva.Group, token: Token): Konva.Rect {
    const rect = new Konva.Rect({
      width: token.width + 8,
      height: token.height + 8,
      x: -4,
      y: -4,
      stroke: TokenInteractionManager.SELECTION_COLOR,
      strokeWidth: 2,
      dash: [4, 4],
      visible: false,
      name: 'selection-outline',
      listening: false,
    });
    group.add(rect);
    return rect;
  }

  /**
   * Cria a sombra padrão do token.
   */
  static createShadow(group: Konva.Group, token: Token): Konva.Rect {
    const shadow = new Konva.Rect({
      width: token.width,
      height: token.height,
      fill: 'black',
      opacity: 0.15,
      offsetX: 0,
      offsetY: 2,
      cornerRadius: 4,
      name: 'shadow',
      listening: false,
    });
    group.add(shadow);
    return shadow;
  }
}
