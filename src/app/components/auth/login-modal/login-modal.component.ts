import { Component, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './login-modal.component.html',
  styleUrl: './login-modal.component.scss',
})
export class LoginModalComponent {
  readonly close = output<void>();

  show = signal(false);
  animatingOut = signal(false);

  ngOnInit() {
    // Trigger enter animation after render
    requestAnimationFrame(() => this.show.set(true));
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
