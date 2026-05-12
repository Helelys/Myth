import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SheetBuilderComponent } from '../campanhas/sheet-builder/sheet-builder';

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
  templateId?: string;
  createdAt: number;
}

@Component({
  selector: 'app-personagens',
  standalone: true,
  imports: [CommonModule, FormsModule, SheetBuilderComponent],
  templateUrl: './personagens.component.html',
  styleUrl: './personagens.component.scss'
})
export class PersonagensComponent implements OnInit {
  templates = signal<SheetTemplate[]>([]);
  characters = signal<GlobalCharacter[]>([]);
  campaigns = signal<any[]>([]);

  activeView = signal<'templates' | 'characters' | 'template-editor'>('templates');

  // Export/Import modals
  showImportTemplateModal = signal(false);
  showExportTemplateModal = signal(false);
  showImportCharModal = signal(false);
  showExportCharModal = signal(false);

  selectedTemplate = signal<SheetTemplate | null>(null);
  selectedChar = signal<GlobalCharacter | null>(null);

  // Notification toast
  notificationMessage = signal<string | null>(null);
  private notifTimeout: any = null;

  // New template modal
  showNewTemplateModal = signal(false);
  newTemplateType: 'player' | 'monster' = 'player';
  newTemplateName = '';

  // Confirmation modal
  showConfirmModal = signal(false);
  confirmMessage = '';
  private confirmAction: (() => void) | null = null;

  // Import char modal - step 2 (pick character)
  showCharPickerModal = signal(false);
  campaignCharsForImport: any[] = [];

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.templates.set(JSON.parse(localStorage.getItem('mythmaker_global_templates') ?? '[]'));
    this.characters.set(JSON.parse(localStorage.getItem('mythmaker_global_characters') ?? '[]'));
    this.campaigns.set(JSON.parse(localStorage.getItem('mythmaker_campaigns') ?? '[]'));
  }

  // ── Toast ──

  private showToast(message: string) {
    if (this.notifTimeout) clearTimeout(this.notifTimeout);
    this.notificationMessage.set(message);
    this.notifTimeout = setTimeout(() => this.notificationMessage.set(null), 3000);
  }

  dismissToast() {
    this.notificationMessage.set(null);
    if (this.notifTimeout) clearTimeout(this.notifTimeout);
  }

  // ── Confirmation ──

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

  // ── TEMPLATES ──

  openNewTemplateModal(type: 'player' | 'monster') {
    if (this.templates().length >= 5) {
      this.showToast('Limite de 5 modelos atingido. Exclua um antes de criar outro.');
      return;
    }
    this.newTemplateType = type;
    this.newTemplateName = '';
    this.showNewTemplateModal.set(true);
  }

  confirmNewTemplate() {
    const name = this.newTemplateName.trim();
    if (!name) { this.showToast('Insira um nome para o modelo.'); return; }

    const newTemplate: SheetTemplate = {
      id: crypto.randomUUID(),
      name: name,
      type: this.newTemplateType,
      schema: null,
      createdAt: Date.now()
    };

    const all = [...this.templates(), newTemplate];
    localStorage.setItem('mythmaker_global_templates', JSON.stringify(all));
    this.templates.set(all);
    this.showNewTemplateModal.set(false);
    this.showToast('Modelo criado com sucesso!');
    this.editTemplate(newTemplate);
  }

  editTemplate(template: SheetTemplate) {
    this.selectedTemplate.set(template);
    this.activeView.set('template-editor');
  }

  deleteTemplate(id: string, event: MouseEvent) {
    event.stopPropagation();
    this.askConfirm('Excluir este modelo de ficha?', () => {
      const filtered = this.templates().filter(t => t.id !== id);
      localStorage.setItem('mythmaker_global_templates', JSON.stringify(filtered));
      this.templates.set(filtered);
      this.showToast('Modelo excluído.');
    });
  }

  importTemplateFromCampaign(campaignId: string, type: 'player' | 'monster') {
    if (this.templates().length >= 5) {
      this.showToast('Limite de 5 modelos atingido. Exclua um antes de importar.');
      return;
    }

    const campaign = this.campaigns().find(c => c.id === campaignId);
    const key = `mythmaker_sheet2_${type}_${campaignId}`;
    const templateData = localStorage.getItem(key);

    if (!templateData) {
      this.showToast(`Nenhum modelo de ${type === 'player' ? 'jogador' : 'monstro'} encontrado nesta campanha.`);
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
    this.showToast('Modelo importado com sucesso!');
  }

  exportTemplateToCampaign(campaignId: string) {
    const template = this.selectedTemplate();
    if (!template) return;

    if (template.schema) {
      const key = `mythmaker_sheet2_${template.type}_${campaignId}`;
      localStorage.setItem(key, JSON.stringify(template.schema));
    }
    this.showExportTemplateModal.set(false);
    this.showToast('Modelo exportado para a campanha com sucesso!');
  }

  // ── CHARACTERS ──

  deleteCharacter(id: string, event: MouseEvent) {
    event.stopPropagation();
    this.askConfirm('Excluir este personagem global?', () => {
      const filtered = this.characters().filter(c => c.id !== id);
      localStorage.setItem('mythmaker_global_characters', JSON.stringify(filtered));
      this.characters.set(filtered);
      this.showToast('Personagem excluído.');
    });
  }

  openCharPickerForCampaign(campaignId: string) {
    const allChars = JSON.parse(localStorage.getItem('mythmaker_characters') ?? '[]');
    const campaignChars = allChars.filter((c: any) => c.campaignId === campaignId);

    if (campaignChars.length === 0) {
      this.showToast('Nenhum personagem encontrado nesta campanha.');
      return;
    }

    this.campaignCharsForImport = campaignChars;
    this.showCharPickerModal.set(true);
  }

  importChar(campaignChar: any) {
    const newChar: GlobalCharacter = {
      id: crypto.randomUUID(),
      name: campaignChar.name,
      data: campaignChar.data,
      isMonster: !!campaignChar.isMonster,
      createdAt: Date.now()
    };

    const all = [...this.characters(), newChar];
    localStorage.setItem('mythmaker_global_characters', JSON.stringify(all));
    this.characters.set(all);
    this.showCharPickerModal.set(false);
    this.showImportCharModal.set(false);
    this.showToast('Personagem importado para a biblioteca global!');
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
    this.showToast('Personagem exportado para a campanha!');
  }
}
