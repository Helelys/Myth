import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

export interface Campaign {
  id: string;
  nome: string;
  descricao: string;
  imagemCapa: string | null;
  criadoEm: string;
}

@Component({
  selector: 'app-criar-campanha',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './criar-campanha.component.html',
  styleUrl: './criar-campanha.component.scss'
})
export class CriarCampanhaComponent {
  nome = signal('');
  descricao = signal('');
  imagemCapa = signal<string | null>(null);
  isDragging = signal(false);
  salvando = signal(false);
  erroNome = signal(false);

  constructor(private router: Router) {}

  onImageUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) this.processFile(input.files[0]);
  }

  onDragOver(e: DragEvent) { e.preventDefault(); this.isDragging.set(true); }
  onDragLeave() { this.isDragging.set(false); }
  onDrop(e: DragEvent) {
    e.preventDefault();
    this.isDragging.set(false);
    const file = e.dataTransfer?.files[0];
    if (file?.type.startsWith('image/')) this.processFile(file);
  }

  private processFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => this.imagemCapa.set(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  triggerFileInput(input: HTMLInputElement) { input.click(); }

  criarCampanha() {
    if (!this.nome().trim()) { this.erroNome.set(true); return; }
    this.salvando.set(true);

    const campaign: Campaign = {
      id: crypto.randomUUID(),
      nome: this.nome().trim(),
      descricao: this.descricao(),
      imagemCapa: this.imagemCapa(),
      criadoEm: new Date().toISOString(),
    };

    const saved: Campaign[] = JSON.parse(localStorage.getItem('mythmaker_campaigns') ?? '[]');
    saved.push(campaign);
    localStorage.setItem('mythmaker_campaigns', JSON.stringify(saved));

    setTimeout(() => this.router.navigate(['/campanhas']), 600);
  }
}
