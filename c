import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReportModalComponent } from '../support/report-modal/report-modal.component';

interface FooterLink {
  label: string;
  route: string | null;
}

interface FooterColumn {
  title: string;
  links: FooterLink[];
}

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterModule, ReportModalComponent],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss'
})
export class FooterComponent {
  footerColumns: FooterColumn[] = [
    {
      title: 'Produto',
      links: [
        { label: 'Recursos', route: null },
        { label: 'Preços', route: '/precos' },
      ],
    },
  ];

  showReport = signal(false);

  currentYear = new Date().getFullYear();
}
