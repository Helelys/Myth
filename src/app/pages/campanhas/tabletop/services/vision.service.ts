import { Injectable, signal, computed, inject } from '@angular/core';

import { WallService } from './wall.service';
import { ExplorationService } from './exploration.service';
import { LightService } from './light.service';
import { TokenService } from './token.service';
import { computeVisibilityPolygon, isPointInPolygon } from '../utils/geometry-utils';
import { Point2D } from '../models/fog-region.model';

/**
 * ═══════════════════════════════════════════════════════════
 * VISION SERVICE — Sistema de visão e iluminação por token
 * ═══════════════════════════════════════════════════════════
 *
 * Responsabilidades:
 *   ✔ Calcular polígonos de visibilidade para cada luz
 *   ✔ Calcular visão de campo de cada token (darkvision, blindsight, etc.)
 *   ✔ Atualizar ExplorationMemory com áreas visíveis
 *   ✔ Fornecer cutout polygons para o renderer
 *
 * Este serviço orquestra:
 *   - WallService (paredes que bloqueiam)
 *   - LightService (fontes de luz)
 *   - ExplorationService (memória de exploração)
 *   - TokenService (posição dos tokens para visão)
 */

export interface VisibilityPolygon {
    /** Pontos do polígono (x, y alternados) */
    points: number[];
    /** Cor da luz (para luzes coloridas) */
    color: string;
    /** Intensidade (0-1) */
    intensity: number;
    /** Tipo: 'light' | 'vision' | 'ambient' */
    type: 'light' | 'vision' | 'ambient';
    /** Origem */
    originX: number;
    originY: number;
}

@Injectable({ providedIn: 'root' })
export class VisionService {
    private polygonsSignal = signal<VisibilityPolygon[]>([]);

    /** Polígonos de visibilidade computados */
    readonly visibilityPolygons = this.polygonsSignal.asReadonly();

    constructor(
        private wallService: WallService,
        private lightService: LightService,
        private explorationService: ExplorationService,
        private tokenService: TokenService,
    ) { }

    /**
     * Marcado como obsoleto ("deprecated").
     * Antigamente controlava um cache de dirty flag que
     * permitia que computeVisibility() retornasse dados
     * antigos. Isso viola o princípio de iluminação dinâmica
     * (luz recalculada do zero a cada frame).
     *
     * Agora é um no-op — mantido apenas para compatibilidade
     * com callers externos (token.service.ts, fog.renderer.ts).
     */
    markDirty(): void {
        // No-op: iluminação dinâmica NÃO usa cache.
        // Toda renderização recalcula do zero.
    }

