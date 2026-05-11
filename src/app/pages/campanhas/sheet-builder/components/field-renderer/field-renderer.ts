import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SheetField, AttributeGroupSettings, SkillTableSettings, SkillColumnDef, AttributeDef } from '../../models/sheet-types';

@Component({
  selector: 'app-field-renderer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './field-renderer.html',
  styleUrl: './field-renderer.scss'
})
export class FieldRendererComponent {
  @Input() field!: SheetField;
  @Input() editMode: boolean = false;
  @Input() allowValueEdit: boolean = true;
  @Input() accentColor: string = '#7c6fff';
  @Input() availableAttributes: AttributeDef[] = [];
  @Output() valueChange = new EventEmitter<{ id: string; value: any }>();
  @Output() deleteField = new EventEmitter<string>();
  @Output() openAttrConfig = new EventEmitter<SheetField>();
  @Output() openSkillConfig = new EventEmitter<SheetField>();

  lastDiceResult: number | null = null;

  onValueChange(value: any) {
    this.field.value = value;
    this.valueChange.emit({ id: this.field.id, value });
  }

  // ── Attribute ──
  getModifier(value: number): string {
    const mod = Math.floor((value - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  }

  // ── Resource Bar ──
  getResourceCurrent(): number {
    return this.field.settings?.current ?? 10;
  }

  setResourceCurrent(value: number) {
    if (!this.field.settings) this.field.settings = {};
    this.field.settings.current = value;
    this.onValueChange(null);
  }

  getResourceMax(): number {
    return this.field.settings?.maxValue ?? 10;
  }

  setResourceMax(value: number) {
    if (!this.field.settings) this.field.settings = {};
    this.field.settings.maxValue = value;
    this.onValueChange(null);
  }

  getResourceColor(): string {
    return this.field.settings?.color || '#e05a5a';
  }

  getResourcePercent(): number {
    const current = this.field.settings?.current ?? 10;
    const max = this.field.settings?.maxValue ?? 10;
    return Math.max(0, Math.min(100, (current / max) * 100));
  }

  // ── Select ──
  getSelectOptions(): string[] {
    return this.field.settings?.options ?? [];
  }

  // ── Dice ──
  rollDice() {
    this.lastDiceResult = Math.floor(Math.random() * 20) + 1;
  }

  // ── Repeater ──
  getRepeaterItems(): any[] {
    return this.field.items ?? [];
  }

  getRepeaterSchema(): SheetField[] {
    return this.field.itemSchema ?? [];
  }

  addRepeaterItem() {
    if (!this.field.items) this.field.items = [];
    if (!this.field.itemSchema) return;

    const newItem: any = {};
    for (const schemaField of this.field.itemSchema) {
      newItem[schemaField.id] = schemaField.value ?? '';
    }
    this.field.items = [...this.field.items, newItem];
    this.onValueChange(this.field.items);
  }

  removeRepeaterItem(index: number) {
    if (!this.field.items) return;
    this.field.items = this.field.items.filter((_: any, i: number) => i !== index);
    this.onValueChange(this.field.items);
  }

  updateRepeaterItem(index: number, fieldId: string, value: any) {
    if (!this.field.items) return;
    this.field.items = this.field.items.map((item: any, i: number) => {
      if (i !== index) return item;
      return { ...item, [fieldId]: value };
    });
    this.onValueChange(this.field.items);
  }

  // ── Inventory ──
  getInventoryItems(): any[] {
    return Array.isArray(this.field.value) ? this.field.value : [];
  }

  addInventoryItem() {
    if (!Array.isArray(this.field.value)) this.field.value = [];
    this.field.value = [
      ...this.field.value,
      { nome: '', quantidade: 1, peso: 0 }
    ];
    this.onValueChange(this.field.value);
  }

  removeInventoryItem(index: number) {
    if (!Array.isArray(this.field.value)) return;
    this.field.value = this.field.value.filter((_: any, i: number) => i !== index);
    this.onValueChange(this.field.value);
  }

  updateInventoryItem(index: number, key: string, value: any) {
    if (!Array.isArray(this.field.value)) return;
    this.field.value = this.field.value.map((item: any, i: number) => {
      if (i !== index) return item;
      return { ...item, [key]: value };
    });
    this.onValueChange(this.field.value);
  }

  // ── Table ──
  getTableHeaders(): string[] {
    return this.field.settings?.headers ?? [];
  }

  getTableData(): string[][] {
    const data = Array.isArray(this.field.value) ? this.field.value : [];
    if (data.length === 0) return this.buildEmptyTable();
    return data;
  }

  private buildEmptyTable(): string[][] {
    const rows = this.field.settings?.rows ?? 3;
    const cols = this.field.settings?.cols ?? 3;
    const table: string[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: string[] = [];
      for (let c = 0; c < cols; c++) {
        row.push('');
      }
      table.push(row);
    }
    return table;
  }

  updateTableCell(rowIdx: number, colIdx: number, value: string) {
    const data = Array.isArray(this.field.value) ? this.field.value : this.buildEmptyTable();
    if (!data[rowIdx]) data[rowIdx] = [];
    data[rowIdx][colIdx] = value;
    this.field.value = data;
    this.onValueChange(this.field.value);
  }

  // ── Image ──
  handleImageUpload(event: any) {
    const file = event.target.files[0] as File;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.onValueChange(e.target.result);
    };
    reader.readAsDataURL(file);
  }

  // ── Delete ──
  deleteClicked() {
    this.deleteField.emit(this.field.id);
  }

  // ================================================================
  // ATTRIBUTE GROUP
  // ================================================================

  getAttrGroup(): AttributeGroupSettings {
    return this.field.settings?.attributeGroup || {
      attributes: [],
      modifierMode: 'none',
      modifierFormula: { baseValue: 10, interval: 2, increment: 1 },
      alignment: 'center'
    };
  }

  getAttrGroupAlignment(): string {
    const align = this.getAttrGroup().alignment;
    switch (align) {
      case 'left': return 'flex-start';
      case 'right': return 'flex-end';
      default: return 'center';
    }
  }

  updateAttrValue(attrId: string, newValue: number) {
    const group = this.getAttrGroup();
    group.attributes = group.attributes.map((a: AttributeDef) =>
      a.id === attrId ? { ...a, value: newValue } : a
    );
    if (!this.field.settings) this.field.settings = {};
    this.field.settings.attributeGroup = { ...group };
    this.onValueChange(null);
  }

  getAttrModifier(attr: AttributeDef): string {
    const group = this.getAttrGroup();
    if (group.modifierMode === 'none') return '';
    if (group.modifierMode === 'dnd') {
      const mod = Math.floor((attr.value - 10) / 2);
      return mod >= 0 ? `+${mod}` : `${mod}`;
    }
    if (group.modifierMode === 'custom') {
      const formula = group.modifierFormula;
      const diff = attr.value - formula.baseValue;
      const mod = Math.floor(diff / formula.interval) * formula.increment;
      return mod >= 0 ? `+${mod}` : `${mod}`;
    }
    return '';
  }

  isAttrModPositive(attr: AttributeDef): boolean {
    if (this.getAttrGroup().modifierMode === 'none') return true;
    const mod = this.getAttrModifier(attr);
    return !mod.startsWith('-');
  }

  openAttributeConfigModal() {
    this.openAttrConfig.emit(this.field);
  }

  // ================================================================
  // SKILL TABLE
  // ================================================================

  getSkillTable(): SkillTableSettings {
    return this.field.settings?.skillTable || { columns: [] };
  }

  getSkillColumns(): SkillColumnDef[] {
    return this.getSkillTable().columns;
  }

  getSkillRows(): any[] {
    return Array.isArray(this.field.value) ? this.field.value : [];
  }

  addSkillRow() {
    const columns = this.getSkillColumns();
    const row: any = {};
    for (const col of columns) {
      if (col.type === 'checkbox') row[col.id] = false;
      else if (col.type === 'number') row[col.id] = 0;
      else if (col.type === 'related_attr') row[col.id] = '';
      else row[col.id] = '';
    }
    this.field.value = [...this.getSkillRows(), row];
    this.onValueChange(this.field.value);
  }

  removeSkillRow(index: number) {
    const rows = this.getSkillRows();
    this.field.value = rows.filter((_: any, i: number) => i !== index);
    this.onValueChange(this.field.value);
  }

  updateSkillRow(index: number, colId: string, value: any) {
    const rows = this.getSkillRows().map((row: any, i: number) =>
      i === index ? { ...row, [colId]: value } : row
    );
    this.field.value = rows;
    this.onValueChange(this.field.value);
  }

  getAttrNameById(attrId: string): string {
    const found = this.availableAttributes.find((a: AttributeDef) => a.id === attrId);
    return found ? found.name : attrId;
  }

  getAttrModValue(attrId: string): number {
    const found = this.availableAttributes.find((a: AttributeDef) => a.id === attrId);
    if (!found) return 0;
    const group = this.getAttrGroup();
    if (group.modifierMode === 'dnd') {
      return Math.floor((found.value - 10) / 2);
    }
    if (group.modifierMode === 'custom') {
      const formula = group.modifierFormula;
      const diff = found.value - formula.baseValue;
      return Math.floor(diff / formula.interval) * formula.increment;
    }
    return 0;
  }

  getSkillColumnWidth(col: SkillColumnDef): string {
    switch (col.type) {
      case 'checkbox': return '40px';
      case 'number': return '60px';
      default: return col.width ? `${col.width}px` : 'auto';
    }
  }

  getSkillRowValue(row: any, col: SkillColumnDef): any {
    if (col.type === 'total') {
      return this.calcSkillTotal(row);
    }
    if (col.type === 'modifier') {
      const relId = col.relatedAttributeId;
      return relId ? this.getAttrModValue(relId) : 0;
    }
    return row[col.id];
  }

  calcSkillTotal(row: any): number {
    let total = 0;
    const columns = this.getSkillColumns();
    for (const col of columns) {
      if (col.type === 'total') continue;
      if (col.type === 'number' || col.type === 'bonus') {
        total += Number(row[col.id] || 0);
      }
      if (col.type === 'modifier' && col.relatedAttributeId) {
        total += this.getAttrModValue(col.relatedAttributeId);
      }
      if (col.type === 'related_attr' && row[col.id]) {
        total += this.getAttrModValue(row[col.id]);
      }
      if (col.type === 'checkbox') {
        // Checkbox adds 1 or some bonus
        total += row[col.id] ? 1 : 0;
      }
    }
    return total;
  }

  openSkillConfigModal() {
    this.openSkillConfig.emit(this.field);
  }
}
