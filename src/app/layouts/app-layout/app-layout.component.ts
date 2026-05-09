import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './app-layout.component.html',
  styleUrl: './app-layout.component.scss'
})
export class AppLayoutComponent {
  isSidebarCollapsed = signal(false);
  isMobileMenuOpen = signal(false);

  toggleSidebar() {
    this.isSidebarCollapsed.update(v => !v);
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen.update(v => !v);
  }

  closeMobileMenu() {
    this.isMobileMenuOpen.set(false);
  }

  navItems = [
    { label: 'Dashboard',       icon: 'dashboard',    route: '/dashboard' },
    { label: 'Campanhas',       icon: 'campaigns',    route: '/campanhas' },
    { label: 'Sistemas',        icon: 'systems',      route: '/sistemas' },
    { label: 'Personagens',     icon: 'characters',   route: '/personagens' },
    { label: 'Itens',           icon: 'items',        route: '/itens' },
    { label: 'Anotações',       icon: 'notes',        route: '/anotacoes' },
    { label: 'Dados de Rolagem',icon: 'dice',         route: '/dados' },
  ];
}
