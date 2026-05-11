import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MISSION_DATA } from '../../../data/mission-generator-data';

interface MissionField {
  id: string;
  label: string;
  description: string;
  icon: string;
  category: 'basic' | 'narrative' | 'mechanics' | 'rewards';
  selected: boolean;
}

export interface GeneratedMission {
  id: string;
  date: string;
  data: Record<string, string | string[]>;
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
  activeView = signal<'model' | 'missions'>('model');
  mobileView = signal<'fields' | 'preview'>('fields');

  generatedMissions = signal<GeneratedMission[]>([]);

  fields = signal<MissionField[]>([
    { id: 'level', label: 'Nível / Dificuldade', description: 'O quão perigoso é o desafio.', icon: '💀', category: 'basic', selected: true },
    { id: 'mission_type', label: 'Tipo de Missão', description: 'A natureza da aventura.', icon: '📜', category: 'basic', selected: true },
    { id: 'location', label: 'Localização', description: 'Onde a ação acontece.', icon: '📍', category: 'basic', selected: true },
    { id: 'tone', label: 'Tom da Missão', description: 'A atmosfera da história.', icon: '🎭', category: 'basic', selected: true },
    
    { id: 'initial_hook', label: 'Gancho Inicial', description: 'O que atrai os heróis.', icon: '🪝', category: 'narrative', selected: true },
    { id: 'objective', label: 'Objetivo Principal', description: 'O que os jogadores precisam fazer.', icon: '🎯', category: 'narrative', selected: true },
    { id: 'secondary_objectives', label: 'Objetivos Secundários', description: 'Tarefas extras e bônus.', icon: '📝', category: 'narrative', selected: false },
    { id: 'allies', label: 'NPCs Aliados', description: 'Quem ajudará o grupo.', icon: '🤝', category: 'narrative', selected: false },
    { id: 'enemies', label: 'NPCs Antagonistas', description: 'Quem se opõe ao grupo.', icon: '👹', category: 'narrative', selected: false },
    { id: 'factions', label: 'Facções Envolvidas', description: 'Grupos e organizações no conflito.', icon: '🚩', category: 'narrative', selected: false },
    
    { id: 'threat', label: 'Principal Ameça', description: 'O maior perigo do local.', icon: '👾', category: 'mechanics', selected: true },
    { id: 'hazards', label: 'Perigos e Armadilhas', description: 'Obstáculos ambientais e mecânicos.', icon: '🪤', category: 'mechanics', selected: false },
    { id: 'clues', label: 'Pistas e Informações', description: 'O que pode ser descoberto.', icon: '🔍', category: 'narrative', selected: false },
    { id: 'events', label: 'Eventos Aleatórios', description: 'Imprevistos durante a missão.', icon: '🎲', category: 'mechanics', selected: false },
    { id: 'climax', label: 'Clímax / Evento Final', description: 'O grande confronto ou revelação.', icon: '⚡', category: 'narrative', selected: false },
    
    { id: 'consequences', label: 'Consequências', description: 'O impacto das ações no mundo.', icon: '🌍', category: 'narrative', selected: false },
    { id: 'time_limit', label: 'Tempo Limite / Urgência', description: 'O relógio está correndo.', icon: '⌛', category: 'narrative', selected: false },
    { id: 'twists', label: 'Segredos e Reviravoltas', description: 'O que não é o que parece.', icon: '🎭', category: 'narrative', selected: false },
    { id: 'environment', label: 'Condições do Ambiente', description: 'Clima e estado do local.', icon: '⛈️', category: 'mechanics', selected: false },
    { id: 'outcomes', label: 'Possíveis Desfechos', description: 'Como a história pode terminar.', icon: '🎬', category: 'narrative', selected: false },
    
    { id: 'rewards', label: 'Recompensas', description: 'O que eles ganharão no final.', icon: '💰', category: 'rewards', selected: true },
  ]);

  selectedFields = computed(() => this.fields().filter((f: MissionField) => f.selected));

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    this.campaignId.set(id);

