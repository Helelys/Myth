import { Component, ChangeDetectionStrategy, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TabletopCanvasComponent } from './tabletop-canvas.component';
import { ViewChild } from '@angular/core';
import { TokenService } from './services';
import { TokenEditorPanelComponent } from './token-editor-panel.component';

/**
 * Página principal do Tabletop VTT.
 * Envolve o canvas em um layout com header e controles.
 *
 * Rota: /campanhas/:id/tabletop
 */
@Component({
  selector: 'app-tabletop',
  standalone: true,
  imports: [CommonModule, RouterLink, TabletopCanvasComponent, TokenEditorPanelComponent],
  template: `
    <div class="tabletop-page">
      <!-- Header -->
      <header class="vtt-header">
        <div class="header-left">
          <a [routerLink]="['/campanhas', campaignId]" class="back-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Voltar</span>
          </a>
          <h2>Virtual Tabletop</h2>
        </div>
        <div class="header-right">
          <button class="header-btn" title="Carregar Mapa" (click)="triggerMapUpload()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Mapa
          </button>
          <button class="header-btn" title="Adicionar Token" (click)="triggerTokenUpload()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.5"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            Token
          </button>
        </div>
      </header>

      <!-- Canvas -->
      <div class="canvas-wrapper">
        <app-tabletop-canvas #canvas />
      </div>

      <!-- Modal Global do Editor de Tokens -->
      @if (editingToken(); as token) {
        <app-token-editor-panel [token]="token" />
      }
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    .tabletop-page {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100vh;
      background: #0f0f1a;
      overflow: hidden;
    }
    .vtt-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px;
      background: #16162a;
      border-bottom: 1px solid #2a2a4a;
      flex-shrink: 0;
      z-index: 10;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .header-left h2 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      color: #e0e0e0;
    }
    .back-link {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #6a6a8a;
      text-decoration: none;
      font-size: 13px;
      padding: 4px 8px;
      border-radius: 4px;
      transition: color 0.15s;
    }
    .back-link:hover { color: #ccc; background: #1e1e3a; }
    .header-right {
      display: flex;
      gap: 8px;
    }
    .header-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: #1e1e3a;
      border: 1px solid #2a2a4a;
      border-radius: 6px;
      color: #aaa;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .header-btn:hover { background: #2a2a4a; color: #fff; border-color: #4a4a6a; }
    .canvas-wrapper {
      flex: 1;
      position: relative;
      overflow: hidden;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabletopComponent {
  @ViewChild('canvas') canvas!: TabletopCanvasComponent;
  
  private route = inject(ActivatedRoute);
  private tokenService = inject(TokenService);
  
  @Input() campaignId: string | null = null;
  readonly editingToken = this.tokenService.editingToken;

  constructor() {
    // Se não foi passado via @Input, tenta obter da rota
    if (!this.campaignId) {
      this.campaignId = this.route.snapshot.paramMap.get('id');
    }
  }

  triggerMapUpload(): void {
    if (this.canvas) {
      this.canvas.openMapUpload();
    }
  }

  triggerTokenUpload(): void {
    if (this.canvas) {
      this.canvas.openTokenUpload();
    }
  }
}
