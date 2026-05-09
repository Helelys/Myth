import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

interface MissionField {
  id: string;
  label: string;
  description: string;
  icon: string;
  category: 'basic' | 'narrative' | 'mechanics' | 'rewards';
  selected: boolean;
}

@Component({
  selector: 'app-mission-generator',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './mission-generator.component.html',
  styleUrl: './mission-generator.component.scss'
})
export class MissionGeneratorComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  campaignId = signal<string | null>(null);
  mobileView = signal<'fields' | 'preview'>('fields');

  fields = signal<MissionField[]>([
    { id: 'title', label: 'Título da Missão', description: 'O nome épico da aventura.', icon: '🏷️', category: 'basic', selected: true },
    { id: 'level', label: 'Nível / Dificuldade', description: 'O quão perigoso é o desafio.', icon: '💀', category: 'basic', selected: true },
    { id: 'location', label: 'Localização', description: 'Onde a ação acontece.', icon: '📍', category: 'basic', selected: true },
    
    { id: 'description', label: 'Descrição Narrativa', description: 'O gancho inicial e o contexto.', icon: '📜', category: 'narrative', selected: true },
    { id: 'objective', label: 'Objetivo Principal', description: 'O que os jogadores precisam fazer.', icon: '🎯', category: 'narrative', selected: true },
    { id: 'climax', label: 'Clímax / Evento Final', description: 'O grande confronto ou revelação.', icon: '⚡', category: 'narrative', selected: false },
    
    { id: 'allies', label: 'NPCs Aliados', description: 'Quem ajudará o grupo.', icon: '🤝', category: 'narrative', selected: false },
    { id: 'enemies', label: 'NPCs Antagonistas', description: 'Quem se opõe ao grupo.', icon: '👹', category: 'narrative', selected: false },
    
    { id: 'hazards', label: 'Perigos e Armadilhas', description: 'Obstáculos ambientais e mecânicos.', icon: '🪤', category: 'mechanics', selected: false },
    { id: 'combat', label: 'Encontros de Combate', description: 'Lutas planejadas durante a missão.', icon: '⚔️', category: 'mechanics', selected: false },
    
    { id: 'rewards_xp', label: 'Recompensa de Experiência', description: 'XP ou Pontos de Evolução.', icon: '📈', category: 'rewards', selected: true },
    { id: 'rewards_loot', label: 'Itens e Tesouros', description: 'O que eles encontrarão de valor.', icon: '💰', category: 'rewards', selected: true },
  ]);

  selectedFields = computed(() => this.fields().filter(f => f.selected));

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    this.campaignId.set(id);

    if (id) {
      const saved = localStorage.getItem(`mythmaker_mission_template_${id}`);
      if (saved) {
        const template = JSON.parse(saved);
        this.fields.update(all => all.map(f => ({
          ...f,
          selected: template.fields.includes(f.id)
        })));
      }
    }
  }

  toggleField(id: string) {
    this.fields.update(all => all.map(f => f.id === id ? { ...f, selected: !f.selected } : f));
  }

  isFieldSelected(id: string): boolean {
    return this.fields().some(f => f.id === id && f.selected);
  }

  isCategorySelected(category: string): boolean {
    return this.fields().some(f => f.category === category && f.selected);
  }

  saveTemplate() {
    if (this.campaignId()) {
      const template = {
        fields: this.selectedFields().map(f => f.id),
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(`mythmaker_mission_template_${this.campaignId()}`, JSON.stringify(template));
      alert('Estrutura da missão salva com sucesso!');
    }
    this.router.navigate(['/campanhas', this.campaignId()]);
  }
}
