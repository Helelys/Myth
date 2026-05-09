import { Component, signal, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SheetComponent, SheetTab } from '../sheet-editor/sheet-editor.component';

export interface Character {
  id: string;
  campaignId: string;
  name: string;
  data: Record<string, any>; // componentId -> value
  isMonster?: boolean;
}

@Component({
  selector: 'app-player-sheet',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './player-sheet.component.html',
  styleUrl: './player-sheet.component.scss'
})
export class PlayerSheetComponent implements OnInit {
  @Input() campaignId: string | null = null;
  @Input() characterId: string | null = null;
  @Input() templateType: 'player' | 'monster' = 'player';

  template = signal<{ tabs: SheetTab[], components: SheetComponent[] } | null>(null);
  character = signal<Character | null>(null);
  activeTabId = signal<string | null>(null);
  sheetSettings = signal({
    backgroundColor: '#1c1c24',
    accentColor: '#ffffff'
  });

  ngOnInit() {
    this.loadTemplate();
    this.loadCharacter();
  }

  loadTemplate() {
    if (!this.campaignId) return;
    const saved = localStorage.getItem(`mythmaker_template_${this.templateType}_${this.campaignId}`);
    if (saved) {
      const data = JSON.parse(saved);
      this.template.set(data);
      if (data.settings) this.sheetSettings.set(data.settings);
      if (data.tabs?.length > 0) this.activeTabId.set(data.tabs[0].id);
    }
  }

  loadCharacter() {
    if (!this.characterId) return;
    const saved = JSON.parse(localStorage.getItem('mythmaker_characters') ?? '[]');
    const found = saved.find((c: Character) => c.id === this.characterId);
    if (found) {
      this.character.set(found);
    }
  }

  getOptions(optionsStr: string): string[] {
    if (!optionsStr) return [];
    return optionsStr.split(',').map(o => o.trim());
  }

  onPhotoChange(event: any, compId: string) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.updateValue(compId, e.target.result);
      };
      reader.readAsDataURL(file);
    }
  }

  getComponentsForActiveTab() {
    return this.template()?.components.filter(c => c.tabId === this.activeTabId()) || [];
  }

  updateValue(compId: string, value: any) {
    if (!this.character()) return;
    this.character.update(prev => {
      if (!prev) return null;
      return {
        ...prev,
        data: { ...prev.data, [compId]: value }
      };
    });
    this.saveCharacter();
  }

  saveCharacter() {
    const char = this.character();
    if (!char) return;
    const saved = JSON.parse(localStorage.getItem('mythmaker_characters') ?? '[]');
    const index = saved.findIndex((c: Character) => c.id === char.id);
    if (index >= 0) saved[index] = char;
    else saved.push(char);
    localStorage.setItem('mythmaker_characters', JSON.stringify(saved));
  }
}