    /**
     * Computa todos os polígonos de visibilidade.
     * Chamado pelo renderer a cada frame.
     *
     * ⚠️ SEMPRE recalcula do zero — esta função é chamada
     * a cada render() e precisa refletir o estado ATUAL
     * de luzes e tokens. Não deve usar cache porque a
     * iluminação dinâmica NÃO é persistente.
     *
     * A luz NÃO é tinta no mapa.
     * A luz é estado momentâneo do frame atual.
     */
    computeVisibility(): VisibilityPolygon[] {
        const polygons: VisibilityPolygon[] = [];
        const walls = this.wallService.getWallsBlockingLight();

        // ────────────────────────────────────────────
        // LUZ AMBIENTE
        // ────────────────────────────────────────────
        const ambient = this.lightService.ambientLight();
        if (ambient && ambient.enabled) {
            polygons.push({
                points: [],
                color: ambient.color,
                intensity: ambient.intensity,
                type: 'ambient',
                originX: ambient.x,
                originY: ambient.y,
            });
        }

        // ────────────────────────────────────────────
        // LUZES ATIVAS (inclui TokenLight sincronizado)
        // ────────────────────────────────────────────
        const activeLights = this.lightService.getActiveLights();

        for (const light of activeLights) {
            if (!light.enabled) continue;

            if (light.type === 'ambient') continue;

            if (!light.useRaycasting || walls.length === 0) {
                const pts = computeVisibilityPolygon(
                    { x: light.x, y: light.y },
                    [],
                    light.radius,
                    light.type === 'cone' ? light.angle : undefined,
                    light.type === 'cone' ? light.rotation : undefined,
                );

                polygons.push({
                    points: pts,
                    color: light.color,
                    intensity: light.intensity,
                    type: 'light',
                    originX: light.x,
                    originY: light.y,
                });
            } else {
                const pts = computeVisibilityPolygon(
                    { x: light.x, y: light.y },
                    walls,
                    light.radius,
                    light.type === 'cone' ? light.angle : undefined,
                    light.type === 'cone' ? light.rotation : undefined,
                );

                polygons.push({
                    points: pts,
                    color: light.color,
                    intensity: light.intensity,
                    type: 'light',
                    originX: light.x,
                    originY: light.y,
                });
            }
        }

        // ────────────────────────────────────────────
        // VISÃO DOS TOKENS (campo de visão)
        // Usa TokenVision se configurado, senão fallback
        // ────────────────────────────────────────────
        const wallsBlockVision = this.wallService.getWallsBlockingVision();
        const tokens = this.tokenService.tokenList();

        for (const token of tokens) {
            if (!token.visible) continue;

            const vision = token.vision;
            const visionEnabled = vision?.enabled ?? false;
            const visionRadius = vision?.radius ?? 300;
            const darkvision = vision?.darkvision ?? false;
            const blindsight = vision?.blindsight ?? false;
            const cone = vision?.cone ?? false;
            const coneAngle = vision?.angle ?? Math.PI / 3;

            // Se visão não está ativa → verifica outros critérios
            if (!visionEnabled) {
                // Sem darkvision e sem luzes → não vê
                if (!darkvision && activeLights.length === 0 && !ambient) {
                    continue;
                }
                // Se não enxerga no escuro (darkvision) e não há luzes → não vê
                if (!darkvision && activeLights.length === 0 && !ambient?.enabled) {
                    continue;
                }
            }

            const origin: Point2D = {
                x: token.x + token.width / 2,
                y: token.y + token.height / 2,
            };

            // Blindsight: revela em volta ignorando paredes
            if (blindsight && visionEnabled) {
                const circlePts: number[] = [];
                const segments = 32;
                for (let i = 0; i <= segments; i++) {
                    const a = (i / segments) * Math.PI * 2;
                    circlePts.push(origin.x + Math.cos(a) * visionRadius);
                    circlePts.push(origin.y + Math.sin(a) * visionRadius);
                }
                polygons.push({
                    points: circlePts,
                    color: '#ffffff',
                    intensity: 0.6,
                    type: 'vision',
                    originX: origin.x,
                    originY: origin.y,
                });
            }

            // Visão normal com raycasting (se enabled ou darkvision)
            if (visionEnabled || darkvision) {
                // Se cone de visão → não usa raycasting (visão limitada)
                const pts = computeVisibilityPolygon(
                    origin,
                    cone ? [] : wallsBlockVision,
                    visionRadius,
                );

                polygons.push({
                    points: pts,
                    color: '#ffffff',
                    intensity: 1.0,
                    type: 'vision',
                    originX: origin.x,
                    originY: origin.y,
                });
            }

        }

        // ════════════════════════════════════════════
        // ATENÇÃO: markExplored NÃO deve ser chamado aqui.
        // Isso causaria acumulação PERMANENTE de células
        // exploradas a CADA FRAME, impedindo que a escuridão
        // retorne quando o token se move.
        //
        // A exploração (explored) agora é salva SEPARADAMENTE,
        // apenas quando o token realmente se move
        // (em TokenService.moveToken).
        //
        // VISIBLE CELLS (visibleCells) é atualizado aqui SIM,
        // pois é um Set TEMPORÁRIO que expressa APENAS
        // o que está visível NESTE FRAME.
        // ════════════════════════════════════════════

        // Atualiza células visíveis do frame atual (temporário, não cumulativo)
        this.updateExplorationCells(polygons);

        this.polygonsSignal.set(polygons);
        return polygons;
    }

    /**
     * Atualiza o ExplorationService com as células visíveis
     * baseadas nos polígonos computados.
     */
    private updateExplorationCells(polygons: VisibilityPolygon[]): void {
        const cellSize = this.explorationService.config().cellSize;
        const visibleSet = new Set<string>();

        for (const poly of polygons) {
            if (poly.type === 'ambient') continue;

            if (poly.points.length < 6) {
                const cx = Math.floor(poly.originX / cellSize);
                const cy = Math.floor(poly.originY / cellSize);
                visibleSet.add(`${cx},${cy}`);
                continue;
            }

            const bounds = this.getPolygonBounds(poly.points);
            if (!bounds) continue;

            const minCellX = Math.floor(bounds.minX / cellSize);
            const maxCellX = Math.floor(bounds.maxX / cellSize);
            const minCellY = Math.floor(bounds.minY / cellSize);
            const maxCellY = Math.floor(bounds.maxY / cellSize);

            for (let cx = minCellX; cx <= maxCellX; cx++) {
                for (let cy = minCellY; cy <= maxCellY; cy++) {
                    const wx = (cx + 0.5) * cellSize;
                    const wy = (cy + 0.5) * cellSize;

                    if (isPointInPolygon(wx, wy, poly.points)) {
                        visibleSet.add(`${cx},${cy}`);
                    }
                }
            }
        }

        this.explorationService.setVisibleCells(visibleSet);
    }

