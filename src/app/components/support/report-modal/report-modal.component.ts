import { Component, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-report-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './report-modal.component.html',
  styleUrl: './report-modal.component.scss',
})
export class ReportModalComponent {
  readonly close = output<void>();

  /* ── animation ── */
  show = signal(false);
  animatingOut = signal(false);

  /* ── form fields ── */
  email = '';
  message = '';
  files: File[] = [];
  previews: string[] = [];

  /* ── validation ── */
  submitted = false;

  ngOnInit() {
    requestAnimationFrame(() => this.show.set(true));
  }

  get emailValid(): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email);
  }

  get formValid(): boolean {
    return this.emailValid && this.message.trim().length > 0;
  }

  /* ── file handling ── */
  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;

    const remaining = 3 - this.files.length;
    const toAdd = Array.from(input.files).slice(0, remaining);

    for (const file of toAdd) {
      if (file.type.startsWith('image/')) {
        this.files.push(file);
        const reader = new FileReader();
        reader.onload = (e) => {
          this.previews.push(e.target!.result as string);
        };
        reader.readAsDataURL(file);
      }
    }

    input.value = '';
  }

  removeFile(index: number) {
    this.files.splice(index, 1);
    this.previews.splice(index, 1);
  }

  /* ── submit ── */
  handleSubmit() {
    this.submitted = true;
    if (!this.formValid) return;

    const subject = encodeURIComponent('[Report] MythMaker - Reportar Problema');
    const body = encodeURIComponent(
      `Email: ${this.email}\n\nMensagem:\n${this.message}\n\n---\n(As fotos foram anexadas manualmente no seu cliente de email.)`
    );
    window.open(`mailto:tallyslabanca20@gmail.com?subject=${subject}&body=${body}`, '_blank');

    this.handleClose();
  }

  handleClose() {
    this.animatingOut.set(true);
    this.show.set(false);
    setTimeout(() => this.close.emit(), 250);
  }

  onBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.handleClose();
    }
  }
}
