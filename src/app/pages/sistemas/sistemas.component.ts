import { Component, signal, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';


import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface System {
  id: string;
  title: string;
  content: string;
  createdAt: number;
}

@Component({
  selector: 'app-sistemas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sistemas.component.html',
  styleUrl: './sistemas.component.scss'
})
export class SistemasComponent implements OnInit, OnDestroy {
  @ViewChild('editorArea') editorAreaRef!: ElementRef<HTMLElement>;

  systems = signal<System[]>([]);
  isEditing = signal(false);
  editingSystem = signal<System | null>(null);

  // Form fields
  systemTitle = '';
  systemContent = '';

  // Rich text state
  isBold = false;
  isItalic = false;
  isUnderline = false;
  currentHeading: '' | 'h1' | 'h2' = '';

  // Store the last known selection range inside the editor
  private savedEditorRange: Range | null = null;

  // Prevent checkFormatting from overriding manual toggle
  private formatPending = false;

  // Campaigns for import/export
  campaigns = signal<any[]>([]);
  showImportModal = signal(false);
  showExportModal = signal(false);
  systemToExport = signal<System | null>(null);

  // Toast + Confirm
  notificationMessage = signal<string | null>(null);
  private notifTimeout: any = null;
  showConfirmModal = signal(false);
  confirmMessage = '';
  private confirmAction: (() => void) | null = null;

  private onSelectionChange = () => this.onSelectionChanged();

  ngOnInit() {
    this.loadSystems();
    this.loadCampaigns();
    document.addEventListener('selectionchange', this.onSelectionChange);
  }

  ngOnDestroy() {
    document.removeEventListener('selectionchange', this.onSelectionChange);
  }

  loadSystems() {
    const saved = JSON.parse(localStorage.getItem('mythmaker_global_systems') ?? '[]');
    this.systems.set(saved);
  }

  loadCampaigns() {
    const saved = JSON.parse(localStorage.getItem('mythmaker_campaigns') ?? '[]');
    this.campaigns.set(saved);
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

  createNewSystem() {
    this.isEditing.set(true);
    this.editingSystem.set(null);
    this.systemTitle = '';
    this.systemContent = '';
    this.isBold = false;
    this.isItalic = false;
    this.isUnderline = false;
    this.currentHeading = '';
    setTimeout(() => this.setEditorContent(''));
  }

  editSystem(system: System) {
    this.isEditing.set(true);
    this.editingSystem.set(system);
    this.systemTitle = system.title;
    this.systemContent = system.content;
    this.isBold = false;
    this.isItalic = false;
    this.isUnderline = false;
    this.currentHeading = '';
    setTimeout(() => this.setEditorContent(system.content));
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
    this.systemContent = element.innerHTML;
  }

  onToolMouseDown(command: string, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.formatPending = true;
    this.formatText(command);
  }

  private toggleState(command: string) {
    switch (command) {
      case 'bold': this.isBold = !this.isBold; break;
      case 'italic': this.isItalic = !this.isItalic; break;
      case 'underline': this.isUnderline = !this.isUnderline; break;
    }
  }

  /** Restore or create a valid selection inside the editor, then focus it */
  private ensureEditorSelection(): boolean {
    const editor = this.getEditor();
    if (!editor) return false;

    const sel = window.getSelection();

    // If there's already a valid selection inside the editor, keep it
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) {
        editor.focus();
        return true;
      }
    }

    // Try restoring saved selection
    if (this.savedEditorRange) {
      try {
        sel?.removeAllRanges();
        sel?.addRange(this.savedEditorRange);
        editor.focus();
        return true;
      } catch {
        this.savedEditorRange = null;
      }
    }

    // Place cursor at the end of editor content
    editor.focus();
    const range = document.createRange();
    const lastChild = editor.lastChild || editor;
    if (lastChild.nodeType === Node.ELEMENT_NODE && (lastChild as HTMLElement).tagName === 'BR') {
      // <br> is the last child, insert before it
      range.setStartBefore(lastChild);
    } else if (lastChild === editor) {
      // Editor is empty, select at start
      range.selectNodeContents(editor);
    } else {
      range.setStartAfter(lastChild);
    }
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);
    return true;
  }


  formatText(command: string) {
    const editor = this.getEditor();
    if (!editor) return;

    // Save the current selection, focus the editor, then restore the selection.
    // This is more reliable than relying on a previously saved range from a
    // selectionchange event, because editor.focus() can reset the selection
    // in some browsers.
    const sel = window.getSelection();
    const savedRange = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
    editor.focus();
    if (savedRange) {
      try {
        sel?.removeAllRanges();
        sel?.addRange(savedRange);
      } catch { /* ignore */ }
    }

    // Enable CSS-based styling (produces <span style="..."> instead of <b>/<i>)
    try { document.execCommand('styleWithCSS', false, 'true'); } catch { /* noop */ }

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

    // Update content
    this.systemContent = editor.innerHTML;
    editor.focus();

    // Release guard after a tick so selectionchange doesn't override
    setTimeout(() => { this.formatPending = false; }, 0);
  }



  onSelectionChanged() {
    if (this.formatPending) return; // Just toggled from toolbar, don't override

    const editor = this.getEditor();
    if (!editor || !this.isEditing()) return;

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    // Only check if selection is inside the editor
    const range = sel.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;

    // ✅ Store selection so toolbar buttons can restore it
    this.savedEditorRange = range.cloneRange();

    let node = range.commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentNode as Node;
    }
    const parent = node as HTMLElement;

    // Detect heading first
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

    // h1 and h2 are inherently displayed as bold by browsers, so
    // queryCommandState('bold') would incorrectly return true inside headings.
    // Force formatting off when inside a heading.
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

  saveSystem() {
    if (!this.systemTitle.trim()) {
      this.showToast('Por favor, insira um título.');
      return;
    }

    const all = [...this.systems()];
    const editing = this.editingSystem();

    if (editing) {
      const index = all.findIndex(s => s.id === editing.id);
      if (index !== -1) {
        all[index] = {
          ...editing,
          title: this.systemTitle,
          content: this.systemContent
        };
      }
    } else {
      const newSystem: System = {
        id: crypto.randomUUID(),
        title: this.systemTitle,
        content: this.systemContent,
        createdAt: Date.now()
      };
      all.push(newSystem);
    }

    localStorage.setItem('mythmaker_global_systems', JSON.stringify(all));
    this.systems.set(all);
    this.cancelEdit();
    this.showToast('Sistema salvo com sucesso!');
  }

  deleteSystem(id: string, event: MouseEvent) {
    event.stopPropagation();
    this.askConfirm('Excluir este sistema?', () => {
      const filtered = this.systems().filter(s => s.id !== id);
      localStorage.setItem('mythmaker_global_systems', JSON.stringify(filtered));
      this.systems.set(filtered);
      this.showToast('Sistema excluído.');
    });
  }

  cancelEdit() {
    this.isEditing.set(false);
    this.editingSystem.set(null);
  }

  toggleImportModal() {
    this.showImportModal.update(v => !v);
  }

  toggleExportModal(system: System | null = null) {
    this.systemToExport.set(system);
    this.showExportModal.update(v => !v);
  }

  importFromCampaign(campaignId: string) {
    const campaign = this.campaigns().find(c => c.id === campaignId);
    if (!campaign) return;

    const systemData = JSON.parse(localStorage.getItem(`mythmaker_system_${campaignId}`) ?? '{}');
    if (!systemData.rules) {
      this.showToast('Esta campanha não possui regras de sistema para importar.');
      return;
    }

    const newSystem: System = {
      id: crypto.randomUUID(),
      title: `Importado: ${campaign.nome}`,
      content: systemData.rules,
      createdAt: Date.now()
    };

    const all = [...this.systems(), newSystem];
    localStorage.setItem('mythmaker_global_systems', JSON.stringify(all));
    this.systems.set(all);
    this.showImportModal.set(false);
    this.showToast('Sistema importado com sucesso!');
  }

  confirmExport(campaignId: string) {
    const system = this.systemToExport();
    if (!system) return;

    const campaign = this.campaigns().find(c => c.id === campaignId);
    if (!campaign) return;

    const systemData = JSON.parse(localStorage.getItem(`mythmaker_system_${campaignId}`) ?? '{}');
    systemData.rules = system.content;
    localStorage.setItem(`mythmaker_system_${campaignId}`, JSON.stringify(systemData));

    this.showExportModal.set(false);
    this.showToast(`Sistema exportado para "${campaign.nome}" com sucesso!`);
  }

  exportToCampaign(system: System) {
    this.toggleExportModal(system);
  }

  getPlainText(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }

  getCampaignName(id: string) {
    return this.campaigns().find(c => c.id === id)?.nome || 'Campanha Desconhecida';
  }
}
