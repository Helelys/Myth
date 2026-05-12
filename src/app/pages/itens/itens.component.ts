import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface GlobalItem {
  id: string;
  name: string;
  type: 'arma' | 'armadura' | 'acessorio';
  category: string;
  description: string;
  weight?: number;
  photo?: string;
  
  // Weapon specific
  dano?: string;
  tipoDano?: string;
  critico?: string; // x2, x3
  acertoCritico?: string; // 19, 20
  bonusDano?: string; // +3

  // Armor specific
  protecao?: string;
  bonus?: string;

  createdAt: number;
}

@Component({
  selector: 'app-itens',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './itens.component.html',
  styleUrl: './itens.component.scss'
})
export class ItensComponent implements OnInit {
  items = signal<GlobalItem[]>([]);
  campaigns = signal<any[]>([]);
  
  isEditing = signal(false);
  editingItem = signal<GlobalItem | null>(null);
  showTypeSelection = signal(false);
  
  // Form fields
  itemName = '';
  itemType: GlobalItem['type'] = 'arma';
  itemCategory = '';
  itemDescription = '';
  itemWeight = 0;
  itemPhoto = '';
  
  // Specific fields
  itemDano = '';
  itemTipoDano = '';
  itemCritico = 'x2';
  itemAcertoCritico = '20';
  itemBonusDano = '';
  itemProtecao = '';
  itemBonus = '';
  
  showImportModal = signal(false);
  showExportModal = signal(false);

  // Toast + Confirm
  notificationMessage = signal<string | null>(null);
  private notifTimeout: any = null;
  showConfirmModal = signal(false);
  confirmMessage = '';
  private confirmAction: (() => void) | null = null;

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.items.set(JSON.parse(localStorage.getItem('mythmaker_global_items') ?? '[]'));
    this.campaigns.set(JSON.parse(localStorage.getItem('mythmaker_campaigns') ?? '[]'));
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

  openTypeSelection() {
    this.showTypeSelection.set(true);
  }

  createNewItem(type: GlobalItem['type']) {
    this.showTypeSelection.set(false);
    this.isEditing.set(true);
    this.editingItem.set(null);
    this.itemType = type;
    
    // Reset fields
    this.itemName = '';
    this.itemCategory = '';
    this.itemDescription = '';
    this.itemWeight = 0;
    this.itemPhoto = '';
    this.itemDano = '';
    this.itemTipoDano = '';
    this.itemCritico = 'x2';
    this.itemAcertoCritico = '20';
    this.itemBonusDano = '';
    this.itemProtecao = '';
    this.itemBonus = '';
  }

  editItem(item: GlobalItem) {
    this.isEditing.set(true);
    this.editingItem.set(item);
    this.itemType = item.type;
    this.itemName = item.name;
    this.itemCategory = item.category || '';
    this.itemDescription = item.description;
    this.itemWeight = item.weight || 0;
    this.itemPhoto = item.photo || '';
    
    this.itemDano = item.dano || '';
    this.itemTipoDano = item.tipoDano || '';
    this.itemCritico = item.critico || 'x2';
    this.itemAcertoCritico = item.acertoCritico || '20';
    this.itemBonusDano = item.bonusDano || '';
    this.itemProtecao = item.protecao || '';
    this.itemBonus = item.bonus || '';
  }

  onPhotoChange(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.itemPhoto = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  saveItem() {
    if (!this.itemName.trim()) return;
    
    const all = [...this.items()];
    const editing = this.editingItem();

    const itemData: any = {
      name: this.itemName,
      type: this.itemType,
      category: this.itemCategory,
      description: this.itemDescription,
      weight: this.itemWeight,
      photo: this.itemPhoto,
      dano: this.itemDano,
      tipoDano: this.itemTipoDano,
      critico: this.itemCritico,
      acertoCritico: this.itemAcertoCritico,
      bonusDano: this.itemBonusDano,
      protecao: this.itemProtecao,
      bonus: this.itemBonus
    };

    if (editing) {
      const index = all.findIndex(i => i.id === editing.id);
      if (index !== -1) {
        all[index] = { ...editing, ...itemData };
      }
    } else {
      const newItem: GlobalItem = {
        id: crypto.randomUUID(),
        ...itemData,
        createdAt: Date.now()
      };
      all.push(newItem);
    }

    localStorage.setItem('mythmaker_global_items', JSON.stringify(all));
    this.items.set(all);
    this.cancelEdit();
  }

  deleteItem(id: string, event: MouseEvent) {
    event.stopPropagation();
    this.askConfirm('Excluir este item?', () => {
      const filtered = this.items().filter(i => i.id !== id);
      localStorage.setItem('mythmaker_global_items', JSON.stringify(filtered));
      this.items.set(filtered);
      this.showToast('Item excluído.');
    });
  }

  cancelEdit() {
    this.isEditing.set(false);
    this.editingItem.set(null);
  }

  importFromCampaign(campaignId: string) {
    this.showToast('Funcionalidade de importar itens de campanha será implementada em breve.');
    this.showImportModal.set(false);
  }

  exportToCampaign(campaignId: string) {
    this.showToast('Item exportado! Ele estará disponível para seleção em personagens da campanha.');
    this.showExportModal.set(false);
  }
}
