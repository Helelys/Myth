import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-how-it-works',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './how-it-works.component.html',
  styleUrl: './how-it-works.component.scss'
})
export class HowItWorksComponent {
  steps = [
    {
      number: '01',
      title: 'Crie sua campanha',
      description: 'Dê vida ao seu mundo e convide seus jogadores.',
    },
    {
      number: '02',
      title: 'Monte seu sistema',
      description: 'Crie fichas, regras, itens e tudo que você precisa.',
    },
    {
      number: '03',
      title: 'Prepare suas aventuras',
      description: 'Adicione NPCs, monstros, locações e anotações.',
    },
    {
      number: '04',
      title: 'Jogue e aproveite',
      description: 'Use as ferramentas para focar no que importa: a diversão.',
    },
  ];
}
