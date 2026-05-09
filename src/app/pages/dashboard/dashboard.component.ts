import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  userName = signal('Mestre das Lendas');
  campaignCount = signal(0);

  ngOnInit() {
    const saved = JSON.parse(localStorage.getItem('mythmaker_campaigns') ?? '[]');
    this.campaignCount.set(saved.length);
  }
}
