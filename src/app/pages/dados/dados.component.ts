import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface DieCount {
  sides: number;
  count: number;
}

interface RollResult {
  dieResults: { sides: number, value: number }[];
  modifier: number;
  mode: 'sum' | 'highest' | 'lowest';
  finalValue: number;
  timestamp: number;
}

@Component({
  selector: 'app-dados',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dados.component.html',
  styleUrl: './dados.component.scss'
})
export class DadosComponent {
  dieTypes = [2, 4, 6, 8, 10, 12, 20, 100];
  
  // Tray State
  trayDice = signal<DieCount[]>([]);
  modifier = signal<number>(0);
  rollMode = signal<'sum' | 'highest' | 'lowest'>('sum');
  
  // Modal Result State
  currentResult = signal<RollResult | null>(null);
  showResultModal = signal(false);
  isRolling = signal(false);

  // Quick Roll
  quickRoll(sides: number) {
    this.isRolling.set(true);
    
    // Artificial delay for "rolling" feel
    setTimeout(() => {
      const value = Math.floor(Math.random() * sides) + 1;
      this.currentResult.set({
        dieResults: [{ sides, value }],
        modifier: 0,
        mode: 'sum',
        finalValue: value,
        timestamp: Date.now()
      });
      this.isRolling.set(false);
      this.showResultModal.set(true);
    }, 600);
  }

  // Tray Management
  addToTray(sides: number) {
    this.trayDice.update(prev => {
      const existing = prev.find(d => d.sides === sides);
      if (existing) {
        return prev.map(d => d.sides === sides ? { ...d, count: d.count + 1 } : d);
      }
      return [...prev, { sides, count: 1 }];
    });
  }

  removeFromTray(sides: number) {
    this.trayDice.update(prev => {
      return prev.map(d => {
        if (d.sides === sides) return { ...d, count: Math.max(0, d.count - 1) };
        return d;
      }).filter(d => d.count > 0);
    });
  }

  clearTray() {
    this.trayDice.set([]);
    this.modifier.set(0);
  }

  rollTray() {
    if (this.trayDice().length === 0) return;
    
    this.isRolling.set(true);
    
    setTimeout(() => {
      const dieResults: { sides: number, value: number }[] = [];
      this.trayDice().forEach(d => {
        for (let i = 0; i < d.count; i++) {
          dieResults.push({ sides: d.sides, value: Math.floor(Math.random() * d.sides) + 1 });
        }
      });

      let finalValue = 0;
      const rawValues = dieResults.map(r => r.value);
      
      if (this.rollMode() === 'sum') {
        finalValue = rawValues.reduce((a, b) => a + b, 0) + this.modifier();
      } else if (this.rollMode() === 'highest') {
        finalValue = Math.max(...rawValues) + this.modifier();
      } else if (this.rollMode() === 'lowest') {
        finalValue = Math.min(...rawValues) + this.modifier();
      }

      this.currentResult.set({
        dieResults,
        modifier: this.modifier(),
        mode: this.rollMode(),
        finalValue,
        timestamp: Date.now()
      });
      
      this.isRolling.set(false);
      this.showResultModal.set(true);
    }, 800);
  }

  closeModal() {
    this.showResultModal.set(false);
  }
}
