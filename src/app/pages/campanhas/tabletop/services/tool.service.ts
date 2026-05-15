import { Injectable, signal, computed } from '@angular/core';
import { ToolType, TOOL_CURSORS, TOOL_SHORTCUTS } from '../models';

/**
 * Serviço de gerenciamento de ferramentas ativas.
 * Controla qual ferramenta está selecionada e o cursor correspondente.
 */
@Injectable({ providedIn: 'root' })
export class ToolService {
  private activeTool = signal<ToolType>(ToolType.Select);

  readonly currentTool = this.activeTool.asReadonly();
  readonly cursor = computed(() => TOOL_CURSORS[this.activeTool()]);

  setTool(tool: ToolType): void {
    this.activeTool.set(tool);
  }

  isActive(tool: ToolType): boolean {
    return this.activeTool() === tool;
  }

  /** Processa shortcuts de teclado para troca de ferramenta */
  handleShortcut(key: string): boolean {
    const tool = TOOL_SHORTCUTS[key];
    if (tool) {
      this.setTool(tool);
      return true;
    }
    return false;
  }

  /** Obtém o tipo de ferramenta atual */
  getSnapshot(): ToolType {
    return this.activeTool();
  }
}
