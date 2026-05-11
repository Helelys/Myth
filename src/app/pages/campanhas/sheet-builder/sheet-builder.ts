import { Component, signal, computed, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FieldRendererComponent } from './components/field-renderer/field-renderer';
import {
  CharacterSheet, SheetTab, SheetSection, SheetField, FieldType,
  FIELD_PRESETS, FieldPreset, SheetSettings,
  AttributeGroupSettings, AttributeDef, SkillTableSettings, SkillColumnDef
} from './models/sheet-types';

@Component({
  selector: 'app-sheet-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, FieldRendererComponent],
  templateUrl: './sheet-builder.html',
  styleUrl: './sheet-builder.scss'
})
export class SheetBuilderComponent implements OnInit {
  @Input() campaignId: string | null = null;
  @Input() templateType: 'player' | 'monster' = 'player';
  @Input() editMode: boolean = true;

  // ── Core State ──
  sheet = signal<CharacterSheet>(this.createEmptySheet());

  // ── UI State ──
  activeTabId = signal<string>('');
  showAddSectionModal = signal(false);
  showAddFieldModal = signal(false);
  showFieldSettingsModal = signal(false);
  showSectionSettingsModal = signal(false);
  editingSection = signal<SheetSection | null>(null);
  editingField = signal<SheetField | null>(null);

  // Attribute Group Config Modal
  showAttrConfigModal = signal(false);
  editingAttrField = signal<SheetField | null>(null);
  attrConfigName = '';
  attrConfigModMode: 'none' | 'dnd' | 'custom' = 'dnd';
  attrConfigBase = 10;
  attrConfigInterval = 2;
  attrConfigIncrement = 1;
  attrConfigAlign: 'center' | 'left' | 'right' = 'center';
  attrConfigCount = 4;
  attrConfigNames: string[] = [];
  attrConfigValues: number[] = [];

  // Skill Table Config Modal
  showSkillConfigModal = signal(false);
  editingSkillField = signal<SheetField | null>(null);
  skillColumns: { id: string; label: string; type: string }[] = [];

  // New section form
  newSectionTitle = '';
  newSectionLayout: 'grid' | 'stack' | 'cards' = 'grid';
  newSectionColumns = 4;

  // New field form
  newFieldSectionId = '';

  // Field presets for options editing
  fieldSettingsOptions = '';

  fieldPresets = FIELD_PRESETS;

  // ── Computed ──
  activeTab = computed<SheetTab | null>(() =>
    this.sheet().tabs.find((t: SheetTab) => t.id === this.activeTabId()) || null
  );

  activeSections = computed<SheetSection[]>(() =>
    this.activeTab()?.sections || []
  );

