import { Component } from '@angular/core';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { FooterComponent } from '../../components/footer/footer.component';
import { HeroComponent } from '../../components/hero/hero.component';
import { FeaturesComponent } from '../../components/features/features.component';
import { HowItWorksComponent } from '../../components/how-it-works/how-it-works.component';
import { CtaBannerComponent } from '../../components/cta-banner/cta-banner.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    NavbarComponent,
    FooterComponent,
    HeroComponent,
    FeaturesComponent,
    HowItWorksComponent,
    CtaBannerComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {}
