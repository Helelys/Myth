import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-cta-banner',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './cta-banner.component.html',
  styleUrl: './cta-banner.component.scss'
})
export class CtaBannerComponent {}
