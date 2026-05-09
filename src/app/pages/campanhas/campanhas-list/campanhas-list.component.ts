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

  ngOnInit() {
    this.loadCampaigns();
  }

  loadCampaigns() {
    const saved = JSON.parse(localStorage.getItem('mythmaker_campaigns') ?? '[]');
    this.campaigns.set(saved);
  }

  deleteCampaign(id: string) {
    if (confirm('Tem certeza que deseja excluir esta campanha?')) {
      const filtered = this.campaigns().filter(c => c.id !== id);
      localStorage.setItem('mythmaker_campaigns', JSON.stringify(filtered));
      this.campaigns.set(filtered);
    }
  }
}
