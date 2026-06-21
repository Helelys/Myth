import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

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

export interface NpcSelectionField {
  id: string;
  fieldName: string;
  optionsText: string; // comma or newline separated options
}

export interface NpcGeneratorConfig {
  attributes: NpcAttributeDef[];
  skills: NpcSkillDef[]; // List of available skills
  selections: NpcSelectionField[]; // e.g., Classes, Raças
  textFields: string[]; // e.g., Background, Descrição
  trainedSkillsCount: number;
}

export interface GeneratedNpcAttribute {
  name: string;
  value: number;
  modifier?: number;
}

export interface GeneratedNpcSkill {
  name: string;
  isTrained: boolean;
}

export interface GeneratedNpcSelection {
  fieldName: string;
  chosen: string;
}

export interface GeneratedNpcText {
  label: string;
  value: string;
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
  selections: GeneratedNpcSelection[];
  texts: GeneratedNpcText[];
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
const STORAGE_CONFIG = 'mythmaker_npc_config';
const STORAGE_FOLDERS = 'mythmaker_npc_folders';

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

  // ── Config State ──
  config: NpcGeneratorConfig = this.defaultConfig();
  newSkillName = '';
  newSelectionName = '';
  newSelectionOptions = '';
  newTextFieldName = '';

  // ── Generated NPCs & Folders ──
  npcs = signal<GeneratedNpc[]>([]);
  folders = signal<NpcFolder[]>([]);
  selectedFolderId = signal<string | null>(null); // null = "Todos", "unassigned" = "Sem Pasta"

  // ── UI State ──
  notificationMessage = signal<string | null>(null);
  private notifTimeout: any = null;
  showConfirmModal = signal(false);
  confirmMessage = '';
  private confirmAction: (() => void) | null = null;

  // Folder creation modal
  showFolderModal = signal(false);
  newFolderName = '';

  // NPC detail view
  viewingNpc = signal<GeneratedNpc | null>(null);

  // Selection field options editing
  expandedSelectionId = signal<string | null>(null);

  ngOnInit() {
    this.loadConfig();
    this.loadFolders();
    this.loadNpcs();
  }

  // ─── Defaults ───

  defaultConfig(): NpcGeneratorConfig {
    return {
      attributes: [
        { id: crypto.randomUUID(), name: 'Força', startValue: 10, minValue: 3, maxValue: 18, useDndModifier: true },
        { id: crypto.randomUUID(), name: 'Destreza', startValue: 10, minValue: 3, maxValue: 18, useDndModifier: true },
        { id: crypto.randomUUID(), name: 'Constituição', startValue: 10, minValue: 3, maxValue: 18, useDndModifier: true },
        { id: crypto.randomUUID(), name: 'Inteligência', startValue: 10, minValue: 3, maxValue: 18, useDndModifier: true },
        { id: crypto.randomUUID(), name: 'Sabedoria', startValue: 10, minValue: 3, maxValue: 18, useDndModifier: true },
        { id: crypto.randomUUID(), name: 'Carisma', startValue: 10, minValue: 3, maxValue: 18, useDndModifier: true },
      ],
      skills: [
        { id: crypto.randomUUID(), name: 'Acrobacia' },
        { id: crypto.randomUUID(), name: 'Atletismo' },
        { id: crypto.randomUUID(), name: 'Enganação' },
        { id: crypto.randomUUID(), name: 'Furtividade' },
        { id: crypto.randomUUID(), name: 'Intimidação' },
        { id: crypto.randomUUID(), name: 'Investigação' },
        { id: crypto.randomUUID(), name: 'Percepção' },
        { id: crypto.randomUUID(), name: 'Persuasão' }
      ],
      selections: [
        { id: crypto.randomUUID(), fieldName: 'Raça', optionsText: 'Humano\nElfo\nAnão\nHalfling\nTiefling\nOrc' },
        { id: crypto.randomUUID(), fieldName: 'Classe', optionsText: 'Guerreiro\nMago\nLadino\nClérigo\nBárbaro\nBardo' }
      ],
      textFields: ['Background', 'Aparência', 'Notas'],
      trainedSkillsCount: 3
    };
  }

  // ─── Persistence ───

  saveConfig() {
    localStorage.setItem(STORAGE_CONFIG, JSON.stringify(this.config));
    this.showToast('Configuração salva!');
  }

  loadConfig() {
    const saved = localStorage.getItem(STORAGE_CONFIG);
    if (saved) {
      try {
        this.config = JSON.parse(saved);
      } catch {
        this.config = this.defaultConfig();
      }
    }
  }