    /** Obtém bounding box de um polígono */
    private getPolygonBounds(points: number[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
        if (points.length < 2) return null;

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        for (let i = 0; i < points.length; i += 2) {
            minX = Math.min(minX, points[i]);
            maxX = Math.max(maxX, points[i]);
            minY = Math.min(minY, points[i + 1]);
            maxY = Math.max(maxY, points[i + 1]);
        }

        return { minX, minY, maxX, maxY };
    }

    // ═══════════════════════════════════════════════════════
    // MÉTODOS PARA FogRenderer
    // ═══════════════════════════════════════════════════════

    /**
     * Atualiza as células visíveis (visibleCells) para o frame atual.
     * Chamado pelo FogRenderer após desenhar luzes e visão.
     * visibleCells é TEMPORÁRIO — recriado do zero a cada frame.
     */
    updateVisibleCellsForCurrentFrame(): void {
        const allPolygons: VisibilityPolygon[] = [];
        const walls = this.wallService.getWallsBlockingLight();
        const wallsBlockVision = this.wallService.getWallsBlockingVision();
        const tokens = this.tokenService.tokenList();
        const activeLights = this.lightService.getActiveLights();
        const ambient = this.lightService.ambientLight();

        // Luz ambiente
        if (ambient && ambient.enabled) {
            allPolygons.push({
                points: [],
                color: ambient.color,
                intensity: ambient.intensity,
                type: 'ambient',
                originX: ambient.x,
                originY: ambient.y,
            });
        }

        // Luzes ativas
        for (const light of activeLights) {
            if (!light.enabled || light.type === 'ambient') continue;
            const pts = computeVisibilityPolygon(
                { x: light.x, y: light.y },
                light.useRaycasting && walls.length > 0 ? walls : [],
                light.radius,
                light.type === 'cone' ? light.angle : undefined,
                light.type === 'cone' ? light.rotation : undefined,
            );
            allPolygons.push({
                points: pts,
                color: light.color,
                intensity: light.intensity,
                type: 'light',
                originX: light.x,
                originY: light.y,
            });
        }

        // Visão dos tokens
        for (const token of tokens) {
            if (!token.visible) continue;
            const vision = token.vision;
            const visionEnabled = vision?.enabled ?? false;
            const visionRadius = vision?.radius ?? 300;
            const darkvision = vision?.darkvision ?? false;
            const cone = vision?.cone ?? false;

            if (!visionEnabled && !darkvision && activeLights.length === 0 && !ambient?.enabled) continue;

            const origin: Point2D = {
                x: token.x + token.width / 2,
                y: token.y + token.height / 2,
            };

            if (visionEnabled || darkvision) {
                const pts = computeVisibilityPolygon(origin, cone ? [] : wallsBlockVision, visionRadius);
                allPolygons.push({
                    points: pts,
                    color: '#ffffff',
                    intensity: 1.0,
                    type: 'vision',
                    originX: origin.x,
                    originY: origin.y,
                });
            }
        }

        // Atualiza visibleCells (Set TEMPORÁRIO, substituído a cada frame)
        this.updateExplorationCells(allPolygons);
    }

    /**
     * Computa o polígono de visibilidade para uma única luz.
     */
    computeVisibilityPolygonForLight(light: any, walls: any[]): number[] | null {
        if (!light.enabled) return null;

        const origin: Point2D = { x: light.x, y: light.y };

        if (!light.useRaycasting || walls.length === 0) {
            return [];
        }

        return computeVisibilityPolygon(
            origin,
            walls,
            light.radius,
            light.type === 'cone' ? light.angle : undefined,
            light.type === 'cone' ? light.rotation : undefined,
        );
    }

    /**
     * Computa os polígonos de visão de todos os tokens ativos.
     * Agora suporta TokenVision completo (darkvision, blindsight, cone).
     */
    computeTokenVisionPolygons(): Array<{ points: number[]; originX: number; originY: number }> {
        const result: Array<{ points: number[]; originX: number; originY: number }> = [];
        const walls = this.wallService.getWallsBlockingVision();
        const tokens = this.tokenService.tokenList();
        const activeLights = this.lightService.getActiveLights();
        const ambient = this.lightService.ambientLight();

        for (const token of tokens) {
            if (!token.visible) continue;

            const vision = token.vision;
            const visionEnabled = vision?.enabled ?? false;
            const visionRadius = vision?.radius ?? 300;
            const darkvision = vision?.darkvision ?? false;
            const blindsight = vision?.blindsight ?? false;
            const cone = vision?.cone ?? false;

            if (!visionEnabled && !darkvision && activeLights.length === 0 && !ambient?.enabled) continue;

            const origin: Point2D = {
                x: token.x + token.width / 2,
                y: token.y + token.height / 2,
            };

            if (visionEnabled || darkvision) {
                const pts = computeVisibilityPolygon(origin, cone ? [] : walls, visionRadius);
                result.push({ points: pts, originX: origin.x, originY: origin.y });
            }

            // ════════════════════════════════════════════
            // ATENÇÃO: markExplored NÃO deve ser chamado aqui.
            // Isso é o mesmo problema do computeVisibility().
            // A exploração é salva apenas quando o token se move
            // (em TokenService.moveToken).
            // ════════════════════════════════════════════
        }

        return result;
    }
}
