/**
 * ═══════════════════════════════════════════════════════════
 * GEOMETRY UTILS — Funções de geometria vetorial
 * ═══════════════════════════════════════════════════════════
 *
 * Usadas para:
 * ✔ Interseção de segmentos (colisão de borda)
 * ✔ Ponto dentro de polígono (inside fog check)
 * ✔ Distância ponto a segmento
 * ✔ Cálculo de bordas de região
 *
 * TODAS as funções são matemática pura — NÃO dependem de Konva.
 */

import { LineSegment, Point2D, FogEdge, FogRegion } from '../models/fog-region.model';

// ═══════════════════════════════════════════════════════════
// EDGE CROSSING RESULT
// ═══════════════════════════════════════════════════════════

/**
 * Resultado da detecção de cruzamento de borda.
 *
 * - Se `passedThroughDoor === false`: borda SEM porta foi cruzada → BLOQUEAR
 * - Se `passedThroughDoor === true`: APENAS portas abertas foram cruzadas → PERMITIR
 * - Se `null`: nenhuma borda foi cruzada → PERMITIR
 */
export interface EdgeCrossingResult {
    edge: FogEdge;
    intersection: Point2D;
    passedThroughDoor: boolean;
}

// ═══════════════════════════════════════════════════════════
// LINE SEGMENT INTERSECTION
// ═══════════════════════════════════════════════════════════

/**
 * Verifica se dois segmentos de reta se intersectam.
 * Retorna o ponto de interseção ou null.
 *
 * Usa o algoritmo de orientação (cross product) para detectar
 * interseção própria entre segmentos.
 */
export function segmentsIntersect(
    a: LineSegment,
    b: LineSegment,
): Point2D | null {
    const d1x = a.x2 - a.x1;
    const d1y = a.y2 - a.y1;
    const d2x = b.x2 - b.x1;
    const d2y = b.y2 - b.y1;

    const cross = d1x * d2y - d1y * d2x;
    if (Math.abs(cross) < 1e-10) return null; // paralelos

    const dx = b.x1 - a.x1;
    const dy = b.y1 - a.y1;

    const t = (dx * d2y - dy * d2x) / cross;
    const u = (dx * d1y - dy * d1x) / cross;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        return {
            x: a.x1 + t * d1x,
            y: a.y1 + t * d1y,
        };
    }

    return null;
}

// ═══════════════════════════════════════════════════════════
// POINT INSIDE POLYGON
// ═══════════════════════════════════════════════════════════

/**
 * Verifica se um ponto está dentro de um retângulo.
 */
export function isPointInRect(
    px: number,
    py: number,
    rx: number,
    ry: number,
    rw: number,
    rh: number,
): boolean {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

/**
 * Verifica se um ponto está dentro de um polígono (brush).
 * Usa ray casting algorithm.
 */
export function isPointInPolygon(
    px: number,
    py: number,
    points: number[],
): boolean {
    let inside = false;
    const n = points.length / 2;

    for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = points[i * 2];
        const yi = points[i * 2 + 1];
        const xj = points[j * 2];
        const yj = points[j * 2 + 1];

        const intersect =
            yi > py !== yj > py &&
            px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;

        if (intersect) inside = !inside;
    }

    return inside;
}

// ═══════════════════════════════════════════════════════════
// DISTANCE POINT TO SEGMENT
// ═══════════════════════════════════════════════════════════

/**
 * Calcula a distância mínima de um ponto a um segmento de reta.
 */
export function distancePointToSegment(
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
        // Ponto único
        return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    }

    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = x1 + t * dx;
    const projY = y1 + t * dy;

    return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

// ═══════════════════════════════════════════════════════════
// EDGE COMPUTATION
// ═══════════════════════════════════════════════════════════

/**
 * Computa as 4 bordas de uma região retangular.
 * Bordas são segmentos no sentido horário: top → right → bottom → left.
 */
export function computeRectEdges(
    x: number,
    y: number,
    width: number,
    height: number,
): FogEdge[] {
    const edges: FogEdge[] = [
        // Top
        computeEdge(0, x, y, x + width, y),
        // Right
        computeEdge(1, x + width, y, x + width, y + height),
        // Bottom
        computeEdge(2, x + width, y + height, x, y + height),
        // Left
        computeEdge(3, x, y + height, x, y),
    ];

    return edges;
}

/**
 * Computa as bordas de um brush (fecha o polígono).
 * Cada par de pontos consecutivos forma uma borda, mais a borda
 * de fechamento do último ao primeiro ponto.
 */
export function computeBrushEdges(points: number[]): FogEdge[] {
    const edges: FogEdge[] = [];
    const n = points.length / 2;

    if (n < 2) return edges;

    for (let i = 0; i < n - 1; i++) {
        edges.push(
            computeEdge(
                i,
                points[i * 2],
                points[i * 2 + 1],
                points[(i + 1) * 2],
                points[(i + 1) * 2 + 1],
            ),
        );
    }

    // Fecha o polígono
    if (n >= 3) {
        edges.push(
            computeEdge(
                n - 1,
                points[(n - 1) * 2],
                points[(n - 1) * 2 + 1],
                points[0],
                points[1],
            ),
        );
    }

    return edges;
}

