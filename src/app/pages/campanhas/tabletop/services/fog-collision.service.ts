import { Injectable, inject } from '@angular/core';
import { FogService } from './fog.service';
import { TokenService } from './token.service';
import { detectEdgeCrossing } from '../utils/geometry-utils';
import { CollisionResult, FogRegion, FogDoor } from '../models/fog-region.model';

/**
 * ═══════════════════════════════════════════════════════════
 * FOG COLLISION SERVICE — Colisão geométrica nas bordas da fog
 * ═══════════════════════════════════════════════════════════
 *
 * Responsabilidades:
 * ✔ Verificar se um movimento de token cruza borda de fog
 * ✔ Bloquear movimento se não houver porta aberta
 * ✔ Gerenciar portas (toggle, placement)
 *
 * NÃO usa pixel collision — apenas geometria vetorial.
 *
 * Regras:
 * - Token dentro da fog: move-se livremente DENTRO
 * - Token fora da fog: move-se livremente FORA
 * - CRUZAR borda sem porta aberta → BLOQUEADO
 * - CRUZAR borda com porta aberta → PERMITIDO
 */
@Injectable({ providedIn: 'root' })
export class FogCollisionService {
    private fogService = inject(FogService);
    private tokenService = inject(TokenService);

    // ═══════════════════════════════════════════════════════
    // COLLISION CHECK
    // ═══════════════════════════════════════════════════════

    /**
     * Verifica se um movimento de (fromX, fromY) para (toX, toY)
     * CRUZA alguma borda fechada de fog.
     *
     * @returns CollisionResult detalhado
     */
    checkMovement(
        fromX: number,
        fromY: number,
        toX: number,
        toY: number,
    ): CollisionResult {
        const regions = this.fogService.regions();
        const enabled = this.fogService.enabled();
        const gmVision = this.fogService.gmVision();

        // Se fog desligada ou GM vision ativa → sem colisão
        if (!enabled || gmVision) {
            return {
                blocked: false,
                regionId: null,
                edgeIndex: null,
                intersectionX: null,
                intersectionY: null,
                passedThroughDoor: false,
            };
        }

        for (const region of regions) {
            const crossing = detectEdgeCrossing(fromX, fromY, toX, toY, region);

            if (crossing) {
                return {
                    blocked: true,
                    regionId: region.id,
                    edgeIndex: crossing.edge.index,
                    intersectionX: crossing.intersection.x,
                    intersectionY: crossing.intersection.y,
                    passedThroughDoor: false,
                };
            }
        }

        return {
            blocked: false,
            regionId: null,
            edgeIndex: null,
            intersectionX: null,
            intersectionY: null,
            passedThroughDoor: false,
        };
    }

    /**
     * Verifica se um movimento de token específico é válido.
     * Se bloqueado, retorna a posição "empurrada" (volta um pouco).
     */
    validateTokenMovement(
        tokenId: string,
        targetX: number,
        targetY: number,
    ): { valid: boolean; blockedX: number; blockedY: number } {
        const token = this.tokenService.getTokenById(tokenId);
        if (!token) {
            return { valid: true, blockedX: targetX, blockedY: targetY };
        }

        const result = this.checkMovement(token.x, token.y, targetX, targetY);

        if (result.blocked && result.intersectionX !== null && result.intersectionY !== null) {
            // Empurra o token de volta (volta 80% do caminho da interseção)
            const dx = targetX - token.x;
            const dy = targetY - token.y;
            const ix = result.intersectionX - token.x;
            const iy = result.intersectionY - token.y;

            // Posição "empurrada": um pouco antes da borda
            const pushFraction = 0.85;
            const blockedX = token.x + ix * pushFraction;
            const blockedY = token.y + iy * pushFraction;

            return { valid: false, blockedX, blockedY };
        }

        return { valid: true, blockedX: targetX, blockedY: targetY };
    }

    // ═══════════════════════════════════════════════════════
    // DOOR MANAGEMENT
    // ═══════════════════════════════════════════════════════

