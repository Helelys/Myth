import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

export interface System {
  id: string;
  title: string;
  content: string;
  createdAt: number;
}

@Component({
  selector: 'app-sistemas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './sistemas.component.html',
  styleUrl: './sistemas.component.scss'
})
export class SistemasComponent implements OnInit {
  systems = signal<System[]>([]);
  isEditing = signal(false);
  editingSystem = signal<System | null>(null);

  // Form fields
  systemTitle = '';
  systemContent = '';

  // Campaigns for import/export
  campaigns = signal<any[]>([]);
  showImportModal = signal(false);
  showExportModal = signal(false);
  systemToExport = signal<System | null>(null);

  ngOnInit() {
    this.loadSystems();
    this.loadCampaigns();
  }

  loadSystems() {
    const saved = JSON.parse(localStorage.getItem('mythmaker_global_systems') ?? '[]');
    this.systems.set(saved);
  }

  loadCampaigns() {
    const saved = JSON.parse(localStorage.getItem('mythmaker_campaigns') ?? '[]');
    this.campaigns.set(saved);
  }

  createNewSystem() {
    this.isEditing.set(true);
    this.editingSystem.set(null);
    this.systemTitle = '';
    this.systemContent = '';
  }

  editSystem(system: System) {
    this.isEditing.set(true);
    this.editingSystem.set(system);
    this.systemTitle = system.title;
    this.systemContent = system.content;
  }

  saveSystem() {
    if (!this.systemTitle.trim()) {
      alert('Por favor, insira um título.');
      return;
    }

    const all = [...this.systems()];
    const editing = this.editingSystem();

    if (editing) {
      const index = all.findIndex(s => s.id === editing.id);
      if (index !== -1) {
        all[index] = {
          ...editing,
          title: this.systemTitle,
          content: this.systemContent
        };
      }
    } else {
      const newSystem: System = {
        id: crypto.randomUUID(),
        title: this.systemTitle,
        content: this.systemContent,
        createdAt: Date.now()
      };
      all.push(newSystem);
    }

    localStorage.setItem('mythmaker_global_systems', JSON.stringify(all));
    this.systems.set(all);
    this.cancelEdit();
    alert('Sistema salvo com sucesso!');
  }

  deleteSystem(id: string, event: MouseEvent) {
    event.stopPropagation();
    if (!confirm('Tem certeza que deseja excluir este sistema?')) return;

    const filtered = this.systems().filter(s => s.id !== id);
    localStorage.setItem('mythmaker_global_systems', JSON.stringify(filtered));
    this.systems.set(filtered);
  }

  cancelEdit() {
    this.isEditing.set(false);
    this.editingSystem.set(null);
  }

  toggleImportModal() {
    this.showImportModal.update(v => !v);
  }

  toggleExportModal(system: System | null = null) {
    this.systemToExport.set(system);
    this.showExportModal.update(v => !v);
  }

  importFromCampaign(campaignId: string) {
    const campaign = this.campaigns().find(c => c.id === campaignId);
    if (!campaign) return;

    const systemData = JSON.parse(localStorage.getItem(`mythmaker_system_${campaignId}`) ?? '{}');
    if (!systemData.rules) {
      alert('Esta campanha não possui regras de sistema para importar.');
      return;
    }

    const newSystem: System = {
      id: crypto.randomUUID(),
      title: `Importado: ${campaign.nome}`,
      content: systemData.rules,
      createdAt: Date.now()
    };

    const all = [...this.systems(), newSystem];
    localStorage.setItem('mythmaker_global_systems', JSON.stringify(all));
    this.systems.set(all);
    this.showImportModal.set(false);
    alert('Sistema importado com sucesso!');
  }

  confirmExport(campaignId: string) {
    const system = this.systemToExport();
    if (!system) return;

    const campaign = this.campaigns().find(c => c.id === campaignId);
    if (!campaign) return;

    const systemData = JSON.parse(localStorage.getItem(`mythmaker_system_${campaignId}`) ?? '{}');
    systemData.rules = system.content;
    localStorage.setItem(`mythmaker_system_${campaignId}`, JSON.stringify(systemData));
    
    this.showExportModal.set(false);
    alert(`Sistema exportado para a campanha "${campaign.nome}" com sucesso!`);
  }

  exportToCampaign(system: System) {
    this.toggleExportModal(system);
  }

  // Helper to get campaign name (mock or real)
  getCampaignName(id: string) {
    return this.campaigns().find(c => c.id === id)?.nome || 'Campanha Desconhecida';
  }
}
