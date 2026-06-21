// ============================================================
// Sheet Builder - Core Types (Section-Based Layout)
// ============================================================

export interface SheetField {
  id: string;
  type: FieldType;
  label: string;
  value: any;
  width?: number;          // col-span (1-12)
  settings?: FieldSettings;
  itemSchema?: SheetField[]; // For power fields (schema definition)
  items?: any[];           // For power, stored data
}

export type FieldType =
  | 'attribute'
  | 'resource'
  | 'text'
  | 'textarea'
  | 'select'
  | 'power'
  | 'image'
  | 'checkbox'
  | 'dice'
  | 'number'
  | 'notes'
  | 'attribute_group'
  | 'skill_table'
  | 'inventory'
  | 'attack';

export interface FieldSettings {
  // Resource bar
  current?: number;
  maxValue?: number;
  color?: string;
  showNumbers?: boolean;

  // Select
  options?: string[];

  // Table
  rows?: number;
  cols?: number;
  headers?: string[];

  // Attribute / Number
  min?: number;
  max?: number;
  modifier?: boolean; // show mod calc
  step?: number;

  // Image
  placeholder?: string;

  // Attribute Group
  attributeGroup?: AttributeGroupSettings;

  // Skill Table
  skillTable?: SkillTableSettings;

  // Inventory
  inventory?: InventorySettings;

  // Attack
  attack?: AttackSettings;
}


// ============================================================
// Attribute Group (Block Cards)
// ============================================================
export interface AttributeDef {
  id: string;
  name: string;
  value: number;
}

export interface AttributeGroupSettings {
  attributes: AttributeDef[];
  modifierMode: 'none' | 'dnd' | 'custom';
  modifierFormula: ModifierFormula;
  alignment: 'center' | 'left' | 'right';
}

export interface ModifierFormula {
  baseValue: number;
  interval: number;
  increment: number;
}

// ============================================================
// Skill Table (Dynamic Columns)
// ============================================================
export interface SkillColumnDef {
  id: string;
  label: string;
  type: 'text' | 'number' | 'checkbox' | 'select' | 'total' | 'bonus' | 'modifier' | 'related_attr';
  options?: string[];
  formula?: string;
  relatedAttributeId?: string;
  width?: number;
}

export interface SkillTableSettings {
  columns: SkillColumnDef[];
}

// ============================================================
// Inventory (Custom Columns + Accordion Items + Description)
// ============================================================
export interface InventoryColumnDef {
  id: string;
  label: string;
  type: 'text' | 'number' | 'checkbox' | 'select' | 'textarea';
  options?: string[];
  width?: number;
}

export interface InventorySettings {
  columns: InventoryColumnDef[];
}

// ============================================================
// Attack (Custom Columns + Accordion Items with Dice Rolling)
// ============================================================
export interface AttackColumnDef {
  id: string;
  label: string;
  type: 'text' | 'dice' | 'bonus' | 'textarea';
  diceSides?: number; // for dice type, default 6
}

export interface AttackSettings {
  columns: AttackColumnDef[];
}

export interface SheetSection {

  id: string;
  title: string;
  layout: 'grid' | 'stack' | 'cards';
  columns: number; // 1-12
  width?: number;  // section width (1-12) for multi-column sections
  fields: SheetField[];
}

export interface SheetTab {
  id: string;
  name: string;
  sections: SheetSection[];
}

export interface SheetSettings {
  backgroundColor: string;
  accentColor: string;
  fontColor: string;
  borderRadius: 'none' | 'sm' | 'md' | 'lg';
  gap: 'sm' | 'md' | 'lg';
}

export interface CharacterSheet {
  id: string;
  name: string;
  templateType: 'player' | 'monster' | 'npc';
  tabs: SheetTab[];
  settings: SheetSettings;
}

// ============================================================
// Field Preset System
// ============================================================

export interface FieldPreset {
  type: FieldType;
  label: string;
  icon: string;
  description: string;
  defaultSettings?: FieldSettings;
  defaultWidth?: number;
  createFields?: () => SheetField[];
}

