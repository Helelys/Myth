import { Component, signal, computed, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type ConfigFieldType = 'name' | 'attribute' | 'skill' | 'spell' | 'selection' | 'text' | 'inventory';

export interface NpcAttributeDef {
  id: string;
  name: string;
  startValue: number;
  minValue: number;
  maxValue: number;
  useDndModifier: boolean;
}

export interface NpcSkillDef {
  id: string;
  name: string;
}

export interface NpcSpellDef {
  id: string;
  name: string;
  description: string;
}

export interface NpcSelectionField {
  id: string;
  fieldName: string;
  optionsText: string;
}

export interface InventoryItemDef {
  id: string;
  name: string;
  variations: string[];
  variationsText: string;
}

export interface NpcGeneratorConfig {
  attributes: NpcAttributeDef[];
  skills: NpcSkillDef[];
  spells: NpcSpellDef[];
  selections: NpcSelectionField[];
  textFields: string[];
  inventory: InventoryItemDef[];
  trainedSkillsCount: number;
  trainedSpellsCount: number;
  /** Ordem em que os campos foram adicionados – {type, id} */
  entryOrder: { type: ConfigFieldType; id: string }[];
}

export interface ConfigEntry {
  id: string;
  type: ConfigFieldType;
  attr?: NpcAttributeDef;
  skill?: NpcSkillDef;
  selection?: NpcSelectionField;
  inventory?: InventoryItemDef;
  textIndex?: number;
}

// ─────────────────────────────────────────────
// Generated NPC types
// ─────────────────────────────────────────────

export interface GeneratedNpcAttribute {
  id: string;
  name: string;
  value: number;
  modifier?: number;
}

export interface GeneratedNpcSkill {
  id: string;
  name: string;
  isTrained: boolean;
}

export interface GeneratedNpcSelection {
  id: string;
  fieldName: string;
  chosen: string;
}

export interface GeneratedNpcText {
  id: string;
  label: string;
  value: string;
}

export interface GeneratedNpcItem {
  id: string;
  name: string;
  description: string;
}

export interface GeneratedNpcSpell {
  id: string;
  name: string;
  description: string;
}

export interface NpcFolder {
  id: string;
  name: string;
  createdAt: number;
}

export interface GeneratedNpc {
  id: string;
  name: string;
  createdAt: number;
  folderId?: string;
  attributes: GeneratedNpcAttribute[];
  skills: GeneratedNpcSkill[];
  spells: GeneratedNpcSpell[];
  selections: GeneratedNpcSelection[];
  texts: GeneratedNpcText[];
  items: GeneratedNpcItem[];
}

// ─────────────────────────────────────────────
// Name Banks
// ─────────────────────────────────────────────

const FIRST_NAMES: string[] = [
  'Aldric', 'Brenna', 'Calix', 'Dara', 'Elvor', 'Faela', 'Gareth', 'Hilda', 'Ivar', 'Jessa',
  'Kael', 'Liora', 'Maren', 'Nolan', 'Oryn', 'Petra', 'Quill', 'Rowena', 'Soren', 'Talia',
  'Ulrik', 'Vessa', 'Wren', 'Xander', 'Yara', 'Zephyr', 'Aelith', 'Borin', 'Cyra', 'Davan',
  'Eirik', 'Fenra', 'Galen', 'Hara', 'Inara', 'Jorik', 'Kira', 'Lyren', 'Morven', 'Naira',
  'Oswin', 'Priya', 'Quinn', 'Rael', 'Sivra', 'Torin', 'Ursa', 'Vaela', 'Wulfric', 'Xylia'
];

const LAST_NAMES: string[] = [
  'Ashvale', 'Blackthorn', 'Coldwater', 'Dawnmere', 'Emberveil', 'Frostwood', 'Greymantle', 'Harrowfield',
  'Ironhold', 'Jadestone', 'Kingsbane', 'Lightfall', 'Moonwhisper', 'Nighthollow', 'Oakenshield', 'Pinerock',
  'Queensmere', 'Ravenscroft', 'Stormveil', 'Thornwall', 'Umberhaven', 'Voidwalker', 'Wintermere', 'Xenrock',
  'Yellowcrest', 'Zephyrdale', 'Aldenmoor', 'Brightforge', 'Cinderfall', 'Duskvale', 'Edgewater', 'Fireholm',
  'Grimstone', 'Hollowfen', 'Ironpeak', 'Jadecroft', 'Knightfall', 'Lakeshore', 'Mistholm', 'Nightbane',
  'Oldstone', 'Pinehurst', 'Quicksilver', 'Riverdale', 'Shadowmere', 'Thistledown', 'Underhill', 'Vexmoor',
  'Windcrest', 'Yarrowdale'
];

const STORAGE_NPCS = 'mythmaker_npcs';
const STORAGE_SLOT_NAMES = 'mythmaker_npc_slot_names';
const STORAGE_CONFIG_SLOTS = 'mythmaker_npc_config_slots';
const STORAGE_CONFIG_OLD = 'mythmaker_npc_config';
const STORAGE_FOLDERS = 'mythmaker_npc_folders';
const STORAGE_SELECTED_SLOT = 'mythmaker_npc_selected_slot';

const NUM_SLOTS = 5;

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

@Component({
  selector: 'app-gerador-npcs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gerador-npcs.component.html',
  styleUrl: './gerador-npcs.component.scss'
})
export class GeradorNpcsComponent implements OnInit {
  activeTab = signal<'config' | 'npcs'>('config');

  // ── Telas ──
  activeScreen = signal<'config' | 'npcs' | 'attr-batch'>('config');

  // ── Config Slots (1 a 5) ──
  selectedSlotIndex = signal<number>(0);
  configSlots = signal<(NpcGeneratorConfig | null)[]>(Array(NUM_SLOTS).fill(null));
  showSaveSlotsModal = signal(false);
  showSlotSelectorModal = signal(false);

  /** Nomes personalizados das fichas (armazenados separadamente no localStorage) */
  slotNames = signal<string[]>(Array(NUM_SLOTS).fill(''));

  /** A config atualmente ativa (atalho para o slot selecionado) */
  config = computed<NpcGeneratorConfig>(() => {
    const slot = this.configSlots()[this.selectedSlotIndex()];
    return slot ?? this.blankConfig();
  });

  /** Signal separado para o trained count – evita re-render completo da config ao clicar +/- */
  trainedSkillsCount = signal<number>(2);
  trainedSpellsCount = signal<number>(2);
  newFieldType: ConfigFieldType = 'text';
  addFieldDropdownOpen = signal(false);

  configEntries = computed<ConfigEntry[]>(() => {
    const cfg = this.config();
    const order = cfg.entryOrder ?? [];
    const entries: ConfigEntry[] = [];
    const seen = new Set<string>();

    for (const item of order) {
      const key = item.type === 'attribute' || item.type === 'skill' || item.type === 'spell' ? item.type : item.id;
      if (seen.has(key)) continue;
      seen.add(key);

      switch (item.type) {
        case 'attribute': {
          const attrs = cfg.attributes ?? [];
          if (attrs.length > 0) {
            entries.push({ id: '__attrs__', type: 'attribute', attr: attrs[0] });
          }
          break;
        }
        case 'skill': {
          const skills = cfg.skills ?? [];
          if (skills.length > 0) {
            entries.push({ id: '__skills__', type: 'skill', skill: skills[0] });
          }
          break;
        }
        case 'spell': {
          const spells = cfg.spells ?? [];
          if (spells.length > 0) {
            entries.push({ id: '__spells__', type: 'spell' });
          }
          break;
        }
        case 'selection': {
          const sel = (cfg.selections ?? []).find(s => s.id === item.id);
          if (sel) entries.push({ id: sel.id, type: 'selection', selection: sel });
          break;
        }
        case 'text': {
          if ((cfg.textFields ?? []).includes(item.id)) {
            entries.push({ id: item.id, type: 'text' });
          }
          break;
        }
        case 'inventory': {
          const inv = (cfg.inventory ?? []).find(i => i.id === item.id);
          if (inv) entries.push({ id: inv.id, type: 'inventory', inventory: inv });
          break;
        }
      }
    }

    return entries;
  });

  // ── Generated NPCs & Folders ──
  npcs = signal<GeneratedNpc[]>([]);
  folders = signal<NpcFolder[]>([]);
  selectedFolderId = signal<string | null>(null);

  // ── UI State ──
  notificationMessage = signal<string | null>(null);
  private notifTimeout: any = null;
  showConfirmModal = signal(false);
  confirmMessage = '';
  private confirmAction: (() => void) | null = null;

  showFolderModal = signal(false);
  newFolderName = '';

  viewingNpc = signal<GeneratedNpc | null>(null);
  expandedSelectionId = signal<string | null>(null);

  // ── Attribute Batch Screen ──
  attrBatchList = signal<{ name: string; startValue: number; minValue: number; maxValue: number; useDndModifier: boolean }[]>([]);

  ngOnInit() {
    this.loadSlotNames();
    this.loadConfigSlots();
    this.loadFolders();
    this.loadNpcs();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const dropdown = target.closest('.add-field-dropdown-wrapper');
    if (!dropdown) {
      this.addFieldDropdownOpen.set(false);
    }
  }

  // ─── Slot Helpers ───

  slotLabel(index: number): string {
    const custom = this.slotNames()[index];
    return custom && custom.trim() ? custom.trim() : `Ficha ${index + 1}`;
  }

  slotHasConfig(index: number): boolean {
    return this.configSlots()[index] !== null;
  }

  /** Atualiza o nome de um slot e salva no localStorage */
  onSlotNameChange(index: number, value: string) {
    this.slotNames()[index] = value;
    localStorage.setItem(STORAGE_SLOT_NAMES, JSON.stringify(this.slotNames()));
  }

  /** Salva os nomes personalizados no localStorage */
  private persistSlotNames() {
    localStorage.setItem(STORAGE_SLOT_NAMES, JSON.stringify(this.slotNames()));
  }

  /** Carrega os nomes personalizados do localStorage */
  private loadSlotNames() {
    const saved = localStorage.getItem(STORAGE_SLOT_NAMES);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === NUM_SLOTS) {
          this.slotNames.set(parsed);
        }
      } catch { /* fallback */ }
    }
  }

  selectSlot(index: number) {
    // Salva o slot anterior antes de trocar
    this.saveCurrentSlot();
    this.selectedSlotIndex.set(index);
    // Sincroniza os counts
    const cfg = this.configSlots()[index];
    if (cfg) {
      this.trainedSkillsCount.set(cfg.trainedSkillsCount ?? 2);
      this.trainedSpellsCount.set(cfg.trainedSpellsCount ?? 2);
    } else {
      this.trainedSkillsCount.set(2);
      this.trainedSpellsCount.set(2);
    }
    localStorage.setItem(STORAGE_SELECTED_SLOT, String(index));
  }

  private saveCurrentSlot() {
    const idx = this.selectedSlotIndex();
    const current = this.config();
    if (current.attributes.length === 0 && current.skills.length === 0 &&
      current.spells.length === 0 && current.selections.length === 0 &&
      current.textFields.length === 0 && current.inventory.length === 0) {
      return; // não salva se estiver vazio
    }
    const saved: NpcGeneratorConfig = {
      ...current,
      trainedSkillsCount: this.trainedSkillsCount(),
      trainedSpellsCount: this.trainedSpellsCount()
    };
    this.configSlots.update(slots => {
      const copy = [...slots];
      copy[idx] = saved;
      return copy;
    });
  }

  // ─── Defaults ───

  blankConfig(): NpcGeneratorConfig {
    return {
      attributes: [],
      skills: [],
      spells: [],
      selections: [],
      textFields: [],
      inventory: [],
      trainedSkillsCount: 2,
      trainedSpellsCount: 2,
      entryOrder: []
    };
  }

  // ─── Slot Persistence ───

  /** Nome temporário sendo digitado no modal de salvar */
  saveSlotNameInput = signal('');

  openSaveSlotsModal() {
    // Preenche o input com o nome atual da ficha
    this.saveSlotNameInput.set(this.slotNames()[this.selectedSlotIndex()] || '');
    this.showSaveSlotsModal.set(true);
  }

  closeSaveSlotsModal() {
    this.showSaveSlotsModal.set(false);
  }

  confirmSaveSlot() {
    const idx = this.selectedSlotIndex();
    const name = this.saveSlotNameInput().trim();

    // Salva o nome personalizado
    this.slotNames()[idx] = name;
    localStorage.setItem(STORAGE_SLOT_NAMES, JSON.stringify(this.slotNames()));

    // Salva a config
    const cfg = this.config();
    cfg.trainedSkillsCount = this.trainedSkillsCount();
    cfg.trainedSpellsCount = this.trainedSpellsCount();
    this.configSlots.update(slots => {
      const copy = [...slots];
      copy[idx] = { ...cfg };
      return copy;
    });
    this.persistConfigSlots();

    this.showSaveSlotsModal.set(false);
    this.showToast(`Configuração salva em "${this.slotLabel(idx)}"!`);
  }

  private persistConfigSlots() {
    localStorage.setItem(STORAGE_CONFIG_SLOTS, JSON.stringify(this.configSlots()));
  }

  loadConfigSlots() {
    // Tenta carregar do novo formato (slots)
    const saved = localStorage.getItem(STORAGE_CONFIG_SLOTS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as (NpcGeneratorConfig | null)[];
        if (Array.isArray(parsed) && parsed.length === NUM_SLOTS) {
          this.configSlots.set(parsed);
          // Restaura o slot selecionado
          const storedSlot = localStorage.getItem(STORAGE_SELECTED_SLOT);
          const idx = storedSlot ? parseInt(storedSlot, 10) : 0;
          if (idx >= 0 && idx < NUM_SLOTS) {
            this.selectedSlotIndex.set(idx);
          }
          const active = parsed[idx];
          if (active) {
            this.trainedSkillsCount.set(active.trainedSkillsCount ?? 2);
            this.trainedSpellsCount.set(active.trainedSpellsCount ?? 2);
          }
          return;
        }
      } catch { /* fallback */ }
    }

    // Fallback: migra do formato antigo
    const old = localStorage.getItem(STORAGE_CONFIG_OLD);
    if (old) {
      try {
        const parsed = JSON.parse(old) as NpcGeneratorConfig;
        const slots: (NpcGeneratorConfig | null)[] = Array(NUM_SLOTS).fill(null);
        slots[0] = parsed;
        this.configSlots.set(slots);
        this.selectedSlotIndex.set(0);
        this.trainedSkillsCount.set(parsed.trainedSkillsCount ?? 2);
        this.trainedSpellsCount.set(parsed.trainedSpellsCount ?? 2);
        this.persistConfigSlots();
        localStorage.removeItem(STORAGE_CONFIG_OLD);
        return;
      } catch { /* fallback */ }
    }

    // Nada salvo — configuração padrão no slot 0
    const slots: (NpcGeneratorConfig | null)[] = Array(NUM_SLOTS).fill(null);
    this.configSlots.set(slots);
    this.selectedSlotIndex.set(0);
    this.trainedSkillsCount.set(2);
    this.trainedSpellsCount.set(2);
  }

  // ─── Persistence (NPCs & Folders) ───

  loadNpcs() {
    const saved = localStorage.getItem(STORAGE_NPCS);
    const list: GeneratedNpc[] = saved ? JSON.parse(saved) : [];
    for (const npc of list) {
      if (!npc.items) npc.items = [];
    }
    this.npcs.set(list);
  }

  saveNpcs(list: GeneratedNpc[]) {
    localStorage.setItem(STORAGE_NPCS, JSON.stringify(list));
    this.npcs.set(list);
  }

  loadFolders() {
    const saved = localStorage.getItem(STORAGE_FOLDERS);
    this.folders.set(saved ? JSON.parse(saved) : []);
  }

  saveFolders(list: NpcFolder[]) {
    localStorage.setItem(STORAGE_FOLDERS, JSON.stringify(list));
    this.folders.set(list);
  }

  // ─── Unified Field Management ───

  fieldTypeLabel(type: ConfigFieldType): string {
    const labels: Record<ConfigFieldType, string> = {
      name: 'Nome / Sobrenome',
      attribute: 'Atributo',
      skill: 'Perícia',
      spell: 'Magia',
      selection: 'Campo de Seleção',
      text: 'Campo de Texto',
      inventory: 'Item de Inventário'
    };
    return labels[type];
  }

  fieldTypeIcon(type: ConfigFieldType): string {
    const icons: Record<ConfigFieldType, string> = {
      name: '\u{1F524}',
      attribute: '\u25C8',
      skill: '\u{1F4CB}',
      spell: '\u2728',
      selection: '\u25BC',
      text: '\u{1F4DD}',
      inventory: '\u{1F392}'
    };
    return icons[type];
  }

  private pushEntryOrder(type: ConfigFieldType, id: string) {
    const current = this.config();
    const order = [...(current.entryOrder ?? [])];
    order.push({ type, id });
    this.configSlots.update(slots => {
      const copy = [...slots];
      const slot = copy[this.selectedSlotIndex()];
      if (slot) {
        copy[this.selectedSlotIndex()] = { ...slot, entryOrder: order };
      }
      return copy;
    });
  }

  addField(type: ConfigFieldType) {
    try {
      this.addFieldDropdownOpen.set(false);
      const current = this.config();

      switch (type) {
        case 'attribute': {
          const newId = crypto.randomUUID();
          this.updateConfig({
            ...current,
            attributes: [
              ...current.attributes,
              { id: newId, name: '', startValue: 10, minValue: 3, maxValue: 18, useDndModifier: false }
            ]
          });
          this.pushEntryOrder(type, newId);
          return;
        }
        case 'skill': {
          const newId = crypto.randomUUID();
          this.updateConfig({
            ...current,
            skills: [...current.skills, { id: newId, name: '' }]
          });
          this.pushEntryOrder(type, newId);
          break;
        }
        case 'selection': {
          const newId = crypto.randomUUID();
          this.updateConfig({
            ...current,
            selections: [...current.selections, { id: newId, fieldName: 'Novo Campo', optionsText: '' }]
          });
          this.pushEntryOrder(type, newId);
          break;
        }
        case 'text': {
          const label = 'Novo Campo';
          this.updateConfig({
            ...current,
            textFields: [...current.textFields, label]
          });
          this.pushEntryOrder(type, label);
          break;
        }
        case 'spell': {
          const newId = crypto.randomUUID();
          this.updateConfig({
            ...current,
            spells: [...current.spells, { id: newId, name: '', description: '' }]
          });
          this.pushEntryOrder(type, newId);
          break;
        }
        case 'inventory': {
          const newId = crypto.randomUUID();
          const vars = ['variação 1', 'variação 2'];
          this.updateConfig({
            ...current,
            inventory: [...current.inventory, {
              id: newId,
              name: 'Novo Item',
              variations: vars,
              variationsText: vars.join('\n')
            }]
          });
          this.pushEntryOrder(type, newId);
          break;
        }
      }
    } catch (err) {
      console.error(`[addField] ERRO ao adicionar campo "${type}":`, err);
    }
  }

  /** Atualiza a config dentro do slot ativo */
  private updateConfig(newConfig: NpcGeneratorConfig) {
    this.configSlots.update(slots => {
      const copy = [...slots];
      copy[this.selectedSlotIndex()] = newConfig;
      return copy;
    });
  }

  removeEntry(e: ConfigEntry) {
    const current = this.config();
    switch (e.type) {
      case 'attribute':
        this.updateConfig({ ...current, attributes: [] });
        break;
      case 'skill':
        this.updateConfig({ ...current, skills: [] });
        break;
      case 'selection':
        this.updateConfig({ ...current, selections: current.selections.filter(s => s.id !== e.id) });
        break;
      case 'text':
        this.updateConfig({ ...current, textFields: current.textFields.filter(t => t !== e.id) });
        break;
      case 'spell':
        this.updateConfig({ ...current, spells: [] });
        break;
      case 'inventory':
        this.updateConfig({ ...current, inventory: current.inventory.filter(i => i.id !== e.id) });
        break;
    }
  }

  nameFieldEnabled = signal(true);

  toggleNameField() {
    this.nameFieldEnabled.update(v => !v);
  }

  toggleExpand(id: string) {
    this.expandedSelectionId.update(current => current === id ? null : id);
  }

  trackByIndex(index: number): number {
    return index;
  }

  // ─── Slot Selector (escolher ficha para gerar) ───

  openSlotSelector() {
    this.showSlotSelectorModal.set(true);
  }

  closeSlotSelector() {
    this.showSlotSelectorModal.set(false);
  }

  generateFromSlot(index: number) {
    this.showSlotSelectorModal.set(false);
    const slot = this.configSlots()[index];
    const cfg: NpcGeneratorConfig = slot ?? this.blankConfig();

    if (cfg.attributes.length === 0 && cfg.skills.length === 0 &&
      cfg.selections.length === 0 && cfg.textFields.length === 0 &&
      cfg.inventory.length === 0) {
      this.showToast(`A ${this.slotLabel(index)} está vazia! Adicione campos primeiro.`);
      return;
    }

    let folderId: string | undefined = undefined;
    if (this.selectedFolderId() && this.selectedFolderId() !== 'unassigned') {
      folderId = this.selectedFolderId() as string;
    }

    const npc: GeneratedNpc = {
      id: crypto.randomUUID(),
      name: this.nameFieldEnabled() ? this.randomName() : '',
      createdAt: Date.now(),
      folderId,
      attributes: this.generateAttributes(cfg),
      skills: this.generateSkills(cfg, cfg.trainedSkillsCount ?? 2),
      spells: this.generateSpells(cfg, cfg.trainedSpellsCount ?? 2),
      selections: this.generateSelections(cfg),
      texts: cfg.textFields.map(label => ({ id: crypto.randomUUID(), label, value: '' })),
      items: this.generateItems(cfg)
    };

    const updated = [npc, ...this.npcs()];
    this.saveNpcs(updated);
    this.activeTab.set('npcs');
    this.showToast(`NPC "${npc.name}" gerado!`);
  }

  // ─── Generation (usa a ficha ativa) ───

  generateNpc() {
    const cfg = this.config();

    if (cfg.attributes.length === 0 && cfg.skills.length === 0 &&
      cfg.selections.length === 0 && cfg.textFields.length === 0 &&
      cfg.inventory.length === 0) {
      this.showToast('Adicione pelo menos um campo na ficha antes de gerar!');
      return;
    }

    let folderId: string | undefined = undefined;
    if (this.selectedFolderId() && this.selectedFolderId() !== 'unassigned') {
      folderId = this.selectedFolderId() as string;
    }

    const npc: GeneratedNpc = {
      id: crypto.randomUUID(),
      name: this.nameFieldEnabled() ? this.randomName() : '',
      createdAt: Date.now(),
      folderId,
      attributes: this.generateAttributes(cfg),
      skills: this.generateSkills(cfg, this.trainedSkillsCount()),
      spells: this.generateSpells(cfg, this.config().trainedSpellsCount ?? 2),
      selections: this.generateSelections(cfg),
      texts: cfg.textFields.map(label => ({ id: crypto.randomUUID(), label, value: '' })),
      items: this.generateItems(cfg)
    };

    const updated = [npc, ...this.npcs()];
    this.saveNpcs(updated);
    this.activeTab.set('npcs');
    this.showToast(`NPC "${npc.name}" gerado!`);
  }

  private randomName(): string {
    const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    return `${first} ${last}`;
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private dndModifier(value: number): number {
    return Math.floor((value - 10) / 2);
  }

  private generateAttributes(cfg: NpcGeneratorConfig): GeneratedNpcAttribute[] {
    return cfg.attributes.map(attr => {
      const value = this.randomInt(attr.minValue, attr.maxValue);
      const result: GeneratedNpcAttribute = { id: crypto.randomUUID(), name: attr.name, value };
      if (attr.useDndModifier) {
        result.modifier = this.dndModifier(value);
      }
      return result;
    });
  }

  private generateSkills(cfg: NpcGeneratorConfig, trainedCount: number): GeneratedNpcSkill[] {
    const skills: GeneratedNpcSkill[] = cfg.skills.map(s => ({ id: crypto.randomUUID(), name: s.name, isTrained: false }));
    if (skills.length === 0) return [];

    const count = Math.min(trainedCount, skills.length);
    const indices = [...Array(skills.length).keys()];
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    for (let k = 0; k < count; k++) {
      skills[indices[k]].isTrained = true;
    }
    return skills;
  }

  private generateSelections(cfg: NpcGeneratorConfig): GeneratedNpcSelection[] {
    return cfg.selections.map(field => {
      const opts = field.optionsText
        .split(/[\n,]/)
        .map(o => o.trim())
        .filter(o => o.length > 0);
      const chosen = opts.length > 0
        ? opts[Math.floor(Math.random() * opts.length)]
        : '\u2014';
      return { id: crypto.randomUUID(), fieldName: field.fieldName, chosen };
    });
  }

  private generateSpells(cfg: NpcGeneratorConfig, count: number): GeneratedNpcSpell[] {
    const spells: GeneratedNpcSpell[] = cfg.spells.map(s => ({ id: crypto.randomUUID(), name: s.name, description: s.description }));
    if (spells.length === 0) return [];
    const c = Math.min(count, spells.length);
    const indices = [...Array(spells.length).keys()];
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices.slice(0, c).map(k => spells[k]);
  }

  private generateItems(cfg: NpcGeneratorConfig): GeneratedNpcItem[] {
    return cfg.inventory.map(item => {
      const vars = item.variationsText
        .split('\n')
        .map(v => v.trim())
        .filter(v => v.length > 0);
      item.variations = vars;
      const desc = vars.length > 0
        ? vars[Math.floor(Math.random() * vars.length)]
        : '';
      return { id: crypto.randomUUID(), name: item.name, description: desc };
    });
  }

  // ─── NPC Field Removal (detail modal) ───

  removeNpcAttribute(id: string) {
    const npc = this.viewingNpc();
    if (!npc) return;
    npc.attributes = npc.attributes.filter(a => a.id !== id);
    this.autoSaveNpc();
  }

  removeNpcSkill(id: string) {
    const npc = this.viewingNpc();
    if (!npc) return;
    npc.skills = npc.skills.filter(s => s.id !== id);
    this.autoSaveNpc();
  }

  removeNpcSelection(id: string) {
    const npc = this.viewingNpc();
    if (!npc) return;
    npc.selections = npc.selections.filter(s => s.id !== id);
    this.autoSaveNpc();
  }

  removeNpcItem(id: string) {
    const npc = this.viewingNpc();
    if (!npc) return;
    npc.items = npc.items.filter(i => i.id !== id);
    this.autoSaveNpc();
  }

  removeNpcText(id: string) {
    const npc = this.viewingNpc();
    if (!npc) return;
    npc.texts = npc.texts.filter(t => t.id !== id);
    this.autoSaveNpc();
  }

  // ─── NPC Actions ───

  viewNpc(npc: GeneratedNpc) {
    this.viewingNpc.set(npc);
  }

  closeNpcView() {
    this.viewingNpc.set(null);
  }

  deleteNpc(id: string) {
    this.askConfirm('Excluir este NPC?', () => {
      const updated = this.npcs().filter(n => n.id !== id);
      this.saveNpcs(updated);
      if (this.viewingNpc()?.id === id) this.viewingNpc.set(null);
      this.showToast('NPC excluído.');
    });
  }

  exportNpc(npc: GeneratedNpc) {
    const blob = new Blob([JSON.stringify(npc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `npc-${npc.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  resetConfig() {
    this.askConfirm('Restaurar configuração padrão? Isso apagará todas as configurações do slot atual.', () => {
      this.configSlots.update(slots => {
        const copy = [...slots];
        copy[this.selectedSlotIndex()] = null;
        return copy;
      });
      this.trainedSkillsCount.set(2);
      this.trainedSpellsCount.set(2);
      this.persistConfigSlots();
      this.showToast(`Configuração da ${this.slotLabel(this.selectedSlotIndex())} restaurada.`);
    });
  }

  // ─── Folder Operations ───

  openFolderModal() {
    this.newFolderName = '';
    this.showFolderModal.set(true);
  }

  closeFolderModal() {
    this.showFolderModal.set(false);
    this.newFolderName = '';
  }

  confirmCreateFolder() {
    if (!this.newFolderName || !this.newFolderName.trim()) {
      this.closeFolderModal();
      return;
    }
    const newFolder: NpcFolder = {
      id: crypto.randomUUID(),
      name: this.newFolderName.trim(),
      createdAt: Date.now()
    };
    const updated = [...this.folders(), newFolder];
    this.saveFolders(updated);
    this.selectedFolderId.set(newFolder.id);
    this.closeFolderModal();
    this.showToast(`Pasta "${newFolder.name}" criada!`);
  }

  deleteFolder(id: string) {
    this.askConfirm('Excluir esta pasta? Os NPCs dentro dela ficarão "Sem pasta".', () => {
      const updated = this.folders().filter(f => f.id !== id);
      this.saveFolders(updated);
      let npcsChanged = false;
      const updatedNpcs = this.npcs().map(npc => {
        if (npc.folderId === id) {
          npcsChanged = true;
          return { ...npc, folderId: undefined };
        }
        return npc;
      });
      if (npcsChanged) this.saveNpcs(updatedNpcs);
      if (this.selectedFolderId() === id) this.selectedFolderId.set(null);
      this.showToast('Pasta excluída.');
    });
  }

  selectFolder(id: string | null) {
    this.selectedFolderId.set(id);
  }

  getFilteredNpcs(): GeneratedNpc[] {
    const selId = this.selectedFolderId();
    if (selId === null) return this.npcs();
    if (selId === 'unassigned') return this.npcs().filter(n => !n.folderId);
    return this.npcs().filter(n => n.folderId === selId);
  }

  getFolderCount(id: string | null): number {
    if (id === null) return this.npcs().length;
    if (id === 'unassigned') return this.npcs().filter(n => !n.folderId).length;
    return this.npcs().filter(n => n.folderId === id).length;
  }

  getSelectedFolderName(): string {
    const id = this.selectedFolderId();
    if (id === null) return 'Todos';
    if (id === 'unassigned') return 'Sem Pasta';
    return this.folders().find(f => f.id === id)?.name || '';
  }

  moveNpc(npcId: string, folderId: string | null) {
    const updated = this.npcs().map(n => {
      if (n.id === npcId) {
        return { ...n, folderId: folderId === 'unassigned' || folderId === null ? undefined : folderId };
      }
      return n;
    });
    this.saveNpcs(updated);
    if (this.viewingNpc()?.id === npcId) {
      this.viewingNpc.set(updated.find(n => n.id === npcId) || null);
    }
    this.showToast('NPC movido com sucesso.');
  }

  autoSaveNpc() {
    this.saveNpcs([...this.npcs()]);
  }

  recalcAttrMod(attr: GeneratedNpcAttribute) {
    const configAttr = this.config().attributes.find(a => a.name === attr.name);
    if (configAttr?.useDndModifier) {
      attr.modifier = this.dndModifier(attr.value);
    }
  }

  toggleSkillTrained(skill: GeneratedNpcSkill) {
    skill.isTrained = !skill.isTrained;
  }

  // ─── Helpers ───

  getOptionsPreview(field: NpcSelectionField): string {
    const opts = field.optionsText.split(/[\n,]/).map(o => o.trim()).filter(o => o.length > 0);
    return opts.slice(0, 3).join(', ') + (opts.length > 3 ? ` +${opts.length - 3}` : '');
  }

  formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  trainedCount(npc: GeneratedNpc): number {
    return npc.skills.filter(s => s.isTrained).length;
  }

  hasDndModActive(): boolean {
    return this.config().attributes.some(a => a.useDndModifier);
  }

  decrementTrained() {
    this.trainedSkillsCount.update(v => Math.max(0, v - 1));
  }

  incrementTrained() {
    this.trainedSkillsCount.update(v => Math.min(this.config().skills.length, v + 1));
  }

  getTrainedSkills(npc: GeneratedNpc): GeneratedNpcSkill[] {
    return npc.skills.filter(s => s.isTrained);
  }

  // ─── Inline Attribute Helpers ───

  addSingleAttr() {
    const current = this.config();
    this.updateConfig({
      ...current,
      attributes: [
        ...current.attributes,
        { id: crypto.randomUUID(), name: '', startValue: 10, minValue: 3, maxValue: 18, useDndModifier: false }
      ]
    });
  }

  removeSingleAttr(id: string) {
    const current = this.config();
    this.updateConfig({
      ...current,
      attributes: current.attributes.filter(a => a.id !== id)
    });
  }

  // ─── Inline Skill Helpers ───

  addSingleSkill() {
    const current = this.config();
    this.updateConfig({
      ...current,
      skills: [
        ...current.skills,
        { id: crypto.randomUUID(), name: '' }
      ]
    });
  }

  removeSingleSkill(id: string) {
    const current = this.config();
    this.updateConfig({
      ...current,
      skills: current.skills.filter(s => s.id !== id)
    });
  }

  // ─── Inline Spell Helpers ───

  addSingleSpell() {
    const current = this.config();
    this.updateConfig({
      ...current,
      spells: [
        ...current.spells,
        { id: crypto.randomUUID(), name: '', description: '' }
      ]
    });
  }

  removeSingleSpell(id: string) {
    const current = this.config();
    this.updateConfig({
      ...current,
      spells: current.spells.filter(s => s.id !== id)
    });
  }

  removeNpcSpell(id: string) {
    const npc = this.viewingNpc();
    if (!npc) return;
    npc.spells = npc.spells.filter(s => s.id !== id);
    this.autoSaveNpc();
  }

  // ─── Spell Count ───

  decrementSpells() {
    this.trainedSpellsCount.update(v => Math.max(0, v - 1));
  }

  incrementSpells() {
    this.trainedSpellsCount.update(v => Math.min(this.config().spells.length, v + 1));
  }

  // ─── Attribute Batch Screen ───

  openAttrBatchScreen() {
    const existing = this.config().attributes;
    if (existing.length > 0) {
      this.attrBatchList.set(
        existing.map(a => ({
          name: a.name,
          startValue: a.startValue,
          minValue: a.minValue,
          maxValue: a.maxValue,
          useDndModifier: a.useDndModifier
        }))
      );
    } else {
      this.attrBatchList.set([
        { name: '', startValue: 10, minValue: 3, maxValue: 18, useDndModifier: false }
      ]);
    }
    this.activeScreen.set('attr-batch');
  }

  addAttrRow() {
    this.attrBatchList.update(list => [
      ...list,
      { name: '', startValue: 10, minValue: 3, maxValue: 18, useDndModifier: false }
    ]);
  }

  removeAttrRow(index: number) {
    this.attrBatchList.update(list => list.filter((_, i) => i !== index));
  }

  confirmAttrBatch() {
    const list = this.attrBatchList();
    const valid = list.filter(a => a.name.trim().length > 0);
    if (valid.length === 0) {
      this.showToast('Adicione pelo menos um atributo com nome.');
      return;
    }

    const current = this.config();
    this.updateConfig({
      ...current,
      attributes: valid.map(a => ({
        id: crypto.randomUUID(),
        name: a.name.trim(),
        startValue: a.startValue,
        minValue: a.minValue,
        maxValue: a.maxValue,
        useDndModifier: a.useDndModifier
      }))
    });

    this.activeScreen.set('config');
    this.showToast(`${valid.length} atributo(s) salvos!`);
  }

  cancelAttrBatch() {
    this.activeScreen.set('config');
  }

  // ─── Toast / Confirm ───

  private showToast(message: string) {
    if (this.notifTimeout) clearTimeout(this.notifTimeout);
    this.notificationMessage.set(message);
    this.notifTimeout = setTimeout(() => this.notificationMessage.set(null), 3000);
  }

  dismissToast() {
    this.notificationMessage.set(null);
    if (this.notifTimeout) clearTimeout(this.notifTimeout);
  }

  private askConfirm(message: string, onConfirm: () => void) {
    this.confirmMessage = message;
    this.confirmAction = onConfirm;
    this.showConfirmModal.set(true);
  }

  confirmYes() {
    this.showConfirmModal.set(false);
    if (this.confirmAction) this.confirmAction();
    this.confirmAction = null;
  }

  confirmNo() {
    this.showConfirmModal.set(false);
    this.confirmAction = null;
  }
}
