import { Component, signal, OnInit, computed, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';

import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Campaign } from '../criar-campanha/criar-campanha.component';
import { SheetBuilderComponent } from '../sheet-builder/sheet-builder';
import { PlayerSheetViewComponent } from '../sheet-builder/player-sheet-view/player-sheet-view';
import { Character } from '../player-sheet/player-sheet.component';
import { TabletopComponent } from '../tabletop/tabletop.component';

type Tab = 'sistema' | 'personagens' | 'combates' | 'escudo' | 'tabletop';
type SystemView = 'regras' | 'ficha' | 'ficha-monstro' | 'itens' | 'anotacoes';

export interface CombatParticipant {
  name: string;
  diceCount: number;
  diceSides: number;
  modifier: number;
  rollMode: 'sum' | 'highest' | 'lowest';
  result?: number;
}

export interface DMBar {
  label: string;
  current: number;
  max: number;
  color: string;
}

export interface DMTracker {
  id: string;
  name: string;
  image?: string;
  bars: DMBar[];
}

@Component({
  selector: 'app-campaign-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SheetBuilderComponent, PlayerSheetViewComponent, TabletopComponent],
  templateUrl: './campaign-detail.component.html',
  styleUrl: './campaign-detail.component.scss'
})
export class CampaignDetailComponent implements OnInit, AfterViewInit, OnDestroy {

  campaignId = signal<string | null>(null);
  campaign = signal<Campaign | null>(null);
  activeTab = signal<Tab>('sistema');
  activeSystemView = signal<SystemView>('regras');

  // Character management
  characters = signal<Character[]>([]);
  monsters = signal<Character[]>([]);
  selectedCharId = signal<string | null>(null);
  charViewMode = signal<'list' | 'sheet'>('list');

  // System & Notes
  systemRules = signal<string>('');
  gmNotes = signal<string>('');

  // Toast + Confirm
  notificationMessage = signal<string | null>(null);
  private notifTimeout: any = null;
  showConfirmModal = signal(false);
  confirmMessage = '';
  private confirmAction: (() => void) | null = null;

  // Import/Export modals with selection
  showImportGlobalModal = signal(false);
  importableItems = signal<any[]>([]);
  importTitle = signal('');
  importCallback: ((index: number) => void) | null = null;

  // Combat Order
  combatParticipants = signal<CombatParticipant[]>([]);
  showCombatModal = signal(false);
  modalParticipants = signal<CombatParticipant[]>([]);
  dieSidesOptions = [2, 6, 8, 10, 12, 20, 100];
  isRollingInitiative = signal(false);
  currentTurnIndex = signal(0);

  // DM Screen Trackers
  dmTrackers = signal<DMTracker[]>([]);
  showDMModal = signal(false);
  editingTracker = signal<DMTracker | null>(null);
  showImportModal = signal(false);

  @ViewChild('editorRef', { static: false }) editorRef!: ElementRef<HTMLElement>;

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    this.campaignId.set(id);
    
    if (id) {
      const saved: Campaign[] = JSON.parse(localStorage.getItem('mythmaker_campaigns') ?? '[]');
      const found = saved.find(c => c.id === id);
      if (found) {
        this.campaign.set(found);
        this.loadCharacters(id);
        this.loadSystemData(id);
        this.loadCombatOrder(id);
        this.loadDMData(id);
      }
    }

