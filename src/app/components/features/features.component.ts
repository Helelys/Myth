import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-features',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './features.component.html',
  styleUrl: './features.component.scss'
})
export class FeaturesComponent {
  featureList = [
    {
      icon: '⚔',
      title: 'Campanhas Organizadas',
      description: 'Tenha todas as suas campanhas em ordem e acessíveis.',
    },
    {
      icon: '⬡',
      title: 'Sistemas Personalizados',
      description: 'Crie seu próprio sistema de RPG do zero, sem limitações.',
    },
    {
      icon: '📋',
      title: 'Fichas Dinâmicas',
      description: 'Monte fichas completas com campos, cálculos e rolagens.',
    },
    {
      icon: '🐉',
      title: 'Monstros e Itens Ilimitados',
      description: 'Crie e gerencie seu bestiário e inventário sem limites.',
    },
    {
      icon: '📖',
      title: 'Anotações e Lore',
      description: 'Escreva sua história, crie mundos e mantenha tudo conectado.',
    },
    {
      icon: '👥',
      title: 'Feito para Comunidades',
      description: 'Compartilhe, colabore e jogue com sua mesa de forma fácil.',
    },
  ];

  highlights = [
    'Construtor de fichas por arrastar e soltar',
    'Gerencie itens, monstros e anotações',
    'Sistema de rolagem integrado',
    'Compartilhe com seus jogadores',
    'Funciona para qualquer sistema de RPG',
  ];
}
