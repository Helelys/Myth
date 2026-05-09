import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.scss'
})
export class HeroComponent {
  badges = [
    { icon: '✦', label: '100% Personalizável' },
    { icon: '⬡', label: 'Para qualquer sistema' },
    { icon: '◈', label: 'Feito por mestres' },
  ];
}