    /**
     * Adiciona uma porta em uma borda de uma região retangular.
     * Só funciona para regiões do tipo 'rectangle'.
     *
     * @param regionId ID da região
     * @param edgeIndex Índice da borda (0=top, 1=right, 2=bottom, 3=left)
     * @param position Posição ao longo da borda (0-1, onde 0=início, 1=fim)
     * @param width Largura da porta
     */
    addDoor(
        regionId: string,
        edgeIndex: number,
        position: number, // 0-1 ao longo da borda
        width: number,
    ): FogDoor | null {
        const region = this.fogService.getRegionById(regionId);
        if (!region || region.type !== 'rectangle') return null;

        const edge = region.edges[edgeIndex];
        if (!edge) return null;

        // Posição ao longo da borda
        const t = Math.max(0.1, Math.min(0.9, position));
        const doorX = edge.x1 + (edge.x2 - edge.x1) * t;
        const doorY = edge.y1 + (edge.y2 - edge.y1) * t;

        // Ângulo normal à borda (perpendicular)
        const doorAngle = edge.angle + Math.PI / 2;

        const door: FogDoor = {
            id: `door-${crypto.randomUUID()}`,
            regionId,
            edgeIndex,
            x: doorX,
            y: doorY,
            width: Math.max(20, Math.min(width, edge.length * 0.8)),
            open: false, // Começa fechada
            angle: doorAngle,
        };

        this.fogService.addDoor(regionId, door);
        return door;
    }

    /**
     * Alterna o estado de uma porta (aberta ↔ fechada).
     */
    toggleDoor(doorId: string): void {
        this.fogService.toggleDoor(doorId);
    }

    /**
     * Encontra em qual borda o usuário clicou (para placement de porta).
     *
     * @param worldX Posição X do clique no mundo
     * @param worldY Posição Y do clique no mundo
     * @param regionId ID da região
     * @returns O índice da borda e a posição ao longo dela (0-1), ou null
     */
    findEdgeAtPosition(
        worldX: number,
        worldY: number,
        regionId: string,
    ): { edgeIndex: number; position: number } | null {
        const region = this.fogService.getRegionById(regionId);
        if (!region) return null;

        // Distância máxima para considerar "clicou na borda"
        const clickThreshold = 30;

        for (const edge of region.edges) {
            const dist = this.pointToSegmentDistance(
                worldX,
                worldY,
                edge.x1,
                edge.y1,
                edge.x2,
                edge.y2,
            );

            if (dist < clickThreshold) {
                // Calcula posição ao longo da borda (0-1)
                const dx = edge.x2 - edge.x1;
                const dy = edge.y2 - edge.y1;
                const lenSq = dx * dx + dy * dy;

                if (lenSq === 0) continue;

                const t = ((worldX - edge.x1) * dx + (worldY - edge.y1) * dy) / lenSq;
                const clampedT = Math.max(0, Math.min(1, t));

                return { edgeIndex: edge.index, position: clampedT };
            }
        }

        return null;
    }

    /**
     * Verifica se um ponto está próximo de uma porta existente
     * (para double-click toggle).
     */
    findDoorAtPosition(
        worldX: number,
        worldY: number,
        regionId: string,
    ): FogDoor | null {
        const region = this.fogService.getRegionById(regionId);
        if (!region) return null;

        const clickThreshold = 15;

        for (const door of region.doors) {
            const dx = worldX - door.x;
            const dy = worldY - door.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < clickThreshold) {
                return door;
            }
        }

        return null;
    }

    // ═══════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════

    private pointToSegmentDistance(
        px: number,
        py: number,
        x1: number,
        y1: number,
        x2: number,
        y2: number,
    ): number {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lenSq = dx * dx + dy * dy;

        if (lenSq === 0) {
            return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
        }

        let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));

        const projX = x1 + t * dx;
        const projY = y1 + t * dy;

        return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
    }
}
