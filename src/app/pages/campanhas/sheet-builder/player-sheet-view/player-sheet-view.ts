import { Component, Input, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FieldRendererComponent } from '../components/field-renderer/field-renderer';
import { CharacterSheet, SheetTab, SheetSection, SheetField } from '../models/sheet-types';

@Component({
  selector: 'app-player-sheet-view',
  standalone: true,
  imports: [CommonModule, FormsModule, FieldRendererComponent],
  templateUrl: './player-sheet-view.html',
  styleUrl: './player-sheet-view.scss'
})
export class PlayerSheetViewComponent implements OnInit {
  @Input() campaignId: string | null = null;
  @Input() templateType: 'player' | 'monster' = 'player';

  template = signal<CharacterSheet | null>(null);
  activeTabId = signal<string>('');

  activeTab = computed(() =>
    this.template()?.tabs.find(t => t.id === this.activeTabId()) || null
  );

  activeSections = computed(() =>
    this.activeTab()?.sections || []
  );

  ngOnInit() {
    this.loadTemplate();
  }

  loadTemplate() {
    if (!this.campaignId) return;
    const key = `mythmaker_sheet2_${this.templateType}_${this.campaignId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const data = JSON.parse(saved) as CharacterSheet;
        this.template.set(data);
        this.activeTabId.set(data.tabs[0]?.id || '');
      } catch { /* ignore */ }
    }
  }

  onValueChange(event: { id: string; value: any }) {
    // Value changes are local; nothing special needed for view-mode
  }

  getGridColumns(columns: number): string {
    return `repeat(${Math.min(columns, 12)}, 1fr)`;
  }

  getFieldWidth(width?: number): string {
    if (!width) return '1fr';
    return `span ${Math.min(width, 12)}`;
  }

  getBorderRadius(value: string): string {
    switch (value) {
      case 'none': return '0px';
      case 'sm': return '4px';
      case 'md': return '8px';
      case 'lg': return '16px';
      default: return '8px';
    }
  }

  getGap(value: string): string {
    switch (value) {
      case 'sm': return '6px';
      case 'md': return '12px';
      case 'lg': return '20px';
      default: return '12px';
    }
  }

  trackById(_index: number, item: any): string {
    return item.id;
  }
}
