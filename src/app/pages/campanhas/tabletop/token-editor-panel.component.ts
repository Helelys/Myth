import { Component, ChangeDetectionStrategy, Input, inject, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Token, TokenBar, TokenArmor, TokenLight, TokenVision, BAR_COLORS, createDefaultBar } from './models';
import { TokenService } from './services';

type EditorTab = 'basic' | 'light' | 'vision';

/**
 * ═══════════════════════════════════════════════════════════
 * TOKEN EDITOR — Configurações do Token
 * ═══════════════════════════════════════════════════════════
 *
 * Abas:
 *   📋 Básico   — Nome, imagem, aura, barras, armadura
 *   💡 Iluminação — Luz emitida pelo token (radial/cone)
 *   👁  Visão     — Campo de visão (darkvision, blindsight, cone)
 *
 * Iluminação e Visão são independentes:
 *   Token pode iluminar sem enxergar (tocha)
 *   Token pode enxergar sem iluminar (darkvision)
 */
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
          
          <!-- Abas de navegação -->
          <nav class="editor-tabs">
            <button class="tab-btn" [class.active]="activeTab() === 'basic'" (click)="activeTab.set('basic')">
              📋 Básico
            </button>
            <button class="tab-btn" [class.active]="activeTab() === 'light'" (click)="activeTab.set('light')">
              💡 Iluminação
            </button>
            <button class="tab-btn" [class.active]="activeTab() === 'vision'" (click)="activeTab.set('vision')">
              👁 Visão
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
            <!-- ════════════════════════════════════════ -->
            <!-- ABA 1: BÁSICO -->
            <!-- ════════════════════════════════════════ -->
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

            <!-- ════════════════════════════════════════ -->
            <!-- ABA 2: ILUMINAÇÃO -->
            <!-- ════════════════════════════════════════ -->
            @if (activeTab() === 'light') {
              <section class="editor-section">
                <div class="section-header">
                  <h4 class="section-title">💡 Iluminação do Token</h4>
                  <label class="toggle-checkbox">
                    <input type="checkbox" [checked]="token.light?.enabled" (change)="toggleLightEnabled($event)" />
                    Ativar Luz
                  </label>
                </div>

                @if (token.light?.enabled) {
                  <div class="field-group">
                    <label>Tipo de Luz</label>
                    <select [value]="token.light?.type" (change)="updateLightField('type', $event)">
                      <option value="radial">🌐 Radial (360°)</option>
                      <option value="cone">🔦 Cone (Lanterna)</option>
                    </select>
                  </div>

                  <div class="field-group">
                    <label>Alcance (px)</label>
                    <input type="range" [value]="token.light?.radius ?? 100" (input)="updateLightField('radius', $event)" min="20" max="800" step="10" />
                    <span class="range-value">{{ token.light?.radius ?? 100 }}px</span>
                  </div>

                  <div class="field-group">
                    <label>Intensidade</label>
                    <input type="range" [value]="token.light?.intensity ?? 0.8" (input)="updateLightField('intensity', $event)" min="0" max="1" step="0.05" />
                    <span class="range-value">{{ ((token.light?.intensity ?? 0.8) * 100).toFixed(0) }}%</span>
                  </div>

                  <div class="field-group">
                    <label>Suavidade da Borda</label>
                    <input type="range" [value]="token.light?.softness ?? 0.4" (input)="updateLightField('softness', $event)" min="0" max="1" step="0.05" />
                    <span class="range-value">{{ ((token.light?.softness ?? 0.4) * 100).toFixed(0) }}%</span>
                  </div>

                  <div class="field-group">
                    <label>Cor da Luz</label>
                    <input type="color" [value]="token.light?.color ?? '#ffdd88'" (input)="updateLightField('color', $event)" />
                  </div>

                  @if (token.light?.type === 'cone') {
                    <div class="field-group">
                      <label>Ângulo do Cone (graus)</label>
                      <input type="range" [value]="((token.light?.angle ?? 1) * 180 / Math.PI)" (input)="updateLightConeAngle($event)" min="10" max="360" step="5" />
                      <span class="range-value">{{ ((token.light?.angle ?? 1) * 180 / Math.PI).toFixed(0) }}°</span>
                    </div>
                  }

                  <div class="field-group">
                    <label class="toggle-checkbox">
                      <input type="checkbox" [checked]="token.light?.flicker" (change)="updateLightField('flicker', $event)" />
                      🌟 Flicker (Tocha)
                    </label>
                  </div>

                  <div class="info-box">
                    <strong>Como funciona:</strong> A luz do token <strong>recorta</strong> a Darkness Surface,
                    revelando o mapa ao redor. A luz respeita paredes (raycasting).
                  </div>
                } @else {
                  <div class="info-box dim">
                    Ative a luz para que o token ilumine o ambiente.<br />
                    <small>Token pode ter luz sem visão (ex: tocha no chão).</small>
                  </div>
                }
              </section>
            }

            <!-- ════════════════════════════════════════ -->
            <!-- ABA 3: VISÃO -->
            <!-- ════════════════════════════════════════ -->
            @if (activeTab() === 'vision') {
              <section class="editor-section">
                <div class="section-header">
                  <h4 class="section-title">👁 Visão do Token</h4>
                  <label class="toggle-checkbox">
                    <input type="checkbox" [checked]="token.vision?.enabled" (change)="toggleVisionEnabled($event)" />
                    Ativar Visão
                  </label>
                </div>

                @if (token.vision?.enabled) {
                  <div class="field-group">
                    <label>Alcance de Visão (px)</label>
                    <input type="range" [value]="token.vision?.radius ?? 200" (input)="updateVisionField('radius', $event)" min="20" max="1000" step="10" />
                    <span class="range-value">{{ token.vision?.radius ?? 200 }}px</span>
                  </div>

                  <div class="field-row-2">
                    <label class="toggle-checkbox">
                      <input type="checkbox" [checked]="token.vision?.darkvision" (change)="updateVisionField('darkvision', $event)" />
                      🌙 Darkvision
                    </label>
                    <label class="toggle-checkbox">
                      <input type="checkbox" [checked]="token.vision?.blindsight" (change)="updateVisionField('blindsight', $event)" />
                      🦇 Blindsight
                    </label>
                  </div>

                  <div class="field-row-2">
                    <label class="toggle-checkbox">
                      <input type="checkbox" [checked]="token.vision?.tremorsense" (change)="updateVisionField('tremorsense', $event)" />
                      🌍 Tremorsense
                    </label>
                    <label class="toggle-checkbox">
                      <input type="checkbox" [checked]="token.vision?.cone" (change)="updateVisionField('cone', $event)" />
                      👁 Cone de Visão
                    </label>
                  </div>

                  @if (token.vision?.cone) {
                    <div class="field-group">
                      <label>Ângulo do Cone (graus)</label>
                      <input type="range" [value]="(token.vision?.angle ?? 1) * 180 / Math.PI" (input)="updateVisionConeAngle($event)" min="10" max="360" step="5" />
                      <span class="range-value">{{ ((token.vision?.angle ?? 1) * 180 / Math.PI).toFixed(0) }}°</span>
                    </div>
                  }

                  <div class="info-box">
                    <strong>VISÃO ≠ LUZ</strong><br />
                    Token pode enxergar na escuridão (darkvision) sem emitir luz.<br />
                    Token pode emitir luz sem enxergar (tocha estática).<br />
                    Ambos podem ser combinados.
                  </div>
                } @else {
                  <div class="info-box dim">
                    Ative a visão para que o token possa ver o ambiente.<br />
                    <small>Visão respeita paredes, portas e line of sight.</small>
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
      case 'light': return 'Configuração de Iluminação';
      case 'vision': return 'Configuração de Visão';
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

  // ════════════════════════════════════════════════════
  // BÁSICO
  // ════════════════════════════════════════════════════

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

  // ════════════════════════════════════════════════════
  // BARRAS
  // ════════════════════════════════════════════════════

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

  // ════════════════════════════════════════════════════
  // ILUMINAÇÃO
  // ════════════════════════════════════════════════════

  toggleLightEnabled(event: Event): void {
    const enabled = (event.target as HTMLInputElement).checked;
    if (enabled) {
      // Ativa luz com configuração inicial se não existir
      if (!this.token.light) {
        this.tokenService.setTokenLight(this.token.id, {
          enabled: true,
          radius: 200,
          color: '#ffdd88',
          intensity: 0.8,
          softness: 0.4,
          type: 'radial',
          flicker: false,
        });
      } else {
        this.tokenService.setTokenLight(this.token.id, { ...this.token.light, enabled: true });
      }
    } else {
      this.tokenService.removeTokenLight(this.token.id);
    }
  }

  updateLightField(field: string, event: Event): void {
    const target = event.target as HTMLInputElement;
    const light = this.token.light;
    if (!light) return;

    let value: any = target.value;
    if (field === 'intensity' || field === 'softness') {
      value = Number(value);
    } else if (field === 'radius') {
      value = Number(value);
    } else if (field === 'flicker') {
      value = target.checked;
    }

    const changes = { [field]: value } as Partial<TokenLight>;
    this.tokenService.updateTokenLight(this.token.id, changes);
  }

  updateLightConeAngle(event: Event): void {
    const degrees = Number((event.target as HTMLInputElement).value);
    const radians = (degrees * Math.PI) / 180;
    this.tokenService.updateTokenLight(this.token.id, { angle: radians });
  }

  // ════════════════════════════════════════════════════
  // VISÃO
  // ════════════════════════════════════════════════════

  toggleVisionEnabled(event: Event): void {
    const enabled = (event.target as HTMLInputElement).checked;
    if (enabled) {
      if (!this.token.vision) {
        this.tokenService.setTokenVision(this.token.id, {
          enabled: true,
          radius: 300,
          darkvision: false,
          blindsight: false,
          tremorsense: false,
          cone: false,
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
    if (field === 'darkvision' || field === 'blindsight' || field === 'tremorsense' || field === 'cone') {
      value = target.checked;
    } else if (field === 'radius') {
      value = Number(target.value);
    } else {
      value = target.value;
    }

    const changes = { [field]: value } as Partial<TokenVision>;
    this.tokenService.setTokenVision(this.token.id, { ...vision, ...changes });
  }

  updateVisionConeAngle(event: Event): void {
    const degrees = Number((event.target as HTMLInputElement).value);
    const radians = (degrees * Math.PI) / 180;
    const vision = this.token.vision;
    if (vision) {
      this.tokenService.setTokenVision(this.token.id, { ...vision, angle: radians });
    }
  }
}