  availableAttributes = computed<AttributeDef[]>(() => {
    const attrs: AttributeDef[] = [];
    for (const tab of this.sheet().tabs) {
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

  createEmptySheet(): CharacterSheet {
    const tabId = crypto.randomUUID();
    return {
      id: crypto.randomUUID(),
      name: 'Nova Ficha',
      templateType: this.templateType as any,
      tabs: [{
        id: tabId,
        name: 'Principal',
        sections: [{
          id: crypto.randomUUID(),
          title: 'Identidade',
          layout: 'grid',
          columns: 4,
          fields: [
            { id: crypto.randomUUID(), type: 'text', label: 'Nome', value: '', width: 6 },
            { id: crypto.randomUUID(), type: 'text', label: 'Classe', value: '', width: 3 },
            { id: crypto.randomUUID(), type: 'number', label: 'Nível', value: 1, width: 3 }
          ]
        }, {
          id: crypto.randomUUID(),
          title: 'Atributos',
          layout: 'stack',
          columns: 1,
          fields: [
            { id: crypto.randomUUID(), type: 'attribute_group', label: 'Atributos', value: null, width: 12, settings: {
              attributeGroup: {
                attributes: [
                  { id: crypto.randomUUID(), name: 'Força', value: 10 },
                  { id: crypto.randomUUID(), name: 'Agilidade', value: 10 },
                  { id: crypto.randomUUID(), name: 'Intelecto', value: 10 },
                  { id: crypto.randomUUID(), name: 'Presença', value: 10 }
                ],
                modifierMode: 'dnd',
                modifierFormula: { baseValue: 10, interval: 2, increment: 1 },
                alignment: 'center'
              }
            } }
          ]
        }, {
          id: crypto.randomUUID(),
          title: 'Perícias',
          layout: 'stack',
          columns: 1,
          fields: [
            { id: crypto.randomUUID(), type: 'skill_table', label: 'Perícias', value: [], width: 12, settings: {
              skillTable: {
                columns: [
                  { id: crypto.randomUUID(), label: 'Perícia', type: 'text' },
                  { id: crypto.randomUUID(), label: 'Treinado', type: 'checkbox' },
                  { id: crypto.randomUUID(), label: 'Bônus', type: 'number' },
                  { id: crypto.randomUUID(), label: 'Total', type: 'total' }
                ]
              }
            } }
          ]
        }, {
          id: crypto.randomUUID(),
          title: 'Recursos',
          layout: 'grid',
          columns: 2,
          fields: [
            { id: crypto.randomUUID(), type: 'resource', label: 'Vida', value: null, width: 6, settings: { current: 20, maxValue: 20, color: '#e05a5a', showNumbers: true } as any },
            { id: crypto.randomUUID(), type: 'resource', label: 'Mana', value: null, width: 6, settings: { current: 10, maxValue: 10, color: '#5aace0', showNumbers: true } as any },
          ]
        }, {
          id: crypto.randomUUID(),
          title: 'Inventário',
          layout: 'stack',
          columns: 1,
          fields: [
            { id: crypto.randomUUID(), type: 'inventory', label: 'Itens', value: [] as any, width: 12 }
          ]
        }]
      }],
      settings: {
        backgroundColor: '#1c1c24',
        accentColor: '#7c6fff',
        fontColor: '#f0f0f5',
        borderRadius: 'md' as any,
        gap: 'md' as any
      }
    };
  }

  // ── Sheet Name ──
  updateSheetName(name: string) {
    this.sheet.update((s: CharacterSheet) => ({ ...s, name }));
  }

  // ── Tab Management ──
  addTab() {
    const newTab: SheetTab = {
      id: crypto.randomUUID(),
      name: 'Nova Aba',
      sections: []
    };
    this.sheet.update((s: CharacterSheet) => ({ ...s, tabs: [...s.tabs, newTab] }));
    this.activeTabId.set(newTab.id);
  }

  updateTabName(tabId: string, name: string) {
    this.sheet.update((s: CharacterSheet) => ({
      ...s,
      tabs: s.tabs.map((t: SheetTab) => t.id === tabId ? { ...t, name } : t)
    }));
  }

  deleteTab(tabId: string) {
    if (this.sheet().tabs.length <= 1) return;
    this.sheet.update((s: CharacterSheet) => ({ ...s, tabs: s.tabs.filter((t: SheetTab) => t.id !== tabId) }));
    if (this.activeTabId() === tabId) {
      this.activeTabId.set(this.sheet().tabs[0].id);
    }
  }

  // ── Section Management ──
  openAddSectionModal() {
    this.newSectionTitle = '';
    this.newSectionLayout = 'grid';
    this.newSectionColumns = 4;
    this.showAddSectionModal.set(true);
  }

  confirmAddSection() {
    const newSection: SheetSection = {
      id: crypto.randomUUID(),
      title: this.newSectionTitle || 'Nova Seção',
      layout: this.newSectionLayout,
      columns: this.newSectionColumns,
      fields: []
    };
    this.sheet.update((s: CharacterSheet) => ({
      ...s,
      tabs: s.tabs.map((t: SheetTab) => {
        if (t.id !== this.activeTabId()) return t;
        return { ...t, sections: [...t.sections, newSection] };
      })
    }));
    this.showAddSectionModal.set(false);
  }

  deleteSection(sectionId: string) {
    this.sheet.update((s: CharacterSheet) => ({
      ...s,
      tabs: s.tabs.map((t: SheetTab) => {
        if (t.id !== this.activeTabId()) return t;
        return { ...t, sections: t.sections.filter((sec: SheetSection) => sec.id !== sectionId) };
      })
    }));
  }

  openSectionSettings(section: SheetSection) {
    this.editingSection.set({ ...section });
    this.showSectionSettingsModal.set(true);
  }

  saveSectionSettings() {
    const edited = this.editingSection();
    if (!edited) return;
    this.sheet.update((s: CharacterSheet) => ({
      ...s,
      tabs: s.tabs.map((t: SheetTab) => {
        if (t.id !== this.activeTabId()) return t;
        return {
          ...t,
          sections: t.sections.map((sec: SheetSection) =>
            sec.id === edited.id ? edited : sec
          )
        };
      })
    }));
    this.showSectionSettingsModal.set(false);
  }

  moveSection(sectionId: string, direction: -1 | 1) {
    this.sheet.update((s: CharacterSheet) => ({
      ...s,
      tabs: s.tabs.map((t: SheetTab) => {
        if (t.id !== this.activeTabId()) return t;
        const sections = [...t.sections];
        const idx = sections.findIndex((sec: SheetSection) => sec.id === sectionId);
        if (idx === -1) return t;
        const newIdx = idx + direction;
        if (newIdx < 0 || newIdx >= sections.length) return t;
        const temp = sections[idx];
        sections[idx] = sections[newIdx];
        sections[newIdx] = temp;
        return { ...t, sections };
      })
    }));
  }

  // ── Field Management ──
  openAddFieldModal(sectionId: string) {
    this.newFieldSectionId = sectionId;
    this.showAddFieldModal.set(true);
  }

  addField(preset: FieldPreset) {
    const sectionId = this.newFieldSectionId;

    if (preset.createFields) {
      const fields = preset.createFields();
      this.sheet.update((s: CharacterSheet) => ({
        ...s,
        tabs: s.tabs.map((t: SheetTab) => {
          if (t.id !== this.activeTabId()) return t;
          return {
            ...t,
            sections: t.sections.map((sec: SheetSection) => {
              if (sec.id !== sectionId) return sec;
              return { ...sec, fields: [...sec.fields, ...fields] };
            })
          };
        })
      }));
    } else {
      const newField: SheetField = {
        id: crypto.randomUUID(),
        type: preset.type,
        label: preset.label,
        value: this.getDefaultValue(preset.type),
        width: preset.defaultWidth || 12,
        settings: preset.defaultSettings ? JSON.parse(JSON.stringify(preset.defaultSettings)) : undefined
      };

      if (preset.type === 'repeater') {
        newField.itemSchema = [
          { id: 'nome', type: 'text' as FieldType, label: 'Nome', value: '' },
          { id: 'descricao', type: 'textarea' as FieldType, label: 'Descrição', value: '' }
        ];
      }

      if (preset.type === 'power') {
        newField.itemSchema = [
          { id: 'nome', type: 'text' as FieldType, label: 'Nome', value: '' },
          { id: 'custo', type: 'number' as FieldType, label: 'Custo', value: 0 },
          { id: 'descricao', type: 'textarea' as FieldType, label: 'Descrição', value: '' }
        ];
      }

      this.sheet.update((s: CharacterSheet) => ({
        ...s,
        tabs: s.tabs.map((t: SheetTab) => {
          if (t.id !== this.activeTabId()) return t;
          return {
            ...t,
            sections: t.sections.map((sec: SheetSection) => {
              if (sec.id !== sectionId) return sec;
              return { ...sec, fields: [...sec.fields, newField] };
            })
          };
        })
      }));
    }
    this.showAddFieldModal.set(false);
  }

  deleteField(sectionId: string, fieldId: string) {
    this.sheet.update((s: CharacterSheet) => ({
      ...s,
      tabs: s.tabs.map((t: SheetTab) => {
        if (t.id !== this.activeTabId()) return t;
        return {
          ...t,
          sections: t.sections.map((sec: SheetSection) => {
            if (sec.id !== sectionId) return sec;
            return { ...sec, fields: sec.fields.filter((f: SheetField) => f.id !== fieldId) };
          })
        };
      })
    }));
  }

  openFieldSettings(field: SheetField) {
    this.editingField.set({ ...field });
    this.fieldSettingsOptions = (field.settings?.options ?? []).join('\n');
    this.showFieldSettingsModal.set(true);
  }

  saveFieldSettings() {
    const edited = this.editingField();
    if (!edited) return;
    if (edited.type === 'select') {
      const opts = this.fieldSettingsOptions.split('\n').map((o: string) => o.trim()).filter((o: string) => o.length > 0);
      edited.settings = { ...edited.settings!, options: opts };
    }
    this.sheet.update((s: CharacterSheet) => ({
      ...s,
      tabs: s.tabs.map((t: SheetTab) => {
        if (t.id !== this.activeTabId()) return t;
        return {
          ...t,
          sections: t.sections.map((sec: SheetSection) => ({
            ...sec,
            fields: sec.fields.map((f: SheetField) =>
              f.id === edited.id ? edited : f
            )
          }))
        };
      })
    }));
    this.showFieldSettingsModal.set(false);
  }

  onValueChange(event: { id: string; value: any }) {
    this.sheet.update((s: CharacterSheet) => ({
      ...s,
      tabs: s.tabs.map((t: SheetTab) => ({
        ...t,
        sections: t.sections.map((sec: SheetSection) => ({
          ...sec,
          fields: sec.fields.map((f: SheetField) =>
            f.id === event.id ? { ...f, value: event.value } : f
          )
        }))
      }))
    }));
  }

  moveField(sectionId: string, fieldId: string, direction: -1 | 1) {
    this.sheet.update((s: CharacterSheet) => ({
      ...s,
      tabs: s.tabs.map((t: SheetTab) => {
        if (t.id !== this.activeTabId()) return t;
        return {
          ...t,
          sections: t.sections.map((sec: SheetSection) => {
            if (sec.id !== sectionId) return sec;
            const fields = [...sec.fields];
            const idx = fields.findIndex((f: SheetField) => f.id === fieldId);
            if (idx === -1) return sec;
            const newIdx = idx + direction;
            if (newIdx < 0 || newIdx >= fields.length) return sec;
            const temp = fields[idx];
            fields[idx] = fields[newIdx];
            fields[newIdx] = temp;
            return { ...sec, fields };
          })
        };
      })
    }));
  }

  // ── Attribute Group Config Modal ──
  openAttrConfig(field: SheetField) {
    const group = field.settings?.attributeGroup;
    if (!group) return;
    this.editingAttrField.set(field);
    this.attrConfigName = field.label;
    this.attrConfigModMode = group.modifierMode;
    this.attrConfigAlign = group.alignment;
    this.attrConfigBase = group.modifierFormula.baseValue;
    this.attrConfigInterval = group.modifierFormula.interval;
    this.attrConfigIncrement = group.modifierFormula.increment;
    this.attrConfigCount = group.attributes.length;
    this.attrConfigNames = group.attributes.map(a => a.name);
    this.attrConfigValues = group.attributes.map(a => a.value);
    this.showAttrConfigModal.set(true);
  }

  saveAttrConfig() {
    const field = this.editingAttrField();
    if (!field) return;
    if (!field.settings) field.settings = {};

    const attributes: AttributeDef[] = [];
    for (let i = 0; i < this.attrConfigCount; i++) {
      const existing = field.settings.attributeGroup?.attributes[i];
      attributes.push({
        id: existing?.id || crypto.randomUUID(),
        name: this.attrConfigNames[i] || `Atributo ${i + 1}`,
        value: this.attrConfigValues[i] ?? 10
      });
    }

    field.settings.attributeGroup = {
      attributes,
      modifierMode: this.attrConfigModMode,
      modifierFormula: {
        baseValue: this.attrConfigBase,
        interval: this.attrConfigInterval,
        increment: this.attrConfigIncrement
      },
      alignment: this.attrConfigAlign
    };

    field.label = this.attrConfigName;

    this.sheet.update((s: CharacterSheet) => ({
      ...s,
      tabs: s.tabs.map((t: SheetTab) => ({
        ...t,
        sections: t.sections.map((sec: SheetSection) => ({
          ...sec,
          fields: sec.fields.map((f: SheetField) =>
            f.id === field.id ? { ...f, label: field.label, settings: { ...field.settings } } : f
          )
        }))
      }))
    }));

    this.showAttrConfigModal.set(false);
  }

  updateAttrName(index: number, name: string) {
    if (index >= 0 && index < this.attrConfigNames.length) {
      this.attrConfigNames[index] = name;
    }
  }

  updateAttrValue(index: number, value: number) {
    if (index >= 0 && index < this.attrConfigValues.length) {
      this.attrConfigValues[index] = value;
    }
  }

  getAttrCountRange(): number[] {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12];
  }

  onAttrCountChange() {
    while (this.attrConfigNames.length < this.attrConfigCount) {
      this.attrConfigNames.push(`Atributo ${this.attrConfigNames.length + 1}`);
    }
    while (this.attrConfigValues.length < this.attrConfigCount) {
      this.attrConfigValues.push(10);
    }
    this.attrConfigNames = this.attrConfigNames.slice(0, this.attrConfigCount);
    this.attrConfigValues = this.attrConfigValues.slice(0, this.attrConfigCount);
  }

  // ── Skill Table Config Modal ──
  openSkillConfig(field: SheetField) {
    const skill = field.settings?.skillTable;
    if (!skill) return;
    this.editingSkillField.set(field);

    this.skillColumns = skill.columns.map(c => ({
      id: c.id,
      label: c.label,
      type: c.type
    }));

    this.showSkillConfigModal.set(true);
  }

  saveSkillConfig() {
    const field = this.editingSkillField();
    if (!field) return;
    if (!field.settings) field.settings = {};

    const columns: SkillColumnDef[] = this.skillColumns.map(c => ({
      id: c.id,
      label: c.label,
      type: c.type as any
    }));

    field.settings.skillTable = { columns };

    if (Array.isArray(field.value)) {
      const newRows = field.value.map((row: any) => {
        const newRow: any = {};
        for (const col of columns) {
          if (col.type === 'checkbox') newRow[col.id] = row[col.id] ?? false;
          else if (col.type === 'number' || col.type === 'bonus') newRow[col.id] = row[col.id] ?? 0;
          else if (col.type === 'total') newRow[col.id] = 0;
          else newRow[col.id] = row[col.id] ?? '';
        }
        return newRow;
      });
      field.value = newRows;
    }

    this.sheet.update((s: CharacterSheet) => ({
      ...s,
      tabs: s.tabs.map((t: SheetTab) => ({
        ...t,
        sections: t.sections.map((sec: SheetSection) => ({
          ...sec,
          fields: sec.fields.map((f: SheetField) =>
            f.id === field.id ? { ...f, settings: { ...field.settings }, value: field.value } : f
          )
        }))
      }))
    }));

    this.showSkillConfigModal.set(false);
  }

  addSkillColumn() {
    this.skillColumns = [
      ...this.skillColumns,
      { id: crypto.randomUUID(), label: 'Nova Coluna', type: 'text' }
    ];
  }

  removeSkillColumn(index: number) {
    this.skillColumns = this.skillColumns.filter((_, i) => i !== index);
  }

  moveSkillColumn(index: number, direction: -1 | 1) {
    const newIdx = index + direction;
    if (newIdx < 0 || newIdx >= this.skillColumns.length) return;
    const cols = [...this.skillColumns];
    const temp = cols[index];
    cols[index] = cols[newIdx];
    cols[newIdx] = temp;
    this.skillColumns = cols;
  }

  // ── Settings ──
  updateSetting(key: keyof SheetSettings, value: any) {
    this.sheet.update((s: CharacterSheet) => ({
      ...s,
      settings: { ...s.settings, [key]: value }
    }));
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

  // ── Persistence ──
  saveTemplate() {
    const data = this.sheet();
    const key = `mythmaker_sheet2_${this.templateType}_${this.campaignId}`;
    localStorage.setItem(key, JSON.stringify(data));
    alert('Ficha salva com sucesso!');
  }

  loadTemplate() {
    if (!this.campaignId) {
      this.activeTabId.set(this.sheet().tabs[0]?.id || '');
      return;
    }
    const key = `mythmaker_sheet2_${this.templateType}_${this.campaignId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const data = JSON.parse(saved) as CharacterSheet;
        this.sheet.set(data);
      } catch { /* use default */ }
    }
    this.activeTabId.set(this.sheet().tabs[0]?.id || '');
  }

  // ── Helpers ──
  getDefaultValue(type: FieldType): any {
    switch (type) {
      case 'number': return 0;
      case 'attribute': return 10;
      case 'checkbox': return false;
      case 'inventory': return [];
      default: return '';
    }
  }

  getSectionFields(section: SheetSection): SheetField[] {
    return section.fields;
  }

  getGridColumns(columns: number): string {
    return `repeat(${Math.min(columns, 12)}, 1fr)`;
  }

  getFieldWidth(width?: number): string {
    if (!width) return '1fr';
    return `span ${Math.min(width, 12)}`;
  }

  trackById(_index: number, item: any): string {
    return item.id;
  }

  // ── Export / Import ──
  exportJson() {
    const blob = new Blob([JSON.stringify(this.sheet(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ficha-${this.sheet().name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importJson(event: any) {
    const file = event.target.files[0] as File;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const data = JSON.parse(e.target.result as string) as CharacterSheet;
        this.sheet.set(data);
        this.activeTabId.set(data.tabs[0]?.id || '');
        alert('Ficha importada com sucesso!');
      } catch {
        alert('Erro ao importar. Verifique o formato do arquivo.');
      }
    };
    reader.readAsText(file);
  }
}