function computeEdge(
    index: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
): FogEdge {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    return {
        index,
        x1,
        y1,
        x2,
        y2,
        length,
        angle,
        doorIds: [],
    };
}

// ═══════════════════════════════════════════════════════════
// CROSSING DETECTION
// ═══════════════════════════════════════════════════════════

/**
 * Verifica se um movimento de um ponto a outro CRUZA alguma borda
 * de uma região de fog.
 *
 * Retorna a borda cruzada e o ponto de interseção, ou null se não
 * houver cruzamento.
 *
 * IMPORTANTE: verifica apenas TRAJETÓRIA (não posição final).
 * O token pode estar dentro da fog e se mover livremente DENTRO.
 * A colisão só ocorre ao CRUZAR a borda.
 */
/**
 * @deprecated Use detectEdgeCrossingV2 que retorna EdgeCrossingResult.
 */
export function detectEdgeCrossing(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    region: FogRegion,
): { edge: FogEdge; intersection: Point2D } | null {
    const result = detectEdgeCrossingV2(fromX, fromY, toX, toY, region);
    if (!result || result.passedThroughDoor) return null;
    return { edge: result.edge, intersection: result.intersection };
}

/**
 * Verifica se um movimento de um ponto a outro CRUZA alguma borda
 * de uma região de fog.
 *
 * Retorna EdgeCrossingResult completo ou null se não houver cruzamento.
 *
 * IMPORTANTE:
 * - Se `passedThroughDoor === true`: token cruzou APENAS portas abertas → PERMITIR
 * - Se `passedThroughDoor === false`: token cruzou borda SEM porta → BLOQUEAR
 * - Se `null`: nenhuma borda cruzada → PERMITIR
 */
export function detectEdgeCrossingV2(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    region: FogRegion,
): EdgeCrossingResult | null {
    const movement: LineSegment = {
        x1: fromX,
        y1: fromY,
        x2: toX,
        y2: toY,
    };

    let bestResult: { edge: FogEdge; intersection: Point2D; dist: number } | null = null;

    for (const edge of region.edges) {
        const edgeSegment: LineSegment = {
            x1: edge.x1,
            y1: edge.y1,
            x2: edge.x2,
            y2: edge.y2,
        };

        const intersection = segmentsIntersect(movement, edgeSegment);
        if (intersection) {
            // Verifica se a interseção está numa porta aberta
            const isOnOpenDoor = isPointOnOpenDoor(intersection, region);

            if (isOnOpenDoor) {
                // Porta aberta → permite passagem
                continue;
            }

            // Calcula distância do ponto inicial à interseção
            const dx = intersection.x - fromX;
            const dy = intersection.y - fromY;
            const dist = dx * dx + dy * dy;

            if (!bestResult || dist < bestResult.dist) {
                bestResult = { edge, intersection, dist };
            }
        }
    }

    if (bestResult) {
        return { edge: bestResult.edge, intersection: bestResult.intersection, passedThroughDoor: false };
    }

    return null;
}

/**
 * Verifica se um ponto de interseção está sobre uma porta ABERTA.
 */
function isPointOnOpenDoor(point: Point2D, region: FogRegion): boolean {
    for (const door of region.doors) {
        if (!door.open) continue;

        // A porta é um segmento centrado em (door.x, door.y)
        // com largura door.width e ângulo door.angle
        const halfW = door.width / 2;
        const cosA = Math.cos(door.angle);
        const sinA = Math.sin(door.angle);

        // Extremidades da porta
        const dx1 = door.x - halfW * cosA;
        const dy1 = door.y - halfW * sinA;
        const dx2 = door.x + halfW * cosA;
        const dy2 = door.y + halfW * sinA;

        // Verifica se o ponto está no segmento da porta
        const dist = distancePointToSegment(point.x, point.y, dx1, dy1, dx2, dy2);
        if (dist < 5) {
            // Margem de 5 unidades
            return true;
        }
    }

    return false;
}

// ═══════════════════════════════════════════════════════════
// REGION FACTORY
// ═══════════════════════════════════════════════════════════

/**
 * Cria uma FogRegion retangular com bordas computadas.
 */
export function createRectRegion(
    x: number,
    y: number,
    width: number,
    height: number,
): FogRegion {
    return {
        id: `fog-${crypto.randomUUID()}`,
        type: 'rectangle',
        x,
        y,
        width,
        height,
        edges: computeRectEdges(x, y, width, height),
        doors: [],
    };
}

/**
 * Cria uma FogRegion do tipo brush com bordas computadas.
 */
export function createBrushRegion(points: number[]): FogRegion {
    if (points.length < 4) {
        throw new Error('Brush precisa de pelo menos 2 pontos (4 coordenadas)');
    }

    return {
        id: `fog-${crypto.randomUUID()}`,
        type: 'brush',
        x: points[0],
        y: points[1],
        points: [...points],
        edges: computeBrushEdges(points),
        doors: [],
    };
}
