import { Injectable, signal, computed } from '@angular/core';
import {
    ExplorationData,
    ExplorationConfig,
    CellVisibility,
    DEFAULT_EXPLORATION_CONFIG,
    DEFAULT_EXPLORATION_DATA,
} from '../models/exploration.model';

/**
 * ═══════════════════════════════════════════════════════════
 * EXPLORATION SERVICE — Memória de exploração do mapa
 * ═══════════════════════════════════════════════════════════
 *
 * Responsabilidades:
 *   ✔ Manter grid de células exploradas
 *   ✔ Marcar células como explored quando tokens se movem
 *   ✔ Fornecer queries de visibilidade por região
 *   ✔ Limpar visible quando luzes/visão mudam
 *
 * Funciona em conjunto com LightService e VisionService:
 *   - ExplorationService mantém o estado 'explored'
 *   - LightService/VisionService definem o estado 'visible'
 *   - O renderer combina ambos para determinar o estado final
 */
@Injectable({ providedIn: 'root' })
export class ExplorationService {
    private exploredSignal = signal<Record<string, boolean>>({});
    private visibleCellsSignal = signal<Set<string>>(new Set());
    private configSignal = signal<ExplorationConfig>({ ...DEFAULT_EXPLORATION_CONFIG });
    /**
     * Exploration Memory começa DESLIGADA por padrão.
     *
     * A exploração (explored) é um sistema OPCIONAL e persistente
     * que NÃO deve interferir na iluminação dinâmica do frame atual.
     *
     * O comportamento padrão do tabletop é:
     *   ✔ Luz dinâmica → recalculada do zero a cada frame
     *   ✔ Escuridão retorna quando token sai
     *   ✔ Exploration Memory → só ativada se o usuário ligar
     *
     * Quando ativada, exploration memory adiciona uma camada
     * semi-transparente (cinza escuro) sobre áreas visitadas,
     * mas isso NUNCA deve afetar a luz dinâmica atual.
     */
    private enabledSignal = signal(false);

    /** Grid de células exploradas */
    readonly explored = this.exploredSignal.asReadonly();

    /** Células atualmente visíveis */
    readonly visibleCells = this.visibleCellsSignal.asReadonly();

    /** Configuração */
    readonly config = this.configSignal.asReadonly();

    /** Se exploration memory está ativa */
    readonly enabled = this.enabledSignal.asReadonly();

    // ═══════════════════════════════════════════════════════
    // MARKING EXPLORED
    // ═══════════════════════════════════════════════════════

    /**
     * Marca uma área circular como explorada.
     * Chamado quando um token se move (com seu raio de visão).
     *
     * @param cx Centro X
     * @param cy Centro Y
     * @param radius Raio de visão do token
     */
    markExplored(cx: number, cy: number, radius: number): void {
        if (!this.enabledSignal()) return;

        const cellSize = this.configSignal().cellSize;
        const radiusCells = Math.ceil(radius / cellSize);
        const centerCellX = Math.floor(cx / cellSize);
        const centerCellY = Math.floor(cy / cellSize);
        const radiusSq = radius * radius;

        this.exploredSignal.update(explored => {
            const updated = { ...explored };

            for (let dx = -radiusCells; dx <= radiusCells; dx++) {
                for (let dy = -radiusCells; dy <= radiusCells; dy++) {
                    const cellX = centerCellX + dx;
                    const cellY = centerCellY + dy;
                    const key = `${cellX},${cellY}`;

                    if (updated[key]) continue; // Já explorado

                    // Verifica se o centro da célula está dentro do raio
                    const worldX = (cellX + 0.5) * cellSize;
                    const worldY = (cellY + 0.5) * cellSize;
                    const distSq = (worldX - cx) ** 2 + (worldY - cy) ** 2;

                    if (distSq <= radiusSq) {
                        updated[key] = true;
                    }
                }
            }

            return updated;
        });
    }

