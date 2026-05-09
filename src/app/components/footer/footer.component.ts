import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss'
})
export class FooterComponent {
  footerColumns = [
    {
      title: 'Produto',
      links: ['Recursos', 'Templates', 'Preços', 'Atualizações'],
    },
    {
      title: 'Comunidade',
      links: ['Blog', 'Fórum', 'Eventos', 'Criadores'],
    },
    {
      title: 'Suporte',
      links: ['Central de Ajuda', 'Tutoriais', 'Contato', 'Status'],
    },
  ];

  currentYear = new Date().getFullYear();
}
