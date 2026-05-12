import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Campaign } from '../criar-campanha/criar-campanha.component';

@Component({
  selector: 'app-campanhas-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './campanhas-list.component.html',
  styleUrl: './campanhas-list.component.scss'
})
export class CampanhasListComponent implements OnInit {
  campaigns = signal<Campaign[]>([]);

  // Toast + Confirm
  notificationMessage = signal<string | null>(null);
  private notifTimeout: any = null;
  showConfirmModal = signal(false);
  confirmMessage = '';
  private confirmAction: (() => void) | null = null;

  ngOnInit() {
    this.loadCampaigns();
  }

  loadCampaigns() {
    const saved = JSON.parse(localStorage.getItem('mythmaker_campaigns') ?? '[]');
    this.campaigns.set(saved);
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

  deleteCampaign(id: string) {
    this.askConfirm('Tem certeza que deseja excluir esta campanha?', () => {
      const filtered = this.campaigns().filter(c => c.id !== id);
      localStorage.setItem('mythmaker_campaigns', JSON.stringify(filtered));
      this.campaigns.set(filtered);
      this.showToast('Campanha excluída.');
    });
  }
}
