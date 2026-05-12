import { Component, signal, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface GlobalNote {
  id: string;
  title: string;
  content: string;
  createdAt: number;
}

@Component({
  selector: 'app-anotacoes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './anotacoes.component.html',
  styleUrl: './anotacoes.component.scss'
})
export class AnotacoesComponent implements OnInit, OnDestroy {
  @ViewChild('editorArea') editorAreaRef!: ElementRef<HTMLElement>;

  notes = signal<GlobalNote[]>([]);
  campaigns = signal<any[]>([]);

  isEditing = signal(false);
  editingNote = signal<GlobalNote | null>(null);

  noteTitle = '';
  noteContent = '';

  // Rich text state
  isBold = false;
  isItalic = false;
  isUnderline = false;
  currentHeading: '' | 'h1' | 'h2' = '';

  private formatPending = false;

  showImportModal = signal(false);
  showExportModal = signal(false);

  // Toast + Confirm
  notificationMessage = signal<string | null>(null);
  private notifTimeout: any = null;
  showConfirmModal = signal(false);
  confirmMessage = '';
  private confirmAction: (() => void) | null = null;

  private onSelectionChange = () => this.onSelectionChanged();

  ngOnInit() {
    this.loadData();
    document.addEventListener('selectionchange', this.onSelectionChange);
  }

  ngOnDestroy() {
    document.removeEventListener('selectionchange', this.onSelectionChange);
  }

  private showToast(message: string) {
    if (this.notifTimeout) clearTimeout(this.notifTimeout);
    this.notificationMessage.set(message);
    this.notifTimeout = setTimeout(() => this.notificationMessage.set(null), 3000);
  }

  dismissToast() {
    this.notificationMessage.set(null);
    if (this.notifTimeout) clearTimeout(this.notifTimeout);
  }

  private askConfirm(message: string, onConfirm: () => void) {
    this.confirmMessage = message;
    this.confirmAction = onConfirm;
    this.showConfirmModal.set(true);
  }

  confirmYes() {
    this.showConfirmModal.set(false);
    if (this.confirmAction) this.confirmAction();
    this.confirmAction = null;
  }

  confirmNo() {
    this.showConfirmModal.set(false);
    this.confirmAction = null;
  }

  loadData() {
    this.notes.set(JSON.parse(localStorage.getItem('mythmaker_global_notes') ?? '[]'));
    this.campaigns.set(JSON.parse(localStorage.getItem('mythmaker_campaigns') ?? '[]'));
  }

  createNewNote() {
    this.isEditing.set(true);
    this.editingNote.set(null);
    this.noteTitle = '';
    this.noteContent = '';
    this.isBold = false;
    this.isItalic = false;
    this.isUnderline = false;
    this.currentHeading = '';
    setTimeout(() => this.setEditorContent(''));
  }

  editNote(note: GlobalNote) {
    this.isEditing.set(true);
    this.editingNote.set(note);
    this.noteTitle = note.title;
    this.noteContent = note.content;
    this.isBold = false;
    this.isItalic = false;
    this.isUnderline = false;
    this.currentHeading = '';
    setTimeout(() => this.setEditorContent(note.content));
  }

  private getEditor(): HTMLElement | null {
    return this.editorAreaRef?.nativeElement ?? document.querySelector('.editor-area') as HTMLElement;
  }

  private setEditorContent(html: string) {
    const editor = this.getEditor();
    if (editor) {
      editor.innerHTML = html;
    }
  }

  // ── Rich Text Formatting ──

  onContentEdit(event: Event) {
    const element = event.target as HTMLElement;
    this.noteContent = element.innerHTML;
  }

  onToolMouseDown(command: string, event: Event) {
    event.preventDefault();
    this.formatPending = true;
    this.formatText(command);
  }

  formatText(command: string) {
    const editor = this.getEditor();
    if (!editor) return;

    const sel = window.getSelection();
    const savedRange = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
    editor.focus();
    if (savedRange) {
      sel?.removeAllRanges();
      sel?.addRange(savedRange);
    }

    document.execCommand('styleWithCSS', false, 'true');

    if (command === 'h1') {
      if (this.currentHeading === 'h1') {
        document.execCommand('formatBlock', false, '<p>');
        this.currentHeading = '';
      } else {
        document.execCommand('formatBlock', false, '<h1>');
        this.currentHeading = 'h1';
        this.isBold = false;
        this.isItalic = false;
        this.isUnderline = false;
      }
    } else if (command === 'h2') {
      if (this.currentHeading === 'h2') {
        document.execCommand('formatBlock', false, '<p>');
        this.currentHeading = '';
      } else {
        document.execCommand('formatBlock', false, '<h2>');
        this.currentHeading = 'h2';
        this.isBold = false;
        this.isItalic = false;
        this.isUnderline = false;
      }
    } else if (command === 'bold') {
      document.execCommand('bold');
      this.isBold = !this.isBold;
    } else if (command === 'italic') {
      document.execCommand('italic');
      this.isItalic = !this.isItalic;
    } else if (command === 'underline') {
      document.execCommand('underline');
      this.isUnderline = !this.isUnderline;
    }

    this.noteContent = editor.innerHTML;
    editor.focus();
    setTimeout(() => { this.formatPending = false; }, 0);
  }

  onSelectionChanged() {
    if (this.formatPending) return;

    const editor = this.getEditor();
    if (!editor || !this.isEditing()) return;

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;

    let node = range.commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentNode as Node;
    }
    const parent = node as HTMLElement;

    let foundHeading: '' | 'h1' | 'h2' = '';
    if (parent) {
      let walker: HTMLElement | null = parent;
      while (walker) {
        if (walker.tagName === 'H1') { foundHeading = 'h1'; break; }
        if (walker.tagName === 'H2') { foundHeading = 'h2'; break; }
        walker = walker.parentElement;
      }
    }
    this.currentHeading = foundHeading;

    if (foundHeading) {
      this.isBold = false;
      this.isItalic = false;
      this.isUnderline = false;
    } else {
      this.isBold = document.queryCommandState('bold');
      this.isItalic = document.queryCommandState('italic');
      this.isUnderline = document.queryCommandState('underline');
    }
  }

  getPlainText(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }

  saveNote() {
    if (!this.noteTitle.trim()) return;

    const all = [...this.notes()];
    const editing = this.editingNote();

    if (editing) {
      const index = all.findIndex(n => n.id === editing.id);
      if (index !== -1) {
        all[index] = { ...editing, title: this.noteTitle, content: this.noteContent };
      }
    } else {
      const newNote: GlobalNote = {
        id: crypto.randomUUID(),
        title: this.noteTitle,
        content: this.noteContent,
        createdAt: Date.now()
      };
      all.push(newNote);
    }

    localStorage.setItem('mythmaker_global_notes', JSON.stringify(all));
    this.notes.set(all);
    this.cancelEdit();
  }

  deleteNote(id: string, event: MouseEvent) {
    event.stopPropagation();
    this.askConfirm('Excluir esta anotação?', () => {
      const filtered = this.notes().filter(n => n.id !== id);
      localStorage.setItem('mythmaker_global_notes', JSON.stringify(filtered));
      this.notes.set(filtered);
      this.showToast('Anotação excluída.');
    });
  }

  cancelEdit() {
    this.isEditing.set(false);
    this.editingNote.set(null);
  }

  importFromCampaign(campaignId: string) {
    const campaign = this.campaigns().find(c => c.id === campaignId);
    const systemData = JSON.parse(localStorage.getItem(`mythmaker_system_${campaignId}`) ?? '{}');

    if (!systemData.notes) {
      this.showToast('Nenhuma anotação do mestre encontrada nesta campanha.');
      return;
    }

    const newNote: GlobalNote = {
      id: crypto.randomUUID(),
      title: `Importado: ${campaign.nome}`,
      content: systemData.notes,
      createdAt: Date.now()
    };

    const all = [...this.notes(), newNote];
    localStorage.setItem('mythmaker_global_notes', JSON.stringify(all));
    this.notes.set(all);
    this.showImportModal.set(false);
    this.showToast('Anotação importada com sucesso!');
  }

  exportToCampaign(campaignId: string) {
    const note = this.editingNote() || this.notes()[0];
    if (!note) return;

    const systemData = JSON.parse(localStorage.getItem(`mythmaker_system_${campaignId}`) ?? '{}');
    systemData.notes = note.content;
    localStorage.setItem(`mythmaker_system_${campaignId}`, JSON.stringify(systemData));

    this.showExportModal.set(false);
    this.showToast('Anotação exportada para a campanha!');
  }
}
