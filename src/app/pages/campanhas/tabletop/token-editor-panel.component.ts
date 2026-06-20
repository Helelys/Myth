import { Component, ChangeDetectionStrategy, Input, inject, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Token, TokenBar, TokenArmor, TokenVision, BAR_COLORS, createDefaultBar } from './models';
import { TokenService } from './services';

type EditorTab = 'basic' | 'vision';

@Component({
  selector: 'app-token-editor-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay">
      <div class="backdrop" (click)="closeEditor()"></div>
      <aside class="token-editor-modal">
        <div class="editor-sidebar">
          <div class="image-preview">
            <div class="img-container">
              <img *ngIf="token.image" [src]="token.image" alt="Token" />
              <div class="img-placeholder" *ngIf="!token.image">{{ token.name.substring(0, 2).toUpperCase() }}</div>
            </div>
            <button class="action-btn outline" (click)="openImageUpload()">Alterar Imagem</button>
            <input #imageInput type="file" accept="image/png, image/jpeg, image/webp" hidden (change)="handleImageUpload($event)" />
          </div>
          
          <nav class="editor-tabs">
            <button class="tab-btn" [class.active]="activeTab() === 'basic'" (click)="activeTab.set('basic')">
              📋 Básico
            </button>
            <button class="tab-btn" [class.active]="activeTab() === 'vision'" (click)="activeTab.set('vision')">
              Iluminação
            </button>
          </nav>
          
          <div class="editor-section actions">
            <button class="action-btn" (click)="bringToFront()">↑ Trazer para Frente</button>
            <button class="action-btn" (click)="sendToBack()">↓ Enviar para Trás</button>
            <button class="action-btn danger-solid" (click)="deleteToken()">🗑 Excluir Token</button>
          </div>
        </div>

        <div class="editor-main">
          <div class="editor-header">
            <h3>{{ tabTitle }}</h3>
            <button class="close-btn" (click)="closeEditor()" title="Fechar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div class="editor-scroll-area">
            @if (activeTab() === 'basic') {
              <section class="editor-section">
                <div class="section-header">
                  <h4 class="section-title">Identidade</h4>
                </div>
                <div class="field-group">
                  <label>Nome do Token</label>
                  <input type="text" [value]="token.name" (input)="updateName($event)" />
                </div>
              </section>

              <section class="editor-section">
                <div class="section-header">
                  <h4 class="section-title">Aura</h4>
                </div>
                <div class="field-row">
                  <div class="field-group">
                    <label>Cor</label>
                    <input type="color" [value]="token.auraColor" (input)="updateColor($event, 'auraColor')" />
                  </div>
                  <div class="field-group">
                    <label>Raio (px)</label>
                    <input type="number" [value]="token.auraRadius" (input)="updateNumber($event, 'auraRadius')" min="0" step="5" />
                  </div>
                </div>
              </section>

              <section class="editor-section">
                <div class="section-header">
                  <h4 class="section-title">Barras</h4>
                  <button class="add-btn" (click)="addBar()" *ngIf="token.bars.length < 3">+ Adicionar Barra</button>
                </div>
                
                <div class="bar-list">
                  <div class="bar-item" *ngFor="let bar of token.bars; let i = index; trackBy: trackByBar">
                    <div class="bar-controls">
                      <input type="color" class="color-picker" [value]="bar.color" (input)="updateBarColor(bar.id, $event)" title="Cor da barra"/>
                      <input type="text" class="bar-label-input" [value]="bar.label" (input)="updateBarLabel(bar.id, $event)" placeholder="Ex: HP"/>
                      <button class="icon-btn danger" (click)="removeBar(bar.id)" title="Remover">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                      </button>
                    </div>
                    <div class="bar-values">
                      <input type="number" class="val-input" [value]="bar.value" (input)="updateBarValue(bar.id, 'value', $event)" />
                      <span class="sep">/</span>
                      <input type="number" class="val-input" [value]="bar.maxValue" (input)="updateBarValue(bar.id, 'maxValue', $event)" />
                    </div>
                  </div>
                </div>
              </section>

              <section class="editor-section">
                <div class="section-header">
                  <h4 class="section-title">Defesa</h4>
                  <label class="toggle-checkbox">
                    <input type="checkbox" [checked]="token.armor?.enabled" (change)="updateArmorEnabled($event)" />
                    Exibir Armadura
                  </label>
                </div>

                <div class="field-row" *ngIf="token.armor?.enabled">
                  <div class="field-group">
                    <label>Rótulo</label>
                    <input type="text" [value]="token.armor?.label" (input)="updateArmorLabel($event)" placeholder="CA" />
                  </div>
                  <div class="field-group">
                    <label>Valor</label>
                    <input type="number" [value]="token.armor?.value" (input)="updateArmorValue($event)" placeholder="10" />
                  </div>
                </div>
              </section>
            }

            @if (activeTab() === 'vision') {
              <section class="editor-section">
                <div class="section-header">
                  <h4 class="section-title">Iluminação</h4>
                  <label class="toggle-checkbox">
                    <input type="checkbox" [checked]="token.vision?.enabled" (change)="toggleVisionEnabled($event)" />
                    Ativar
                  </label>
                </div>

                @if (token.vision?.enabled) {
                  <div class="field-group">
                    <label>Tipo de Iluminação</label>
                    <select [value]="token.vision?.type ?? 'radial'" (change)="updateVisionField('type', $event)">
                      <option value="radial">🌐 Área Circular (Iluminação padrão)</option>
                      <option value="cone">🔦 Lanterna (Área em cone)</option>
                    </select>
                  </div>

                  <div class="field-group">
                    <label>Alcance (px)</label>
                    <input type="range" [value]="token.vision?.radius ?? 200" (input)="updateVisionField('radius', $event)" min="20" max="800" step="10" />
                    <span class="range-value">{{ token.vision?.radius ?? 200 }}px</span>
                  </div>

                  <div class="field-group">
                    <label>Suavidade da borda</label>
                    <input type="range" [value]="token.vision?.softness ?? 0.5" (input)="updateVisionField('softness', $event)" min="0" max="1" step="0.05" />
                    <span class="range-value">{{ ((token.vision?.softness ?? 0.5) * 100).toFixed(0) }}%</span>
                    <div class="field-hint">Mais suavidade = borda mais desfocada. 0% = borda dura, 100% = extremamente suave.</div>
                  </div>

                  <div class="field-group">
                    <label>Intensidade da Luz</label>
                    <input type="range" [value]="token.vision?.intensity ?? 0.8" (input)="updateVisionField('intensity', $event)" min="0" max="1" step="0.05" />
                    <span class="range-value">{{ ((token.vision?.intensity ?? 0.8) * 100).toFixed(0) }}%</span>
                  </div>

                  <div class="field-group">
                    <label>Cor da Luz</label>
                    <input type="color" [value]="token.vision?.color ?? '#ffdd88'" (input)="updateVisionField('color', $event)" />
                  </div>
                } @else {
                  <div class="info-box dim">
                    Ative a visão para que o token possa ver e iluminar o ambiente.<br />
                    <small>A iluminação respeita paredes, portas e line of sight.</small>
                  </div>
                }
              </section>
            }
          </div>
        </div>
      </aside>
    </div>
  `,
  styleUrls: ['./token-editor-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TokenEditorPanelComponent {
  @Input({ required: true }) token!: Token;
  @ViewChild('imageInput') imageInput!: ElementRef<HTMLInputElement>;
  private tokenService = inject(TokenService);

  readonly Math = Math;

  /** Aba ativa no editor */
  readonly activeTab = signal<EditorTab>('basic');

  /** Título da aba atual */
  get tabTitle(): string {
    switch (this.activeTab()) {
      case 'vision': return 'Configuração de Visão e Iluminação';
      default: return 'Configurações do Token';
    }
  }

  closeEditor(): void {
    this.tokenService.closeEditor();
  }

  updateToken(partial: Partial<Token>): void {
    this.tokenService.updateToken(this.token.id, partial);
  }

  updateArmor(partial: Partial<TokenArmor>): void {
    const armor = { ...this.token.armor, ...partial } as TokenArmor;
    this.updateToken({ armor });
  }

  updateName(event: Event): void {
    this.updateToken({ name: (event.target as HTMLInputElement).value });
  }

  updateColor(event: Event, field: 'auraColor'): void {
    this.updateToken({ [field]: (event.target as HTMLInputElement).value });
  }

  updateNumber(event: Event, field: 'auraRadius'): void {
    const val = Number((event.target as HTMLInputElement).value) || 0;
    this.updateToken({ [field]: val });
  }

  updateArmorEnabled(event: Event): void {
    this.updateArmor({ enabled: (event.target as HTMLInputElement).checked });
  }

  updateArmorLabel(event: Event): void {
    this.updateArmor({ label: (event.target as HTMLInputElement).value });
  }

  updateArmorValue(event: Event): void {
    this.updateArmor({ value: Number((event.target as HTMLInputElement).value) || 0 });
  }

  openImageUpload(): void {
    this.imageInput.nativeElement.click();
  }

  handleImageUpload(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      this.updateToken({ image: e.target?.result as string });
      target.value = '';
    };
    reader.readAsDataURL(file);
  }

  updateBar(barId: string, partial: Partial<TokenBar>): void {
    const bars = this.token.bars.map(b => b.id === barId ? { ...b, ...partial } : b);
    this.updateToken({ bars });
  }

  updateBarLabel(barId: string, event: Event): void {
    this.updateBar(barId, { label: (event.target as HTMLInputElement).value });
  }

  updateBarColor(barId: string, event: Event): void {
    this.updateBar(barId, { color: (event.target as HTMLInputElement).value });
  }

  updateBarValue(barId: string, field: 'value' | 'maxValue', event: Event): void {
    this.updateBar(barId, { [field]: Number((event.target as HTMLInputElement).value) || 0 });
  }

  trackByBar(index: number, bar: TokenBar): string {
    return bar.id;
  }

  addBar(): void {
    if (this.token.bars.length >= 3) return;
    const defaultColor = BAR_COLORS[this.token.bars.length % BAR_COLORS.length].color;
    const newBar = createDefaultBar('Nova', defaultColor, 10, 10);
    this.updateToken({ bars: [...this.token.bars, newBar] });
  }

  removeBar(barId: string): void {
    this.updateToken({ bars: this.token.bars.filter(b => b.id !== barId) });
  }

  bringToFront(): void {
    this.tokenService.bringToFront(this.token.id);
  }

  sendToBack(): void {
    this.tokenService.sendToBack(this.token.id);
  }

  deleteToken(): void {
    this.tokenService.removeToken(this.token.id);
    this.closeEditor();
  }

  toggleVisionEnabled(event: Event): void {
    const enabled = (event.target as HTMLInputElement).checked;
    if (enabled) {
      if (!this.token.vision) {
        this.tokenService.setTokenVision(this.token.id, {
          enabled: true,
          radius: 200,
          type: 'radial',
          softness: 0.5,
          intensity: 0.8,
          color: '#ffdd88',
          rotation: 0,
          angle: Math.PI / 3,
        });
      } else {
        this.tokenService.setTokenVision(this.token.id, { ...this.token.vision, enabled: true });
      }
    } else {
      this.tokenService.removeTokenVision(this.token.id);
    }
  }

  updateVisionField(field: string, event: Event): void {
    const target = event.target as HTMLInputElement;
    const vision = this.token.vision;
    if (!vision) return;

    let value: any;
    if (field === 'radius' || field === 'softness' || field === 'intensity') {
      value = Number(target.value);
    } else if (field === 'type') {
      value = target.value as 'radial' | 'cone';
    } else {
      value = target.value;
    }

    const changes = { [field]: value } as Partial<TokenVision>;

    if (field === 'type' && value === 'cone' && !vision.angle) {
      changes.angle = Math.PI / 3;
    }

    this.tokenService.setTokenVision(this.token.id, { ...vision, ...changes });
  }
}