export const FIELD_PRESETS: FieldPreset[] = [
  {
    type: 'attribute',
    label: 'Atributo',
    icon: '◈',
    description: 'Força, Agilidade, Intelecto...',
    defaultWidth: 3,
    createFields: () => [
      { id: crypto.randomUUID(), type: 'text', label: 'Nome', value: 'Novo Atributo', width: 12 },
      { id: crypto.randomUUID(), type: 'number', label: 'Valor', value: 0, width: 6, settings: { min: 0, max: 20 } },
      { id: crypto.randomUUID(), type: 'number', label: 'Modificador', value: 0, width: 6, settings: { min: -10, max: 10 } },
    ]
  },
  {
    type: 'resource',
    label: 'Recurso',
    icon: '▬',
    description: 'HP, Mana, Sanidade, Estamina...',
    defaultWidth: 6,
    defaultSettings: { current: 10, maxValue: 10, color: '#e05a5a', showNumbers: true }
  },
  {
    type: 'text',
    label: 'Texto',
    icon: 'T',
    description: 'Nome, raça, classe...',
    defaultWidth: 6
  },
  {
    type: 'textarea',
    label: 'Descrição',
    icon: '📝',
    description: 'História, aparência, notas...',
    defaultWidth: 12
  },
  {
    type: 'number',
    label: 'Número',
    icon: '#',
    description: 'Valores numéricos simples',
    defaultWidth: 3,
    defaultSettings: { step: 1 }
  },
  {
    type: 'select',
    label: 'Seleção',
    icon: '▼',
    description: 'Dropdown de opções',
    defaultWidth: 6,
    defaultSettings: { options: ['Opção 1', 'Opção 2', 'Opção 3'] }
  },
  {
    type: 'checkbox',
    label: 'Checkbox',
    icon: '☑',
    description: 'Status, condições, marcadores',
    defaultWidth: 3
  },
  {
    type: 'dice',
    label: 'Dado',
    icon: '🎲',
    description: 'Rolagem de dados rápida',
    defaultWidth: 4
  },
  {
    type: 'power',
    label: 'Poder/Habilidade',
    icon: '✦',
    description: 'Poder com nome, custo, descrição',
    defaultWidth: 12
  },
  {
    type: 'image',
    label: 'Imagem',
    icon: '📷',
    description: 'Foto do personagem',
    defaultWidth: 4
  },
  {
    type: 'notes',
    label: 'Anotações',
    icon: '📓',
    description: 'Bloco de notas livre',
    defaultWidth: 12
  },
  {
    type: 'attribute_group',
    label: 'Bloco de Atributos',
    icon: '◈',
    description: 'Conjunto completo de atributos em cards',
    defaultWidth: 12,
    defaultSettings: {
      attributeGroup: {
        attributes: [
          { id: crypto.randomUUID(), name: 'Força', value: 10 },
          { id: crypto.randomUUID(), name: 'Agilidade', value: 10 },
          { id: crypto.randomUUID(), name: 'Intelecto', value: 10 },
          { id: crypto.randomUUID(), name: 'Presença', value: 10 }
        ],
        modifierMode: 'dnd',
        modifierFormula: { baseValue: 10, interval: 2, increment: 1 },
        alignment: 'center'
      }
    }
  },
  {
    type: 'skill_table',
    label: 'Tabela de Perícias',
    icon: '📋',
    description: 'Tabela dinâmica de perícias configurável',
    defaultWidth: 12,
    defaultSettings: {
      skillTable: {
        columns: [
          { id: crypto.randomUUID(), label: 'Perícia', type: 'text' },
          { id: crypto.randomUUID(), label: 'Treinado', type: 'checkbox' },
          { id: crypto.randomUUID(), label: 'Bônus', type: 'number' },
          { id: crypto.randomUUID(), label: 'Atributo', type: 'related_attr' },
          { id: crypto.randomUUID(), label: 'Total', type: 'total' }
        ]
      }
    }
  },
  {
    type: 'inventory',
    label: 'Inventário',
    icon: '🎒',
    description: 'Lista de itens com campos customizáveis e descrição em sanfona',
    defaultWidth: 12,
    defaultSettings: {
      inventory: {
        columns: [
          { id: crypto.randomUUID(), label: 'Item', type: 'text' },
          { id: crypto.randomUUID(), label: 'Qtd.', type: 'number' },
          { id: crypto.randomUUID(), label: 'Peso', type: 'number' }
        ]
      }
    }
  },
  {
    type: 'attack',
    label: 'Ataque',
    icon: '⚔️',
    description: 'Ataques com rolagem de dano, bônus e descrição em sanfona',
    defaultWidth: 12,
    defaultSettings: {
      attack: {
        columns: [
          { id: crypto.randomUUID(), label: 'Nome', type: 'text' },
          { id: crypto.randomUUID(), label: 'Dano', type: 'dice', diceSides: 6 },
          { id: crypto.randomUUID(), label: 'Bônus', type: 'bonus' },
          { id: crypto.randomUUID(), label: 'Observação', type: 'textarea' }
        ]
      }
    }
  }
];
