import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { AppLayoutComponent } from './layouts/app-layout/app-layout.component';
import { CriarCampanhaComponent } from './pages/campanhas/criar-campanha/criar-campanha.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { CampanhasListComponent } from './pages/campanhas/campanhas-list/campanhas-list.component';
import { CampaignDetailComponent } from './pages/campanhas/campaign-detail/campaign-detail.component';
import { SistemasComponent } from './pages/sistemas/sistemas.component';
import { PersonagensComponent } from './pages/personagens/personagens.component';
import { AnotacoesComponent } from './pages/anotacoes/anotacoes.component';
import { ItensComponent } from './pages/itens/itens.component';
import { DadosComponent } from './pages/dados/dados.component';
import { PrecosComponent } from './pages/precos/precos.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, pathMatch: 'full' },
  { path: 'precos', component: PrecosComponent },
  {
    path: '',
    component: AppLayoutComponent,
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'campanhas', component: CampanhasListComponent },
      { path: 'campanhas/criar', component: CriarCampanhaComponent },
      { path: 'campanhas/:id', component: CampaignDetailComponent },
      { path: 'sistemas', component: SistemasComponent },
      { path: 'personagens', component: PersonagensComponent },
      { path: 'anotacoes', component: AnotacoesComponent },
      { path: 'itens', component: ItensComponent },
      { path: 'dados', component: DadosComponent },
      { path: 'campanhas/:id/gerador-missao', loadComponent: () => import('./pages/campanhas/mission-generator/mission-generator.component').then(m => m.MissionGeneratorComponent) },
    ]
  },
];
