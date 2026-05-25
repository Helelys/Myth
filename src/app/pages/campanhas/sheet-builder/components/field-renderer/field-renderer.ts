import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SheetField, AttributeGroupSettings, SkillTableSettings, SkillColumnDef, AttributeDef, InventorySettings, InventoryColumnDef, AttackSettings, AttackColumnDef } from '../../models/sheet-types';

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
  @Output() openInventoryConfig = new EventEmitter<SheetField>();
  @Output() openAttackConfig = new EventEmitter<SheetField>();

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

  // ── Power Accordion ──
  expandedPowers: Set<number> = new Set();

  togglePower(index: number) {
    if (this.expandedPowers.has(index)) {
      this.expandedPowers.delete(index);
    } else {
      this.expandedPowers.add(index);
    }
  }

  isPowerExpanded(index: number): boolean {
    return this.expandedPowers.has(index);
  }

  getRepeaterItems(): any[] {
    return this.field.items ?? [];
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

  addRepeaterItem() {
    if (!this.field.items) this.field.items = [];
    if (!this.field.itemSchema) return;

    const newItem: any = { _uid: crypto.randomUUID() };
    for (const schemaField of this.field.itemSchema) {
      newItem[schemaField.id] = schemaField.value ?? '';
    }
    this.field.items = [...this.field.items, newItem];
    this.onValueChange(this.field.items);
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

  // ================================================================
  // INVENTORY (Custom Columns + Accordion + Description)
  // ================================================================

  expandedInventory: Set<number> = new Set();

  getInventorySettings(): InventorySettings {
    return this.field.settings?.inventory || { columns: [] };
  }

  getInventoryColumns(): InventoryColumnDef[] {
    return this.getInventorySettings().columns;
  }

  getInventoryItems(): any[] {
    return Array.isArray(this.field.value) ? this.field.value : [];
  }

  toggleInventoryItem(index: number) {
    if (this.expandedInventory.has(index)) {
      this.expandedInventory.delete(index);
    } else {
      this.expandedInventory.add(index);
    }
  }

  isInventoryItemExpanded(index: number): boolean {
    return this.expandedInventory.has(index);
  }

  addInventoryItem() {
    const columns = this.getInventoryColumns();
    const item: any = { _uid: crypto.randomUUID(), _desc: '' };
    for (const col of columns) {
      if (col.type === 'checkbox') item[col.id] = false;
      else if (col.type === 'number') item[col.id] = 0;
      else item[col.id] = '';
    }
    this.field.value = [...this.getInventoryItems(), item];
    this.onValueChange(this.field.value);
  }

  removeInventoryItem(index: number) {
    const items = this.getInventoryItems();
    this.field.value = items.filter((_: any, i: number) => i !== index);
    this.onValueChange(this.field.value);
  }

  updateInventoryItem(index: number, colId: string, value: any) {
    const items = this.getInventoryItems().map((item: any, i: number) =>
      i === index ? { ...item, [colId]: value } : item
    );
    this.field.value = items;
    this.onValueChange(this.field.value);
  }

  updateInventoryItemDescription(index: number, desc: string) {
    const items = this.getInventoryItems().map((item: any, i: number) =>
      i === index ? { ...item, _desc: desc } : item
    );
    this.field.value = items;
    this.onValueChange(this.field.value);
  }

  openInventoryConfigModal() {
    this.openInventoryConfig.emit(this.field);
  }

  // ================================================================
  // ATTACK (Custom Columns + Accordion with Dice Rolling + Bonus)
  // ================================================================

  expandedAttacks: Set<number> = new Set();

  getAttackSettings(): AttackSettings {
    return this.field.settings?.attack || { columns: [] };
  }

  getAttackColumns(): AttackColumnDef[] {
    return this.getAttackSettings().columns;
  }

  getAttackItems(): any[] {
    return Array.isArray(this.field.value) ? this.field.value : [];
  }

  toggleAttack(index: number) {
    if (this.expandedAttacks.has(index)) {
      this.expandedAttacks.delete(index);
    } else {
      this.expandedAttacks.add(index);
    }
  }

  isAttackExpanded(index: number): boolean {
    return this.expandedAttacks.has(index);
  }

  addAttackItem() {
    const columns = this.getAttackColumns();
    const item: any = { _uid: crypto.randomUUID() };
    for (const col of columns) {
      if (col.type === 'dice') item[col.id] = '1d' + (col.diceSides || 6);
      else if (col.type === 'bonus') item[col.id] = 0;
      else item[col.id] = '';
    }
    this.field.value = [...this.getAttackItems(), item];
    this.onValueChange(this.field.value);
  }

  removeAttackItem(index: number) {
    const items = this.getAttackItems();
    this.field.value = items.filter((_: any, i: number) => i !== index);
    this.onValueChange(this.field.value);
  }

  updateAttackItem(index: number, colId: string, value: any) {
    const items = this.getAttackItems().map((item: any, i: number) =>
      i === index ? { ...item, [colId]: value } : item
    );
    this.field.value = items;
    this.onValueChange(this.field.value);
  }

  /**
   * Rolls the dice notation string (e.g. "1d6", "2d8") and returns total.
   */
  rollAttackDice(diceNotation: string): number {
    const match = diceNotation.match(/^(\d+)d(\d+)$/i);
    if (!match) return 0;
    const count = parseInt(match[1], 10);
    const sides = parseInt(match[2], 10);
    let total = 0;
    for (let i = 0; i < count; i++) {
      total += Math.floor(Math.random() * sides) + 1;
    }
    return total;
  }

  /**
   * Rolls damage for an attack item: rolls each dice column + sums bonus columns.
   * Returns an object with { breakdown: string, total: number }.
   */
  rollAttackDamage(index: number): { breakdown: string; total: number } | null {
    const item = this.getAttackItems()[index];
    if (!item) return null;

    const columns = this.getAttackColumns();
    let diceParts: string[] = [];
    let rollTotal = 0;

    for (const col of columns) {
      const val = item[col.id];

      if (col.type === 'dice' && val) {
        const diceStr = typeof val === 'string' ? val : `1d${col.diceSides || 6}`;
        const roll = this.rollAttackDice(diceStr);
        diceParts.push(`${diceStr}=${roll}`);
        rollTotal += roll;
      }

      if (col.type === 'bonus') {
        const bonus = Number(val) || 0;
        if (bonus !== 0) {
          diceParts.push((bonus > 0 ? '+' : '') + bonus);
          rollTotal += bonus;
        }
      }
    }

    return {
      breakdown: diceParts.join(' '),
      total: rollTotal
    };
  }

  attackRollResults: Map<number, { breakdown: string; total: number } | null> = new Map();

  performAttackRoll(index: number) {
    const result = this.rollAttackDamage(index);
    this.attackRollResults.set(index, result);
    // Force change detection by re-assigning the map
    this.attackRollResults = new Map(this.attackRollResults);
  }

  openAttackConfigModal() {
    this.openAttackConfig.emit(this.field);
  }

}


