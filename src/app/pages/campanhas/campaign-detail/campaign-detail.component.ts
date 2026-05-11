import { Component, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Campaign } from '../criar-campanha/criar-campanha.component';
import { SheetEditorComponent } from '../sheet-editor/sheet-editor.component';
import { PlayerSheetComponent, Character } from '../player-sheet/player-sheet.component';

type Tab = 'sistema' | 'personagens' | 'combates' | 'escudo';
type SystemView = 'overview' | 'ficha' | 'ficha-monstro' | 'regras' | 'anotacoes';

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
  imports: [CommonModule, FormsModule, RouterLink, SheetEditorComponent, PlayerSheetComponent],
  templateUrl: './campaign-detail.component.html',
  styleUrl: './campaign-detail.component.scss'
})
export class CampaignDetailComponent implements OnInit {
  campaignId = signal<string | null>(null);
  campaign = signal<Campaign | null>(null);
  activeTab = signal<Tab>('sistema');
  activeSystemView = signal<SystemView>('overview');

  // Character management
  characters = signal<Character[]>([]);
  monsters = signal<Character[]>([]);
  selectedCharId = signal<string | null>(null);
  charViewMode = signal<'list' | 'sheet'>('list');

  // System & Notes
  systemRules = signal<string>('');
  gmNotes = signal<string>('');

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

  saveSystemData() {
    const data = {
      rules: this.systemRules(),
      notes: this.gmNotes()
    };
    localStorage.setItem(`mythmaker_system_${this.campaignId()}`, JSON.stringify(data));
    alert('Dados salvos com sucesso!');
  }

  importGlobalSystem() {
    const globalSystems = JSON.parse(localStorage.getItem('mythmaker_global_systems') ?? '[]');
    if (globalSystems.length === 0) {
      alert('Nenhum sistema global encontrado para importar. Crie um na página "Sistemas".');
      return;
    }

    const titles = globalSystems.map((s: any, i: number) => `${i + 1}. ${s.title}`).join('\n');
    const choice = prompt(`Selecione o sistema para importar (digite o número):\n\n${titles}`);
    
    if (choice) {
      const index = parseInt(choice) - 1;
      if (globalSystems[index]) {
        this.systemRules.set(globalSystems[index].content);
        alert(`Sistema "${globalSystems[index].title}" importado! Não esqueça de salvar.`);
      } else {
        alert('Opção inválida.');
      }
    }
  }

  importGlobalTemplate(type: 'player' | 'monster') {
    const globalTemplates = JSON.parse(localStorage.getItem('mythmaker_global_templates') ?? '[]');
    const filtered = globalTemplates.filter((t: any) => t.type === type);

    if (filtered.length === 0) {
      alert(`Nenhum modelo de ${type === 'player' ? 'jogador' : 'monstro'} encontrado na biblioteca global.`);
      return;
    }

    const titles = filtered.map((t: any, i: number) => `${i + 1}. ${t.name}`).join('\n');
    const choice = prompt(`Selecione o modelo para importar:\n\n${titles}`);

    if (choice) {
      const index = parseInt(choice) - 1;
      if (filtered[index]) {
        localStorage.setItem(`mythmaker_template_${type}_${this.campaignId()}`, JSON.stringify(filtered[index].schema));
        alert(`Modelo "${filtered[index].name}" importado! Recarregando...`);
        window.location.reload();
      }
    }
  }

  importGlobalCharacter() {
    const globalChars = JSON.parse(localStorage.getItem('mythmaker_global_characters') ?? '[]');
    if (globalChars.length === 0) {
      alert('Nenhum personagem encontrado na biblioteca global.');
      return;
    }

    const titles = globalChars.map((c: any, i: number) => `${i + 1}. ${c.name}`).join('\n');
    const choice = prompt(`Selecione o personagem para importar:\n\n${titles}`);

    if (choice) {
      const index = parseInt(choice) - 1;
      const char = globalChars[index];
      if (char) {
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
        alert(`Personagem "${char.name}" importado com sucesso!`);
      }
    }
  }

  importGlobalNote() {
    const globalNotes = JSON.parse(localStorage.getItem('mythmaker_global_notes') ?? '[]');
    if (globalNotes.length === 0) {
      alert('Nenhuma anotação global encontrada.');
      return;
    }

    const titles = globalNotes.map((n: any, i: number) => `${i + 1}. ${n.title}`).join('\n');
    const choice = prompt(`Selecione a anotação para importar:\n\n${titles}`);

    if (choice) {
      const index = parseInt(choice) - 1;
      if (globalNotes[index]) {
        this.gmNotes.set(globalNotes[index].content);
        alert(`Anotação "${globalNotes[index].title}" importada! Não esqueça de salvar.`);
      }
    }
  }

  importGlobalItem() {
    const globalItems = JSON.parse(localStorage.getItem('mythmaker_global_items') ?? '[]');
    if (globalItems.length === 0) {
      alert('Nenhum item global encontrado.');
      return;
    }

    const titles = globalItems.map((i: any, idx: number) => `${idx + 1}. ${i.name} (${i.category})`).join('\n');
    alert(`Compêndio de Itens Globais:\n\n${titles}\n\nPara usar um item, copie suas propriedades para a ficha do personagem. Integração automática de inventário em breve!`);
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
    if (!confirm('Tem certeza que deseja excluir?')) return;
    
    const all: Character[] = JSON.parse(localStorage.getItem('mythmaker_characters') ?? '[]');
    const filtered = all.filter(c => c.id !== id);
    localStorage.setItem('mythmaker_characters', JSON.stringify(filtered));
    
    this.loadCharacters(this.campaignId()!);
    if (this.selectedCharId() === id) this.closeCharacter();
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
    if (tab === 'sistema') {
      this.activeSystemView.set('overview');
    }
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
    if (!confirm('Excluir este rastreador?')) return;
    this.dmTrackers.update(prev => prev.filter(t => t.id !== id));
    this.saveDMData();
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
      image: char.data['photo'] || char.data['foto'] || '', // Try to find common photo keys
      bars: [
        { label: 'Vida', current: 20, max: 20, color: '#e05a5a' }
      ]
    };
    this.dmTrackers.update(prev => [...prev, newTracker]);
    this.saveDMData();
    this.showImportModal.set(false);
    alert(`${char.name} exportado para o Escudo!`);
  }
}