    document.addEventListener('selectionchange', this.onSystemSelectionChange);
  }

  ngOnDestroy() {
    document.removeEventListener('selectionchange', this.onSystemSelectionChange);
  }

  ngAfterViewInit() {
    // Re-populate the contenteditable with saved data after view renders
    setTimeout(() => this.populateEditorContent(), 0);
  }


  private populateEditorContent() {
    const el = this.editorRef?.nativeElement;
    if (el && this.systemRules()) {
      el.innerHTML = this.systemRules();
    }
  }

  loadDMData(campaignId: string) {
    const saved = JSON.parse(localStorage.getItem(`mythmaker_dm_${campaignId}`) ?? '[]');
    this.dmTrackers.set(saved);
  }

  saveDMData() {
    localStorage.setItem(`mythmaker_dm_${this.campaignId()}`, JSON.stringify(this.dmTrackers()));
  }

  loadCombatOrder(campaignId: string) {
    const saved = JSON.parse(localStorage.getItem(`mythmaker_combat_${campaignId}`) ?? 'null');
    if (saved) {
      this.combatParticipants.set(saved.participants || []);
      this.modalParticipants.set(saved.setup || []);
      this.currentTurnIndex.set(saved.currentTurnIndex || 0);
    }
  }

  saveCombatOrder() {
    const campaignId = this.campaignId();
    if (!campaignId) return;

    const data = {
      participants: this.combatParticipants(),
      setup: this.modalParticipants(),
      currentTurnIndex: this.currentTurnIndex()
    };
    localStorage.setItem(`mythmaker_combat_${campaignId}`, JSON.stringify(data));
  }

  loadSystemData(campaignId: string) {
    const saved = JSON.parse(localStorage.getItem(`mythmaker_system_${campaignId}`) ?? '{}');
    this.systemRules.set(saved.rules || '');
    this.gmNotes.set(saved.notes || '');
  }

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

  private openGlobalImportModal(title: string, items: any[], nameLabel: string, callback: (index: number) => void) {
    if (items.length === 0) return;
    this.importTitle.set(title);
    this.importableItems.set(items.map((item: any, i: number) => ({ index: i, label: item[nameLabel] || item.name || item.title || `Item ${i + 1}` })));
    this.importCallback = callback;
    this.showImportGlobalModal.set(true);
  }

  confirmGlobalImport(index: number) {
    if (this.importCallback) {
      this.importCallback(index);
    }
    this.showImportGlobalModal.set(false);
    this.importCallback = null;
  }

  cancelGlobalImport() {
    this.showImportGlobalModal.set(false);
    this.importCallback = null;
  }

  saveSystemData() {
    // Save the contenteditable content to systemRules
    if (this.editorRef?.nativeElement) {
      this.systemRules.set(this.editorRef.nativeElement.innerHTML);
    }

    const data = {
      rules: this.systemRules(),
      notes: this.gmNotes()
    };
    localStorage.setItem(`mythmaker_system_${this.campaignId()}`, JSON.stringify(data));
    this.showToast('Dados salvos com sucesso!');
  }

  importGlobalSystem() {
    const globalSystems = JSON.parse(localStorage.getItem('mythmaker_global_systems') ?? '[]');
    if (globalSystems.length === 0) {
      this.showToast('Nenhum sistema global encontrado. Crie um na página "Sistemas".');
      return;
    }

    this.openGlobalImportModal(
      'Selecione o sistema para importar',
      globalSystems,
      'title',
      (index: number) => {
        const system = globalSystems[index];
        this.systemRules.set(system.content);
        const el = this.editorRef?.nativeElement;
        if (el) el.innerHTML = system.content;
        this.showToast(`Sistema "${system.title}" importado! Não esqueça de salvar.`);
      }
    );
  }

  importGlobalTemplate(type: 'player' | 'monster') {
    const globalTemplates = JSON.parse(localStorage.getItem('mythmaker_global_templates') ?? '[]');
    const filtered = globalTemplates.filter((t: any) => t.type === type);

    if (filtered.length === 0) {
      this.showToast(`Nenhum modelo de ${type === 'player' ? 'jogador' : 'monstro'} encontrado na biblioteca global.`);
      return;
    }

    this.openGlobalImportModal(
      `Selecione o modelo de ${type === 'player' ? 'jogador' : 'monstro'} para importar`,
      filtered,
      'name',
      (index: number) => {
        // Save using the same key that SheetBuilderComponent.loadTemplate() uses
        const key = `mythmaker_sheet2_${type}_${this.campaignId()}`;
        localStorage.setItem(key, JSON.stringify(filtered[index].schema));
        this.showToast(`Modelo "${filtered[index].name}" importado! Recarregando...`);
        window.location.reload();
      }
    );
  }

  importGlobalCharacter() {
    const globalChars = JSON.parse(localStorage.getItem('mythmaker_global_characters') ?? '[]');
    if (globalChars.length === 0) {
      this.showToast('Nenhum personagem encontrado na biblioteca global.');
      return;
    }

    this.openGlobalImportModal(
      'Selecione o personagem para importar',
      globalChars,
      'name',
      (index: number) => {
        const char = globalChars[index];
        const newChar: Character = {
          id: crypto.randomUUID(),
          campaignId: this.campaignId()!,
          name: char.name,
          data: char.data,
          isMonster: char.isMonster
        };
        const all = JSON.parse(localStorage.getItem('mythmaker_characters') ?? '[]');
        all.push(newChar);
        localStorage.setItem('mythmaker_characters', JSON.stringify(all));
        this.loadCharacters(this.campaignId()!);
        this.showToast(`Personagem "${char.name}" importado com sucesso!`);
      }
    );
  }

  importGlobalNote() {
    const globalNotes = JSON.parse(localStorage.getItem('mythmaker_global_notes') ?? '[]');
    if (globalNotes.length === 0) {
      this.showToast('Nenhuma anotação global encontrada.');
      return;
    }

    this.openGlobalImportModal(
      'Selecione a anotação para importar',
      globalNotes,
      'title',
      (index: number) => {
        this.gmNotes.set(globalNotes[index].content);
        this.showToast(`Anotação "${globalNotes[index].title}" importada! Não esqueça de salvar.`);
      }
    );
  }

  importGlobalItem() {
    const globalItems = JSON.parse(localStorage.getItem('mythmaker_global_items') ?? '[]');
    if (globalItems.length === 0) {
      this.showToast('Nenhum item global encontrado.');
      return;
    }

    // For items, show a list of names using the modal
    this.openGlobalImportModal(
      'Compêndio de Itens Globais (selecione para visualizar)',
      globalItems,
      'name',
      () => {
        this.showToast('Copie as propriedades do item para a ficha do personagem.');
      }
    );
  }

  loadCharacters(campaignId: string) {
    const all: Character[] = JSON.parse(localStorage.getItem('mythmaker_characters') ?? '[]');
    const campaignChars = all.filter(c => c.campaignId === campaignId);
    
    this.characters.set(campaignChars.filter(c => !c.isMonster));
    this.monsters.set(campaignChars.filter(c => c.isMonster));
  }

  createCharacter(isMonster = false) {
    const newChar: Character = {
      id: crypto.randomUUID(),
      campaignId: this.campaignId()!,
      name: isMonster ? 'Nova Criatura' : 'Novo Herói',
      data: {},
      isMonster
    };
    
    const all = JSON.parse(localStorage.getItem('mythmaker_characters') ?? '[]');
    all.push(newChar);
    localStorage.setItem('mythmaker_characters', JSON.stringify(all));
    
    if (isMonster) this.monsters.update(prev => [...prev, newChar]);
    else this.characters.update(prev => [...prev, newChar]);
    
    this.openCharacter(newChar.id);
  }

  deleteCharacter(id: string, event: MouseEvent) {
    event.stopPropagation();
    this.askConfirm('Tem certeza que deseja excluir?', () => {
      const all: Character[] = JSON.parse(localStorage.getItem('mythmaker_characters') ?? '[]');
      const filtered = all.filter(c => c.id !== id);
      localStorage.setItem('mythmaker_characters', JSON.stringify(filtered));
      this.loadCharacters(this.campaignId()!);
      if (this.selectedCharId() === id) this.closeCharacter();
      this.showToast('Personagem excluído.');
    });
  }

  openCharacter(id: string) {
    this.selectedCharId.set(id);
    this.charViewMode.set('sheet');
  }

  closeCharacter() {
    this.selectedCharId.set(null);
    this.charViewMode.set('list');
  }

  setActiveTab(tab: Tab) {
    this.activeTab.set(tab);
  }

  setSystemView(view: SystemView) {
    this.activeSystemView.set(view);
  }

  getSelectedChar() {
    return this.characters().find(c => c.id === this.selectedCharId()) || 
           this.monsters().find(c => c.id === this.selectedCharId()) || null;
  }

  // Combat Order Methods
  openCombatModal() {
    if (this.modalParticipants().length === 0) {
      this.modalParticipants.set([
        { name: '', diceCount: 1, diceSides: 20, modifier: 0, rollMode: 'sum' }
      ]);
    }
    this.showCombatModal.set(true);
  }

  closeCombatModal() {
    this.showCombatModal.set(false);
  }

  addModalRow() {
    this.modalParticipants.update(prev => [
      ...prev,
      { name: '', diceCount: 1, diceSides: 20, modifier: 0, rollMode: 'sum' }
    ]);
    this.saveCombatOrder();
  }

  removeModalRow(index: number) {
    this.modalParticipants.update(prev => prev.filter((_, i) => i !== index));
    if (this.modalParticipants().length === 0) {
      this.addModalRow();
    }
    this.saveCombatOrder();
  }

  rollInitiative() {
    this.isRollingInitiative.set(true);
    
    // Simulate roll animation
    setTimeout(() => {
      const results = this.modalParticipants().map(p => {
        const rolls: number[] = [];
        for (let i = 0; i < p.diceCount; i++) {
          rolls.push(Math.floor(Math.random() * p.diceSides) + 1);
        }

        let result = 0;
        if (p.rollMode === 'sum') {
          result = rolls.reduce((a, b) => a + b, 0) + p.modifier;
        } else if (p.rollMode === 'highest') {
          result = Math.max(...rolls) + p.modifier;
        } else if (p.rollMode === 'lowest') {
          result = Math.min(...rolls) + p.modifier;
        }

        return { ...p, result };
      });

      // Sort by result descending
      results.sort((a, b) => (b.result || 0) - (a.result || 0));
      
      this.combatParticipants.set(results);
      this.isRollingInitiative.set(false);
      this.saveCombatOrder();
      this.closeCombatModal();
    }, 1000);
  }

  removeFromCombatOrder(index: number) {
    this.combatParticipants.update(prev => prev.filter((_, i) => i !== index));
    this.saveCombatOrder();
  }

  addManualParticipant() {
    const newP: CombatParticipant = {
      name: '',
      diceCount: 0,
      diceSides: 20,
      modifier: 0,
      rollMode: 'sum',
      result: 0
    };
    this.combatParticipants.update(prev => [...prev, newP]);
    this.saveCombatOrder();
  }

  sortCombatOrder() {
    this.combatParticipants.update(prev => {
      const sorted = [...prev].sort((a, b) => (b.result || 0) - (a.result || 0));
      return sorted;
    });
    this.currentTurnIndex.set(0);
    this.saveCombatOrder();
  }

  nextTurn() {
    const total = this.combatParticipants().length;
    if (total === 0) return;
    this.currentTurnIndex.update(idx => (idx + 1) % total);
    this.saveCombatOrder();
  }

  prevTurn() {
    const total = this.combatParticipants().length;
    if (total === 0) return;
    this.currentTurnIndex.update(idx => (idx - 1 + total) % total);
    this.saveCombatOrder();
  }

  clearCombatOrder() {
    this.combatParticipants.set([]);
    this.currentTurnIndex.set(0);
    this.saveCombatOrder();
  }

  // DM Screen Methods
  openNewDMTracker() {
    this.editingTracker.set({
      id: crypto.randomUUID(),
      name: '',
      bars: [
        { label: 'PV', current: 10, max: 10, color: '#e05a5a' }
      ]
    });
    this.showDMModal.set(true);
  }

  editDMTracker(tracker: DMTracker) {
    this.editingTracker.set(JSON.parse(JSON.stringify(tracker)));
    this.showDMModal.set(true);
  }

  saveDMTracker() {
    const tracker = this.editingTracker();
    if (!tracker) return;

    this.dmTrackers.update(prev => {
      const idx = prev.findIndex(t => t.id === tracker.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = tracker;
        return next;
      }
      return [...prev, tracker];
    });
    
    this.saveDMData();
    this.showDMModal.set(false);
  }

  removeDMTracker(id: string, event: MouseEvent) {
    event.stopPropagation();
    this.askConfirm('Excluir este rastreador?', () => {
      this.dmTrackers.update(prev => prev.filter(t => t.id !== id));
      this.saveDMData();
      this.showToast('Rastreador excluído.');
    });
  }

  addBarToEditing() {
    this.editingTracker.update(prev => {
      if (!prev || prev.bars.length >= 3) return prev;
      return {
        ...prev,
        bars: [...prev.bars, { label: 'Nova Barra', current: 10, max: 10, color: '#5a97e0' }]
      };
    });
  }

  removeBarFromEditing(index: number) {
    this.editingTracker.update(prev => {
      if (!prev) return null;
      return {
        ...prev,
        bars: prev.bars.filter((_, i) => i !== index)
      };
    });
  }

  handleTrackerPhoto(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.editingTracker.update(prev => prev ? { ...prev, image: e.target.result } : null);
      };
      reader.readAsDataURL(file);
    }
  }

  adjustBar(trackerId: string, barIndex: number, amount: number) {
    this.dmTrackers.update(prev => {
      const next = [...prev];
      const t = next.find(x => x.id === trackerId);
      if (t) {
        t.bars[barIndex].current += amount;
        if (t.bars[barIndex].current < 0) t.bars[barIndex].current = 0;
      }
      return next;
    });
    this.saveDMData();
  }

  openImportModal() {
    this.showImportModal.set(true);
  }

  importCharacter(char: Character) {
    const newTracker: DMTracker = {
      id: crypto.randomUUID(),
      name: char.name,
      image: char.data['photo'] || char.data['foto'] || '',
      bars: [
        { label: 'Vida', current: 20, max: 20, color: '#e05a5a' }
      ]
    };
    this.dmTrackers.update(prev => [...prev, newTracker]);
    this.saveDMData();
    this.showImportModal.set(false);
    this.showToast(`${char.name} exportado para o Escudo!`);
  }

  /* ── Rich Text Formatting for Sistema Editor ── */

  /** Save the current editor selection so toolbar buttons can restore it */
  private savedEditorRange: Range | null = null;

  private onSystemSelectionChange = () => {
    const el = this.editorRef?.nativeElement;
    if (!el) return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && el.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      this.savedEditorRange = sel.getRangeAt(0).cloneRange();
    }
  };

  /** Restore or create a valid selection inside the editor */
  private ensureEditorSelection(): boolean {
    const el = this.editorRef?.nativeElement;
    if (!el) return false;

    const sel = window.getSelection();

    // If there's already a valid selection inside the editor, keep it
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (el.contains(range.commonAncestorContainer)) {
        el.focus();
        return true;
      }
    }

    // Try restoring saved selection
    if (this.savedEditorRange) {
      try {
        sel?.removeAllRanges();
        sel?.addRange(this.savedEditorRange);
        el.focus();
        return true;
      } catch {
        this.savedEditorRange = null;
      }
    }

    // Place cursor inside editor
    el.focus();
    const range = document.createRange();
    const lastChild = el.lastChild || el;
    if (lastChild.nodeType === Node.ELEMENT_NODE && (lastChild as HTMLElement).tagName === 'BR') {
      range.setStartBefore(lastChild);
    } else if (lastChild === el) {
      range.selectNodeContents(el);
    } else {
      range.setStartAfter(lastChild);
    }
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);
    return true;
  }

  onToolMouseDown(command: string, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.formatSystemText(command);
  }

  formatSystemText(command: string) {
    const el = this.editorRef?.nativeElement;
    if (!el) return;

    // Restore selection inside the editor before running execCommand
    if (!this.ensureEditorSelection()) return;

    // Enable inline CSS for styling
    document.execCommand('styleWithCSS', false, 'true');

    switch (command) {
      case 'bold':
        document.execCommand('bold', false);
        break;
      case 'italic':
        document.execCommand('italic', false);
        break;
      case 'underline':
        document.execCommand('underline', false);
        break;
      case 'h1':
        document.execCommand('formatBlock', false, '<h1>');
        break;
      case 'h2':
        document.execCommand('formatBlock', false, '<h2>');
        break;
    }

    el.focus();
    this.systemRules.set(el.innerHTML);
  }


  onSystemInput(event: Event) {
    const el = event.target as HTMLElement;
    this.systemRules.set(el.innerHTML);
  }

  onSystemBlur() {
    const el = this.editorRef?.nativeElement;
    if (el) {
      this.systemRules.set(el.innerHTML);
    }
  }
}
