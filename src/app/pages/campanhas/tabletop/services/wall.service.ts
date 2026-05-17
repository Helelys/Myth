import { Injectable, signal, computed } from '@angular/core';
import { Wall, WallDoor, WallFlags, WallData, DEFAULT_WALL_DATA, DEFAULT_WALL_FLAGS } from '../models/wall.model';

/**
 * ═══════════════════════════════════════════════════════════
 * WALL SERVICE — Gerenciamento de paredes com spatial grid
 * ═══════════════════════════════════════════════════════════
 *
 * Responsabilidades:
 *   ✔ CRUD de paredes (criar, ler, atualizar, deletar)
 *   ✔ Spatial partitioning (grid) para queries rápidas
 *   ✔ Gerenciamento de portas em paredes
 *   ✔ Serialização/deserialização
 *
 * Spatial Grid:
 *   - Divide o mundo em células de 500px
 *   - Cada parede é indexada nas células que intersecta
 *   - Raycasting consulta apenas células relevantes
 *   - Evita O(n) em todas as paredes
 */
@Injectable({ providedIn: 'root' })
export class WallService {
    // ═══════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════

    /** Tamanho da célula do spatial grid */
    static readonly SPATIAL_CELL_SIZE = 500;

    // ═══════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════

    private wallsSignal = signal<Wall[]>([]);

    /** Todas as paredes */
    readonly walls = this.wallsSignal.asReadonly();

    /** Contagem de paredes */
    readonly wallCount = computed(() => this.wallsSignal().length);

    /**
     * Spatial grid: mapa de célula → IDs de paredes na célula.
     * Chave: `${cellX},${cellY}`
     */
    private spatialGrid = new Map<string, Set<string>>();

    /** Flag de modo edição de paredes */
    private wallEditModeSignal = signal(false);
    readonly wallEditMode = this.wallEditModeSignal.asReadonly();

    // ═══════════════════════════════════════════════════════
    // WALL CRUD
    // ═══════════════════════════════════════════════════════

    /**
     * Adiciona uma nova parede.
     */
    addWall(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        flags: WallFlags = { ...DEFAULT_WALL_FLAGS },
        visible = true,
        color?: string,
    ): Wall {
        const wall: Wall = {
            id: `wall-${crypto.randomUUID()}`,
            x1, y1, x2, y2,
            flags,
            visible,
            color,
        };

        this.wallsSignal.update(list => [...list, wall]);
        this.indexWall(wall);
        return wall;
    }

    /**
     * Remove uma parede pelo ID.
     */
    removeWall(id: string): void {
        this.wallsSignal.update(list => {
            const wall = list.find(w => w.id === id);
            if (wall) {
                this.unindexWall(wall);
            }
            return list.filter(w => w.id !== id);
        });
    }

    /**
     * Atualiza uma parede existente.
     */
    updateWall(id: string, changes: Partial<Wall>): void {
        this.wallsSignal.update(list =>
            list.map(w => {
                if (w.id !== id) return w;

                // Reindexar se posição mudou
                if (changes.x1 !== undefined || changes.y1 !== undefined ||
                    changes.x2 !== undefined || changes.y2 !== undefined) {
                    this.unindexWall(w);
                    const updated = { ...w, ...changes };
                    this.indexWall(updated);
                    return updated;
                }

                return { ...w, ...changes };
            }),
        );
    }

    /** Obtém uma parede por ID */
    getWallById(id: string): Wall | undefined {
        return this.wallsSignal().find(w => w.id === id);
    }

    /** Remove todas as paredes */
    clearWalls(): void {
        this.spatialGrid.clear();
        this.wallsSignal.set([]);
    }

    // ═══════════════════════════════════════════════════════
    // SPATIAL QUERIES
    // ═══════════════════════════════════════════════════════

