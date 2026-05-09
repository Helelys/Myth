import { Component, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Campaign } from '../criar-campanha/criar-campanha.component';
import { SheetEditorComponent } from '../sheet-editor/sheet-editor.component';
import { PlayerSheetComponent, Character } from '../player-sheet/player-sheet.component';

type Tab = 'sistema' | 'personagens' | 'combates' | 'escudo';
type SystemView = 'overview' | 'ficha' | 'ficha-monstro' | 'regras' | 'anotacoes';

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
      }
    }
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
}
