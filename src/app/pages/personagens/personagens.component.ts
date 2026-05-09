import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SheetEditorComponent } from '../campanhas/sheet-editor/sheet-editor.component';

export interface SheetTemplate {
  id: string;
  name: string;
  type: 'player' | 'monster';
  schema: any;
  createdAt: number;
}

export interface GlobalCharacter {
  id: string;
  name: string;
  data: Record<string, any>;
  isMonster: boolean;
  templateId?: string; // Optional reference
  createdAt: number;
}

@Component({
  selector: 'app-personagens',
  standalone: true,
  imports: [CommonModule, FormsModule, SheetEditorComponent],
  templateUrl: './personagens.component.html',
  styleUrl: './personagens.component.scss'
})
export class PersonagensComponent implements OnInit {
  templates = signal<SheetTemplate[]>([]);
  characters = signal<GlobalCharacter[]>([]);
  campaigns = signal<any[]>([]);

  activeView = signal<'templates' | 'characters' | 'template-editor'>('templates');
  
  // Modals
  showImportTemplateModal = signal(false);
  showExportTemplateModal = signal(false);
  showImportCharModal = signal(false);
  showExportCharModal = signal(false);

  selectedTemplate = signal<SheetTemplate | null>(null);
  selectedChar = signal<GlobalCharacter | null>(null);

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.templates.set(JSON.parse(localStorage.getItem('mythmaker_global_templates') ?? '[]'));
    this.characters.set(JSON.parse(localStorage.getItem('mythmaker_global_characters') ?? '[]'));
    this.campaigns.set(JSON.parse(localStorage.getItem('mythmaker_campaigns') ?? '[]'));
  }

  // --- TEMPLATES ---

  createNewTemplate(type: 'player' | 'monster' = 'player') {
    const name = prompt('Nome do novo modelo de ficha:', 'Novo Modelo');
    if (!name) return;

    const newTemplate: SheetTemplate = {
      id: crypto.randomUUID(),
      name: name,
      type: type,
      schema: { tabs: [{ id: 'tab-1', label: 'Principal' }], components: [], settings: { backgroundColor: '#1c1c24', accentColor: '#ffffff' } },
      createdAt: Date.now()
    };

    const all = [...this.templates(), newTemplate];
    localStorage.setItem('mythmaker_global_templates', JSON.stringify(all));
    this.templates.set(all);
    this.editTemplate(newTemplate);
  }

  editTemplate(template: SheetTemplate) {
    this.selectedTemplate.set(template);
    this.activeView.set('template-editor');
  }

  deleteTemplate(id: string, event: MouseEvent) {
    event.stopPropagation();
    if (!confirm('Excluir este modelo de ficha?')) return;
    const filtered = this.templates().filter(t => t.id !== id);
    localStorage.setItem('mythmaker_global_templates', JSON.stringify(filtered));
    this.templates.set(filtered);
  }

  importTemplateFromCampaign(campaignId: string, type: 'player' | 'monster') {
    const campaign = this.campaigns().find(c => c.id === campaignId);
    const templateData = localStorage.getItem(`mythmaker_template_${type}_${campaignId}`);
    
    if (!templateData) {
      alert(`Nenhum modelo de ${type === 'player' ? 'jogador' : 'monstro'} encontrado nesta campanha.`);
      return;
    }

    const newTemplate: SheetTemplate = {
      id: crypto.randomUUID(),
      name: `${campaign.nome} - ${type === 'player' ? 'Jogador' : 'Monstro'}`,
      type: type,
      schema: JSON.parse(templateData),
      createdAt: Date.now()
    };

    const all = [...this.templates(), newTemplate];
    localStorage.setItem('mythmaker_global_templates', JSON.stringify(all));
    this.templates.set(all);
    this.showImportTemplateModal.set(false);
    alert('Modelo importado com sucesso!');
  }

  exportTemplateToCampaign(campaignId: string) {
    const template = this.selectedTemplate();
    if (!template) return;

    localStorage.setItem(`mythmaker_template_${template.type}_${campaignId}`, JSON.stringify(template.schema));
    this.showExportTemplateModal.set(false);
    alert('Modelo exportado para a campanha com sucesso!');
  }

  // --- CHARACTERS ---

  deleteCharacter(id: string, event: MouseEvent) {
    event.stopPropagation();
    if (!confirm('Excluir este personagem global?')) return;
    const filtered = this.characters().filter(c => c.id !== id);
    localStorage.setItem('mythmaker_global_characters', JSON.stringify(filtered));
    this.characters.set(filtered);
  }

  importCharFromCampaign(campaignId: string) {
    const allChars = JSON.parse(localStorage.getItem('mythmaker_characters') ?? '[]');
    const campaignChars = allChars.filter((c: any) => c.campaignId === campaignId);

    if (campaignChars.length === 0) {
      alert('Nenhum personagem encontrado nesta campanha.');
      return;
    }

    const names = campaignChars.map((c: any, i: number) => `${i + 1}. ${c.name}`).join('\n');
    const choice = prompt(`Selecione o personagem para importar:\n\n${names}`);

    if (choice) {
      const index = parseInt(choice) - 1;
      const char = campaignChars[index];
      if (char) {
        const newChar: GlobalCharacter = {
          id: crypto.randomUUID(),
          name: char.name,
          data: char.data,
          isMonster: !!char.isMonster,
          createdAt: Date.now()
        };
        const all = [...this.characters(), newChar];
        localStorage.setItem('mythmaker_global_characters', JSON.stringify(all));
        this.characters.set(all);
        this.showImportCharModal.set(false);
        alert('Personagem importado para a biblioteca global!');
      }
    }
  }

  exportCharToCampaign(campaignId: string) {
    const char = this.selectedChar();
    if (!char) return;

    const allChars = JSON.parse(localStorage.getItem('mythmaker_characters') ?? '[]');
    const newChar = {
      id: crypto.randomUUID(),
      campaignId: campaignId,
      name: char.name,
      data: char.data,
      isMonster: char.isMonster
    };

    allChars.push(newChar);
    localStorage.setItem('mythmaker_characters', JSON.stringify(allChars));
    this.showExportCharModal.set(false);
    alert('Personagem exportado para a campanha!');
  }
}
