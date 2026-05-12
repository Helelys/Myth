import { Component, Input, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FieldRendererComponent } from '../components/field-renderer/field-renderer';
import { CharacterSheet, SheetTab, SheetSection, SheetField, AttributeDef } from '../models/sheet-types';

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

  availableAttributes = computed<AttributeDef[]>(() => {
    const tmpl = this.template();
    if (!tmpl) return [];
    const attrs: AttributeDef[] = [];
    for (const tab of tmpl.tabs) {
      for (const section of tab.sections) {
        for (const field of section.fields) {
          if (field.type === 'attribute_group' && field.settings?.attributeGroup) {
            for (const a of field.settings.attributeGroup.attributes) {
              if (!attrs.find(x => x.id === a.id)) {
                attrs.push(a);
              }
            }
          }
        }
      }
    }
    return attrs;
  });

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
    const tmpl = this.template();
    if (!tmpl || !this.campaignId) return;

    // Update the field value within the template
    const updated: CharacterSheet = {
      ...tmpl,
      tabs: tmpl.tabs.map((t: SheetTab) => ({
        ...t,
        sections: t.sections.map((sec: SheetSection) => ({
          ...sec,
          fields: sec.fields.map((f: SheetField) =>
            f.id === event.id ? { ...f, value: event.value } : f
          )
        }))
      }))
    };
    this.template.set(updated);

    // Persist to localStorage
    const key = `mythmaker_sheet2_${this.templateType}_${this.campaignId}`;
    localStorage.setItem(key, JSON.stringify(updated));
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