  loadNpcs() {
    const saved = localStorage.getItem(STORAGE_NPCS);
    this.npcs.set(saved ? JSON.parse(saved) : []);
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

  // ─── Attribute Management ───

  addAttribute() {
    this.config.attributes.push({
      id: crypto.randomUUID(),
      name: 'Novo Atributo',
      startValue: 10,
      minValue: 1,
      maxValue: 20,
      useDndModifier: false
    });
  }

  removeAttribute(id: string) {
    this.config.attributes = this.config.attributes.filter(a => a.id !== id);
  }

  // ─── Skill Management ───

  addSkill() {
    this.config.skills.push({ id: crypto.randomUUID(), name: 'Nova Perícia' });
  }

  removeSkill(id: string) {
    this.config.skills = this.config.skills.filter(s => s.id !== id);
  }

  // ─── Selection Field Management ───

  addSelectionField() {
    const name = this.newSelectionName.trim();
    const opts = this.newSelectionOptions;
    if (!name) return;
    this.config.selections.push({ id: crypto.randomUUID(), fieldName: name, optionsText: opts });
    this.newSelectionName = '';
    this.newSelectionOptions = '';
  }

  removeSelectionField(id: string) {
    this.config.selections = this.config.selections.filter(f => f.id !== id);
  }

  toggleExpand(id: string) {
    this.expandedSelectionId.update(current => current === id ? null : id);
  }

  // ─── Text Fields Management ───

  trackByIndex(index: number): number {
    return index;
  }

  addTextField() {
    const name = 'Novo Campo';
    let suffix = '';
    let counter = 1;
    while (this.config.textFields.includes(name + suffix)) {
      suffix = ` (${counter})`;
      counter++;
    }
    this.config.textFields.push(name + suffix);
  }

  removeTextField(name: string) {
    this.config.textFields = this.config.textFields.filter(t => t !== name);
  }

  // ─── Generation ───

  generateNpc() {
    if (this.config.attributes.length === 0 && this.config.skills.length === 0 && this.config.selections.length === 0) {
      this.showToast('Configure pelo menos um campo antes de gerar!');
      return;
    }

    let folderId: string | undefined = undefined;
    if (this.selectedFolderId() && this.selectedFolderId() !== 'unassigned') {
      folderId = this.selectedFolderId() as string;
    }

    const npc: GeneratedNpc = {
      id: crypto.randomUUID(),
      name: this.randomName(),
      createdAt: Date.now(),
      folderId,
      attributes: this.generateAttributes(),
      skills: this.generateSkills(),
      selections: this.generateSelections(),
      texts: this.config.textFields.map(label => ({ label, value: '' }))
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

  private generateAttributes(): GeneratedNpcAttribute[] {
    return this.config.attributes.map(attr => {
      const value = this.randomInt(attr.minValue, attr.maxValue);
      const result: GeneratedNpcAttribute = { name: attr.name, value };
      if (attr.useDndModifier) {
        result.modifier = this.dndModifier(value);
      }
      return result;
    });
  }

  private generateSkills(): GeneratedNpcSkill[] {
    const skills: GeneratedNpcSkill[] = this.config.skills.map(s => ({ name: s.name, isTrained: false }));
    if (skills.length === 0) return [];

    const count = Math.min(this.config.trainedSkillsCount, skills.length);
    const indices = [...Array(skills.length).keys()];
    // Fisher-Yates shuffle, take first `count`
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    for (let k = 0; k < count; k++) {
      skills[indices[k]].isTrained = true;
    }
    return skills;
  }

  private generateSelections(): GeneratedNpcSelection[] {
    return this.config.selections.map(field => {
      const opts = field.optionsText
        .split(/[\n,]/)
        .map(o => o.trim())
        .filter(o => o.length > 0);
      const chosen = opts.length > 0
        ? opts[Math.floor(Math.random() * opts.length)]
        : '—';
      return { fieldName: field.fieldName, chosen };
    });
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
    this.askConfirm('Restaurar configuração padrão? Isso apagará todas as suas configurações.', () => {
      this.config = this.defaultConfig();
      localStorage.removeItem(STORAGE_CONFIG);
      this.showToast('Configuração restaurada.');
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

      // Move NPCs to unassigned
      let npcsChanged = false;
      const updatedNpcs = this.npcs().map(npc => {
        if (npc.folderId === id) {
          npcsChanged = true;
          return { ...npc, folderId: undefined };
        }
        return npc;
      });
      if (npcsChanged) this.saveNpcs(updatedNpcs);

      if (this.selectedFolderId() === id) {
        this.selectedFolderId.set(null);
      }
      this.showToast('Pasta excluída.');
    });
  }

  selectFolder(id: string | null) {
    this.selectedFolderId.set(id);
  }

  getFilteredNpcs(): GeneratedNpc[] {
    const selId = this.selectedFolderId();
    if (selId === null) return this.npcs(); // Todos
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

  saveNpcChanges() {
    // Force a save to localStorage whenever an NPC text is modified (via ngModelChange)
    this.saveNpcs([...this.npcs()]);
  }

  autoSaveNpc() {
    this.saveNpcs([...this.npcs()]);
  }

  recalcAttrMod(attr: GeneratedNpcAttribute) {
    const configAttr = this.config.attributes.find(a => a.name === attr.name);
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

  getModifierText(value: number): string {
    const mod = this.dndModifier(value);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  }

  formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  trainedCount(npc: GeneratedNpc): number {
    return npc.skills.filter(s => s.isTrained).length;
  }

  // ─── Template Helpers ───

  hasDndModActive(): boolean {
    return this.config.attributes.some(a => a.useDndModifier);
  }

  decrementTrained() {
    this.config.trainedSkillsCount = Math.max(0, this.config.trainedSkillsCount - 1);
  }

  incrementTrained() {
    this.config.trainedSkillsCount = Math.min(this.config.skills.length, this.config.trainedSkillsCount + 1);
  }

  getTrainedSkills(npc: GeneratedNpc): GeneratedNpcSkill[] {
    return npc.skills.filter(s => s.isTrained);
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
