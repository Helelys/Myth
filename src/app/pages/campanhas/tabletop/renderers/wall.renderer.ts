import Konva from 'konva';
import { BaseRenderer } from './base-renderer';
import { LayerType } from '../models';
import { CameraService, WallService } from '../services';

/**
 * ═══════════════════════════════════════════════════════════
 * WALL RENDERER — Debug/edição de paredes
 * ═══════════════════════════════════════════════════════════
 *
 * Renderiza as paredes no canvas para edição visual.
 *
 * APARECE APENAS no modo de edição de paredes.
 * Em modo normal de jogo, as paredes são INVISÍVEIS.
 *
 * Cada parede é desenhada como:
 *   - Linha grossa na cor do tipo
 *   - Círculo nas extremidades (para seleção/arrasto)
 *   - Ícone de porta se tiver porta
 */
export class WallRenderer extends BaseRenderer {
    private wallShapes: Map<string, {
        line: Konva.Line;
        startDot: Konva.Circle;
        endDot: Konva.Circle;
        doorGroup?: Konva.Group;
    }> = new Map();

    constructor(
        stage: Konva.Stage,
        private wallService: WallService,
    ) {
        super(LayerType.Effect, stage); // Reusa Effect layer
        this.layer.listening(false);
        this.layer.visible(false); // Começa invisível
    }

    override render(camera: CameraService): void {
        const editMode = this.wallService.wallEditMode();

        if (!editMode) {
            this.layer.visible(false);
            return;
        }

        this.layer.visible(true);
        this.syncWalls();
        this.redraw();
    }

    private syncWalls(): void {
        const walls = this.wallService.walls();
        const currentIds = new Set(walls.map(w => w.id));

        // Remove paredes que não existem mais
        for (const [id] of this.wallShapes) {
            if (!currentIds.has(id)) {
                const shapes = this.wallShapes.get(id)!;
                shapes.line.destroy();
                shapes.startDot.destroy();
                shapes.endDot.destroy();
                shapes.doorGroup?.destroy();
                this.wallShapes.delete(id);
            }
        }

        // Adiciona/atualiza paredes
        for (const wall of walls) {
            if (this.wallShapes.has(wall.id)) {
                this.updateWallShape(wall);
            } else {
                this.createWallShape(wall);
            }
        }
    }

    private createWallShape(wall: any): void {
        const color = wall.color ?? '#FF6B6B';

        const line = new Konva.Line({
            points: [wall.x1, wall.y1, wall.x2, wall.y2],
            stroke: color,
            strokeWidth: 3,
            lineCap: 'round',
            name: `wall-line-${wall.id}`,
            listening: false,
        });
        this.layer.add(line);

        const startDot = new Konva.Circle({
            x: wall.x1,
            y: wall.y1,
            radius: 4,
            fill: color,
            name: `wall-start-${wall.id}`,
            listening: false,
        });
        this.layer.add(startDot);

        const endDot = new Konva.Circle({
            x: wall.x2,
            y: wall.y2,
            radius: 4,
            fill: color,
            name: `wall-end-${wall.id}`,
            listening: false,
        });
        this.layer.add(endDot);

        let doorGroup: Konva.Group | undefined;

        if (wall.door) {
            doorGroup = this.createDoorShape(wall);
        }

        this.wallShapes.set(wall.id, { line, startDot, endDot, doorGroup });
    }

    private updateWallShape(wall: any): void {
        const shapes = this.wallShapes.get(wall.id);
        if (!shapes) return;

        shapes.line.points([wall.x1, wall.y1, wall.x2, wall.y2]);
        shapes.startDot.position({ x: wall.x1, y: wall.y1 });
        shapes.endDot.position({ x: wall.x2, y: wall.y2 });

        const color = wall.color ?? '#FF6B6B';
        shapes.line.stroke(color);
        shapes.startDot.fill(color);
        shapes.endDot.fill(color);

        // Atualiza porta
        if (wall.door) {
            if (shapes.doorGroup) {
                shapes.doorGroup.destroy();
            }
            shapes.doorGroup = this.createDoorShape(wall);
        } else if (shapes.doorGroup) {
            shapes.doorGroup.destroy();
            shapes.doorGroup = undefined;
        }
    }

    private createDoorShape(wall: any): Konva.Group {
        const door = wall.door;

        // Calcula posição da porta ao longo da parede
        const dx = wall.x2 - wall.x1;
        const dy = wall.y2 - wall.y1;
        const midX = wall.x1 + dx * door.position;
        const midY = wall.y1 + dy * door.position;

        // Ângulo da parede
        const angle = Math.atan2(dy, dx);

        // Perpendicular
        const perpX = -Math.sin(angle);
        const perpY = Math.cos(angle);

        // Posição do ícone (um pouco offset da parede)
        const iconX = midX + perpX * 12;
        const iconY = midY + perpY * 12;

        const group = new Konva.Group({
            x: iconX,
            y: iconY,
            name: `wall-door-${wall.id}`,
            listening: false,
        });

        // Círculo da porta
        const circle = new Konva.Circle({
            radius: 6,
            fill: door.open ? '#4fc3f7' : '#FFD700',
            stroke: door.open ? '#29b6f6' : '#B8860B',
            strokeWidth: 1.5,
        });
        group.add(circle);

        // "D" dentro do círculo
        const text = new Konva.Text({
            text: door.open ? 'A' : 'D',
            fontSize: 8,
            fontFamily: 'monospace',
            fill: '#000',
            align: 'center',
            verticalAlign: 'middle',
            width: 12,
            height: 12,
            offsetX: 6,
            offsetY: 6,
        });
        group.add(text);

        this.layer.add(group);
        return group;
    }

    override clear(): void {
        for (const [, shapes] of this.wallShapes) {
            shapes.line.destroy();
            shapes.startDot.destroy();
            shapes.endDot.destroy();
            shapes.doorGroup?.destroy();
        }
        this.wallShapes.clear();
    }

    override destroy(): void {
        this.clear();
        super.destroy();
    }
}
