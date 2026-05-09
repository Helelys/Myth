import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

export interface GlobalNote {
  id: string;
  title: string;
  content: string;
  createdAt: number;
}

@Component({
  selector: 'app-anotacoes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './anotacoes.component.html',
  styleUrl: './anotacoes.component.scss'
})
export class AnotacoesComponent implements OnInit {
  notes = signal<GlobalNote[]>([]);
  campaigns = signal<any[]>([]);
  
  isEditing = signal(false);
  editingNote = signal<GlobalNote | null>(null);
  
  noteTitle = '';
  noteContent = '';
  
  showImportModal = signal(false);
  showExportModal = signal(false);

  ngOnInit() {
    this.loadData();
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
  }

  editNote(note: GlobalNote) {
    this.isEditing.set(true);
    this.editingNote.set(note);
    this.noteTitle = note.title;
    this.noteContent = note.content;
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
    if (!confirm('Excluir esta anotação?')) return;
    const filtered = this.notes().filter(n => n.id !== id);
    localStorage.setItem('mythmaker_global_notes', JSON.stringify(filtered));
    this.notes.set(filtered);
  }

  cancelEdit() {
    this.isEditing.set(false);
    this.editingNote.set(null);
  }

  importFromCampaign(campaignId: string) {
    const campaign = this.campaigns().find(c => c.id === campaignId);
    const systemData = JSON.parse(localStorage.getItem(`mythmaker_system_${campaignId}`) ?? '{}');
    
    if (!systemData.notes) {
      alert('Nenhuma anotação do mestre encontrada nesta campanha.');
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
    alert('Anotação importada com sucesso!');
  }

  exportToCampaign(campaignId: string) {
    const note = this.editingNote() || this.notes()[0]; // Fallback or logic
    if (!note) return;

    const systemData = JSON.parse(localStorage.getItem(`mythmaker_system_${campaignId}`) ?? '{}');
    systemData.notes = note.content;
    localStorage.setItem(`mythmaker_system_${campaignId}`, JSON.stringify(systemData));
    
    this.showExportModal.set(false);
    alert('Anotação exportada para a campanha!');
  }
}
