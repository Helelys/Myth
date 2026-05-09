import { Component, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
  scrolled = signal(false);
  menuOpen = signal(false);

  navLinks = [
    { label: 'Recursos', href: '#recursos' },
    { label: 'Preços', href: '#precos' },
    { label: 'Templates', href: '#templates' },
    { label: 'Blog', href: '#blog' },
    { label: 'Comunidade', href: '#comunidade' },
  ];

  @HostListener('window:scroll')
  onScroll() {
    this.scrolled.set(window.scrollY > 20);
  }

  toggleMenu() {
    this.menuOpen.update(v => !v);
  }
}