    if (id) {
      const saved = localStorage.getItem(`mythmaker_mission_template_${id}`);
      if (saved) {
        const template = JSON.parse(saved);
        this.fields.update((all: MissionField[]) => all.map((f: MissionField) => ({
          ...f,
          selected: template.fields.includes(f.id)
        })));
      }
      this.loadGeneratedMissions(id);
    }
  }

  loadGeneratedMissions(campaignId: string) {
    const saved = localStorage.getItem(`mythmaker_missions_${campaignId}`);
    if (saved) {
      this.generatedMissions.set(JSON.parse(saved));
    }
  }

  saveGeneratedMissions() {
    if (this.campaignId()) {
      localStorage.setItem(`mythmaker_missions_${this.campaignId()}`, JSON.stringify(this.generatedMissions()));
    }
  }

  toggleField(id: string) {
    this.fields.update((all: MissionField[]) => all.map((f: MissionField) => f.id === id ? { ...f, selected: !f.selected } : f));
  }

  isFieldSelected(id: string): boolean {
    return this.fields().some((f: MissionField) => f.id === id && f.selected);
  }

  isCategorySelected(category: string): boolean {
    return this.fields().some((f: MissionField) => f.category === category && f.selected);
  }

  saveTemplate() {
    if (this.campaignId()) {
      const template = {
        fields: this.selectedFields().map((f: MissionField) => f.id),
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(`mythmaker_mission_template_${this.campaignId()}`, JSON.stringify(template));
      alert('Estrutura da missão salva com sucesso!');
    }
    this.router.navigate(['/campanhas', this.campaignId()]);
  }

  // Random Generation Logic
  generateRandomMission() {
    const selected = this.selectedFields();
    if (selected.length === 0) {
      alert('Selecione pelo menos um campo no modelo primeiro!');
      this.activeView.set('model');
      return;
    }

    const missionData: Record<string, string | string[]> = {};
    
    // Map of Field ID to MISSION_DATA key
    const mapping: Record<string, string> = {
      'level': 'nivel_dificuldade',
      'mission_type': 'tipo_missao',
      'location': 'localizacao',
      'tone': 'tom_missao',
      'initial_hook': 'gancho_inicial',
      'objective': 'objetivo_principal',
      'secondary_objectives': 'objetivos_secundarios',
      'allies': 'npcs_aliados',
      'enemies': 'npcs_antagonistas',
      'factions': 'faccoes_envolvidas',
      'threat': 'principal_ameaca',
      'hazards': 'perigos_armadilhas',
      'clues': 'pistas_informacoes',
      'events': 'eventos_aleatorios',
      'climax': 'climax_evento_final',
      'consequencias': 'consequencias',
      'time_limit': 'tempo_limite_urgencia',
      'twists': 'segredos_reviravoltas',
      'environment': 'condicoes_ambiente',
      'outcomes': 'possiveis_desfechos',
      'rewards': 'recompensas'
    };

    selected.forEach((field: MissionField) => {
      const dataKey = mapping[field.id];
      if (dataKey && (MISSION_DATA as any)[dataKey]) {
        const options = (MISSION_DATA as any)[dataKey];
        // Some fields might want multiple results (like allies or objectives) 
        // but for now let's keep it simple with one random pick
        const randomValue = options[Math.floor(Math.random() * options.length)];
        missionData[field.id] = randomValue;
      }
    });

    const newMission: GeneratedMission = {
      id: crypto.randomUUID(),
      date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      data: missionData
    };

    this.generatedMissions.update((prev: GeneratedMission[]) => [newMission, ...prev]);
    this.saveGeneratedMissions();
  }

  deleteMission(id: string) {
    if (confirm('Deseja excluir esta missão gerada?')) {
      this.generatedMissions.update((prev: GeneratedMission[]) => prev.filter((m: GeneratedMission) => m.id !== id));
      this.saveGeneratedMissions();
    }
  }
}