    /**
     * Retorna paredes que podem intersectar uma região circular.
     * Usa o spatial grid para evitar O(n).
     *
     * @param cx Centro X
     * @param cy Centro Y
     * @param radius Raio de interesse
     * @returns Lista de paredes na área
     */
    queryWallsInRadius(cx: number, cy: number, radius: number): Wall[] {
        const allWalls = this.wallsSignal();
        if (allWalls.length === 0) return [];

        const cellSize = WallService.SPATIAL_CELL_SIZE;
        const minCellX = Math.floor((cx - radius) / cellSize);
        const maxCellX = Math.floor((cx + radius) / cellSize);
        const minCellY = Math.floor((cy - radius) / cellSize);
        const maxCellY = Math.floor((cy + radius) / cellSize);

        const wallIds = new Set<string>();

        for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
            for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
                const key = `${cellX},${cellY}`;
                const cellWalls = this.spatialGrid.get(key);
                if (cellWalls) {
                    for (const id of cellWalls) {
                        wallIds.add(id);
                    }
                }
            }
        }

        // Filtra apenas paredes no raio (bounding box check)
        const radiusSq = radius * radius;
        return allWalls.filter(w => {
            if (!wallIds.has(w.id)) return false;
            // Verifica se o segmento está dentro do raio
            // Aproximação: verifica se o ponto central do segmento está no raio
            const mx = (w.x1 + w.x2) / 2;
            const my = (w.y1 + w.y2) / 2;
            const dx = mx - cx;
            const dy = my - cy;
            return dx * dx + dy * dy <= radiusSq;
        });
    }

    /**
     * Retorna TODAS as paredes que bloqueiam luz.
     * Para raycasting otimizado.
     */
    getWallsBlockingLight(): Wall[] {
        return this.wallsSignal().filter(w =>
            w.flags.blocksLight && (!w.door || !w.door.open),
        );
    }

    /**
     * Retorna TODAS as paredes que bloqueiam visão.
     * Para raycasting otimizado.
     */
    getWallsBlockingVision(): Wall[] {
        return this.wallsSignal().filter(w =>
            w.flags.blocksVision && (!w.door || !w.door.open),
        );
    }

    /**
     * Retorna TODAS as paredes que bloqueiam movimento.
     * Para collision detection.
     */
    getWallsBlockingMovement(): Wall[] {
        return this.wallsSignal().filter(w =>
            w.flags.blocksMovement && (!w.door || !w.door.open),
        );
    }

    // ═══════════════════════════════════════════════════════
    // DOOR MANAGEMENT
    // ═══════════════════════════════════════════════════════

    /**
     * Adiciona uma porta a uma parede existente.
     */
    addDoorToWall(
        wallId: string,
        name: string,
        position: number,
        width: number,
    ): WallDoor | null {
        const wall = this.getWallById(wallId);
        if (!wall) return null;

        const door: WallDoor = {
            id: `door-${crypto.randomUUID()}`,
            name,
            open: false,
            position: Math.max(0.05, Math.min(0.95, position)),
            width: Math.max(20, width),
        };

        this.updateWall(wallId, { door });
        return door;
    }

    /**
     * Alterna estado de uma porta.
     */
    toggleDoor(doorId: string): void {
        this.wallsSignal.update(list =>
            list.map(w => {
                if (w.door?.id !== doorId) return w;
                return {
                    ...w,
                    door: { ...w.door, open: !w.door.open },
                };
            }),
        );
    }

    /** Remove a porta de uma parede */
    removeDoorFromWall(wallId: string): void {
        this.updateWall(wallId, { door: undefined });
    }

    // ═══════════════════════════════════════════════════════
    // MODE TOGGLE
    // ═══════════════════════════════════════════════════════

    toggleWallEditMode(): void {
        this.wallEditModeSignal.update(v => !v);
    }

    setWallEditMode(enabled: boolean): void {
        this.wallEditModeSignal.set(enabled);
    }

    // ═══════════════════════════════════════════════════════
    // SPATIAL INDEXING
    // ═══════════════════════════════════════════════════════

    /**
     * Indexa uma parede no spatial grid.
     * Calcula quais células o segmento intersecta.
     */
    private indexWall(wall: Wall): void {
        const cells = this.getCellsForSegment(wall.x1, wall.y1, wall.x2, wall.y2);
        for (const cell of cells) {
            const key = `${cell.cx},${cell.cy}`;
            if (!this.spatialGrid.has(key)) {
                this.spatialGrid.set(key, new Set());
            }
            this.spatialGrid.get(key)!.add(wall.id);
        }
    }

    /**
     * Remove uma parede do spatial grid.
     */
    private unindexWall(wall: Wall): void {
        const cells = this.getCellsForSegment(wall.x1, wall.y1, wall.x2, wall.y2);
        for (const cell of cells) {
            const key = `${cell.cx},${cell.cy}`;
            const cellSet = this.spatialGrid.get(key);
            if (cellSet) {
                cellSet.delete(wall.id);
                if (cellSet.size === 0) {
                    this.spatialGrid.delete(key);
                }
            }
        }
    }

    /**
     * Calcula quais células um segmento de reta intersecta.
     * Usa DDA-like traversal para segmentos longos.
     */
    private getCellsForSegment(
        x1: number, y1: number,
        x2: number, y2: number,
    ): { cx: number; cy: number }[] {
        const cellSize = WallService.SPATIAL_CELL_SIZE;
        const cells = new Set<string>();

        // Inclui always as células das extremidades
        const addCell = (x: number, y: number) => {
            const cx = Math.floor(x / cellSize);
            const cy = Math.floor(y / cellSize);
            cells.add(`${cx},${cy}`);
        };

        addCell(x1, y1);
        addCell(x2, y2);

        // Para segmentos longos, amostra pontos intermediários
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);

        if (length > cellSize) {
            // Amostra a cada cellSize/2 ao longo do segmento
            const steps = Math.ceil(length / (cellSize / 2));
            for (let i = 1; i < steps; i++) {
                const t = i / steps;
                addCell(x1 + dx * t, y1 + dy * t);
            }
        }

        return Array.from(cells).map(k => {
            const [cx, cy] = k.split(',').map(Number);
            return { cx, cy };
        });
    }

    // ═══════════════════════════════════════════════════════
    // SERIALIZATION
    // ═══════════════════════════════════════════════════════

    getSnapshot(): WallData {
        return {
            walls: this.wallsSignal(),
        };
    }

    loadFromSnapshot(data: WallData): void {
        this.spatialGrid.clear();
        this.wallsSignal.set(data.walls ?? []);
        // Re-indexar todas
        for (const wall of this.wallsSignal()) {
            this.indexWall(wall);
        }
    }

    clear(): void {
        this.clearWalls();
    }
}
