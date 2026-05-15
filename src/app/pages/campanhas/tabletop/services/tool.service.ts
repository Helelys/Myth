import { Injectable, signal, computed } from '@angular/core';
import { ToolMode, TOOL_CURSORS, TOOL_SHORTCUTS } from '../models';

/**
 * Serviço de gerenciamento de ferramentas ativas.
 * Controla qual ferramenta está selecionada e o cursor correspondente.
 */
@Injectable({ providedIn: 'root' })
export class ToolService {
  private activeTool = signal<ToolMode>('select');
  private previousTool = signal<ToolMode>('select');

  readonly currentTool = this.activeTool.asReadonly();
  readonly cursor = computed(() => TOOL_CURSORS[this.activeTool()]);

  setTool(tool: ToolMode): void {
    this.previousTool.set(this.activeTool());
    this.activeTool.set(tool);
  }

  /** Volta para a ferramenta anterior (útil após completar ação) */
  revertToPrevious(): void {
    this.activeTool.set(this.previousTool());
  }

  /** Volta para select */
  revertToSelect(): void {
    this.setTool('select');
  }

  isActive(tool: ToolMode): boolean {
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
  getSnapshot(): ToolMode {
    return this.activeTool();
  }
}