    /**
     * Marca pontos de um brush como explorados.
     * Usado quando brush revela área.
     */
    markBrushExplored(points: number[]): void {
        if (!this.enabledSignal() || points.length < 4) return;

        const cellSize = this.configSignal().cellSize;

        // Aproximação: percorre segmentos do brush
        this.exploredSignal.update(explored => {
            const updated = { ...explored };

            for (let i = 0; i < points.length - 2; i += 2) {
                const x1 = points[i];
                const y1 = points[i + 1];
                const x2 = points[i + 2];
                const y2 = points[i + 3];

                // Amostra ao longo do segmento
                const dx = x2 - x1;
                const dy = y2 - y1;
                const length = Math.sqrt(dx * dx + dy * dy);
                const steps = Math.max(1, Math.ceil(length / (cellSize / 2)));

                for (let s = 0; s <= steps; s++) {
                    const t = s / steps;
                    const wx = x1 + dx * t;
                    const wy = y1 + dy * t;
                    const cellX = Math.floor(wx / cellSize);
                    const cellY = Math.floor(wy / cellSize);
                    const key = `${cellX},${cellY}`;
                    updated[key] = true;
                }
            }

            return updated;
        });
    }

    // ═══════════════════════════════════════════════════════
    // VISIBLE CELLS (set by LightService/VisionService)
    // ═══════════════════════════════════════════════════════

    /**
     * Define as células atualmente visíveis.
     * Chamado pelo sistema de luz/visão a cada atualização.
     */
    setVisibleCells(cells: Set<string>): void {
        this.visibleCellsSignal.set(cells);
    }

    /** Limpa células visíveis (ex: quando luzes desligam) */
    clearVisibleCells(): void {
        this.visibleCellsSignal.set(new Set());
    }

    // ═══════════════════════════════════════════════════════
    // QUERIES
    // ═══════════════════════════════════════════════════════

    /**
     * Obtém o estado de visibilidade de uma coordenada do mundo.
     * Usado pelo renderer para determinar a opacidade de cada região.
     *
     * @returns 'invisible' | 'explored' | 'visible'
     */
    getCellVisibility(x: number, y: number): CellVisibility {
        if (!this.enabledSignal()) return 'visible';

        const cellSize = this.configSignal().cellSize;
        const cx = Math.floor(x / cellSize);
        const cy = Math.floor(y / cellSize);
        const key = `${cx},${cy}`;

        // Visible tem prioridade máxima
        if (this.visibleCellsSignal().has(key)) return 'visible';

        // Explored
        if (this.exploredSignal()[key]) return 'explored';

        // Invisible
        return 'invisible';
    }

    /**
     * Verifica se uma coordenada já foi explorada.
     */
    isExplored(x: number, y: number): boolean {
        const cellSize = this.configSignal().cellSize;
        const cx = Math.floor(x / cellSize);
        const cy = Math.floor(y / cellSize);
        return !!this.exploredSignal()[`${cx},${cy}`];
    }

    /**
     * Verifica se uma coordenada está visível agora.
     */
    isVisible(x: number, y: number): boolean {
        const cellSize = this.configSignal().cellSize;
        const cx = Math.floor(x / cellSize);
        const cy = Math.floor(y / cellSize);
        return this.visibleCellsSignal().has(`${cx},${cy}`);
    }

    // ═══════════════════════════════════════════════════════
    // CONFIG
    // ═══════════════════════════════════════════════════════

    setEnabled(enabled: boolean): void {
        this.enabledSignal.set(enabled);
    }

    setConfig(config: Partial<ExplorationConfig>): void {
        this.configSignal.update(c => ({ ...c, ...config }));
    }

    // ═══════════════════════════════════════════════════════
    // CLEAR / RESET
    // ═══════════════════════════════════════════════════════

    /** Limpa APENAS as células visíveis (explored permanece) */
    resetVisible(): void {
        this.visibleCellsSignal.set(new Set());
    }

    /** Limpa TODA a memória de exploração (volta ao início) */
    resetExploration(): void {
        this.exploredSignal.set({});
        this.visibleCellsSignal.set(new Set());
    }

    // ═══════════════════════════════════════════════════════
    // SERIALIZATION
    // ═══════════════════════════════════════════════════════

    getSnapshot(): ExplorationData {
        return {
            explored: { ...this.exploredSignal() },
            config: { ...this.configSignal() },
        };
    }

    loadFromSnapshot(data: ExplorationData): void {
        this.exploredSignal.set(data.explored ?? {});
        this.configSignal.set(data.config ?? { ...DEFAULT_EXPLORATION_CONFIG });
        this.visibleCellsSignal.set(new Set());
    }

    clear(): void {
        this.resetExploration();
        this.configSignal.set({ ...DEFAULT_EXPLORATION_CONFIG });
    }
}
