import { Component, signal, computed, HostListener, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface SheetComponent {
  id: string;
  type: 'text' | 'number' | 'health' | 'attribute' | 'photo' | 'checkbox' | 'list' | 'skill' | 'inventory' | 'dice' | 'dropdown' | 'notes' | 'table';
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  tabId: string;
  defaultValue?: any;
  properties: any;
}

export interface SheetTab {
  id: string;
  label: string;
}

@Component({
  selector: 'app-sheet-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sheet-editor.component.html',
  styleUrl: './sheet-editor.component.scss'
})
export class SheetEditorComponent {
  @Input() campaignId: string | null = null;
  @Input() globalTemplateId: string | null = null;
  @Input() templateType: 'player' | 'monster' = 'player';

  canvasComponents = signal<SheetComponent[]>([]);
  tabs = signal<SheetTab[]>([
    { id: 'tab-1', label: 'Principal' }
  ]);
  sheetSettings = signal({
    backgroundColor: '#1c1c24',
    accentColor: '#ffffff'
  });

  updateSetting(key: string, value: string) {
    this.sheetSettings.update(prev => ({ ...prev, [key]: value }));
  }
  activeTabId = signal<string>('tab-1');
  selectedId = signal<string | null>(null);
  
  // Grid settings: 4 columns in 800px = 200px per col. 
  // Let's use a finer grid of 20px but highlight the 4-column markers.
  gridSize = 20;

  draggingId = signal<string | null>(null);
  dragStartX = 0;
  dragStartY = 0;
  initialCompX = 0;
  initialCompY = 0;

  private lastClickTime = 0;
  private lastClickId: string | null = null;

  activeTabComponents = computed(() => 
    this.canvasComponents().filter(c => c.tabId === this.activeTabId())
  );

  selectedComponent = computed(() => 
    this.canvasComponents().find(c => c.id === this.selectedId()) || null
  );

  componentTypes = [
    { type: 'attribute', label: 'Atributo', icon: '◈' },
    { type: 'number',    label: 'Número',   icon: '7' },
    { type: 'text',      label: 'Texto',    icon: 'T' },
    { type: 'health',    label: 'Barra',    icon: '▬' },
    { type: 'table',     label: 'Tabela',   icon: '田' },
    { type: 'photo',     label: 'Foto',     icon: '📷' },
    { type: 'checkbox',  label: 'Check',    icon: '☑' },
    { type: 'skill',     label: 'Perícia',  icon: '✦' },
    { type: 'dice',      label: 'Dado',     icon: '🎲' },
    { type: 'inventory', label: 'Mochila',  icon: '🎒' },
    { type: 'dropdown',  label: 'Seleção',  icon: '▼' },
    { type: 'notes',     label: 'Notas',    icon: '📝' },
  ];

  ngOnInit() {
    if (this.campaignId) {
      const saved = localStorage.getItem(`mythmaker_template_${this.templateType}_${this.campaignId}`);
      if (saved) {
        const data = JSON.parse(saved);
        this.loadTemplateData(data);
      }
    } else if (this.globalTemplateId) {
      const globalTemplates = JSON.parse(localStorage.getItem('mythmaker_global_templates') ?? '[]');
      const found = globalTemplates.find((t: any) => t.id === this.globalTemplateId);
      if (found && found.schema) {
        this.loadTemplateData(found.schema);
      }
    }
  }

  loadTemplateData(data: any) {
    this.canvasComponents.set(data.components || []);
    this.tabs.set(data.tabs || [{ id: 'tab-1', label: 'Principal' }]);
    if (data.settings) this.sheetSettings.set(data.settings);
  }

  addTab() {
    const newTab = { id: crypto.randomUUID(), label: 'Nova Aba' };
    this.tabs.update(prev => [...prev, newTab]);
    this.activeTabId.set(newTab.id);
  }

  deleteTab(id: string, event: MouseEvent) {
    event.stopPropagation();
    if (this.tabs().length <= 1) return;
    this.tabs.update(prev => prev.filter(t => t.id !== id));
    this.canvasComponents.update(prev => prev.filter(c => c.tabId !== id));
    if (this.activeTabId() === id) this.activeTabId.set(this.tabs()[0].id);
  }

  addComponent(type: any) {
    const newComp: SheetComponent = {
      id: crypto.randomUUID(),
      type: type.type,
      label: type.label,
      x: 0,
      y: 0,
      w: 200,
      h: 80,
      tabId: this.activeTabId(),
      properties: {
        color: type.type === 'health' ? '#e05a5a' : undefined,
        rows: type.type === 'table' ? 3 : undefined,
        cols: type.type === 'table' ? 3 : undefined,
        options: type.type === 'dropdown' ? 'Opção 1, Opção 2' : undefined
      }
    };

    if (type.type === 'health') { newComp.w = 400; newComp.h = 60; }
    if (type.type === 'table') { newComp.w = 600; newComp.h = 200; }
    if (type.type === 'attribute') { newComp.w = 120; newComp.h = 100; }
    if (type.type === 'photo') { newComp.w = 200; newComp.h = 200; }
    if (type.type === 'dropdown') { newComp.w = 240; newComp.h = 60; }

    this.canvasComponents.update(prev => [...prev, newComp]);
    this.selectedId.set(newComp.id);
  }

  onElementClick(event: MouseEvent, id: string) {
    event.stopPropagation();
    const now = Date.now();
    const isDoubleClick = id === this.lastClickId && (now - this.lastClickTime) < 400;
    this.lastClickTime = now;
    this.lastClickId = id;
    if (isDoubleClick) {
      this.selectedId.set(id);
    }
  }

  // Helper to get clientX/Y from mouse or touch event
  private getClientCoords(event: MouseEvent | TouchEvent): { clientX: number; clientY: number } {
    if ('touches' in event) {
      // TouchEvent - changedTouches has the final position
      const touch = event.touches[0] || event.changedTouches[0];
      return { clientX: touch.clientX, clientY: touch.clientY };
    }
    return { clientX: event.clientX, clientY: event.clientY };
  }

  startDragging(event: MouseEvent | TouchEvent, comp: SheetComponent) {
    event.preventDefault();
    event.stopPropagation();
    const { clientX, clientY } = this.getClientCoords(event);
    this.draggingId.set(comp.id);
    this.dragStartX = clientX;
    this.dragStartY = clientY;
    this.initialCompX = comp.x;
    this.initialCompY = comp.y;
  }

  @HostListener('window:mousemove', ['$event'])
  @HostListener('window:touchmove', ['$event'])
  onMouseMove(event: MouseEvent | TouchEvent) {
    const id = this.draggingId();
    if (!id) return;

    const { clientX, clientY } = this.getClientCoords(event);
    const deltaX = clientX - this.dragStartX;
    const deltaY = clientY - this.dragStartY;

    // Snap to Grid logic
    let rawX = this.initialCompX + deltaX;
    let rawY = this.initialCompY + deltaY;
    
    let snappedX = Math.round(rawX / this.gridSize) * this.gridSize;
    let snappedY = Math.round(rawY / this.gridSize) * this.gridSize;

    // Canvas Bounds: 800x1100
    const canvasW = 800;
    const canvasH = 1100;
    
    this.canvasComponents.update(comps => comps.map(c => {
      if (c.id !== id) return c;
      
      let finalX = Math.max(0, Math.min(snappedX, canvasW - c.w));
      let finalY = Math.max(0, Math.min(snappedY, canvasH - c.h));
      
      return { ...c, x: finalX, y: finalY };
    }));
  }

  @HostListener('window:mouseup')
  @HostListener('window:touchend')
  onMouseUp() {
    this.draggingId.set(null);
  }

  deleteComponent(id: string) {
    this.canvasComponents.update(comps => comps.filter(c => c.id !== id));
    if (this.selectedId() === id) this.selectedId.set(null);
  }

  saveTemplate() {
    const schema = {
      tabs: this.tabs(),
      components: this.canvasComponents(),
      settings: this.sheetSettings()
    };

    if (this.campaignId) {
      localStorage.setItem(`mythmaker_template_${this.templateType}_${this.campaignId}`, JSON.stringify(schema));
      // SheetEditor is deprecated in favor of SheetBuilder, use toast anyway
    } else if (this.globalTemplateId) {
      const globalTemplates = JSON.parse(localStorage.getItem('mythmaker_global_templates') ?? '[]');
      const index = globalTemplates.findIndex((t: any) => t.id === this.globalTemplateId);
      if (index !== -1) {
        globalTemplates[index].schema = schema;
        localStorage.setItem('mythmaker_global_templates', JSON.stringify(globalTemplates));
      }
    }
  }
}
