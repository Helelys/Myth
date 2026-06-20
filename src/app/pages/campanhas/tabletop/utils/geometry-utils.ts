/**
 * ═══════════════════════════════════════════════════════════
 * GEOMETRY UTILS — Funções de geometria vetorial + Raycasting
 * ═══════════════════════════════════════════════════════════
 *
 * Usadas para:
 * ✔ Interseção de segmentos (colisão de borda)
 * ✔ Ponto dentro de polígono (inside fog check)
 * ✔ Distância ponto a segmento
 * ✔ Cálculo de bordas de região
 * ✔ RAYCASTING (visibilidade, luz, linha de visão)
 * ✔ Visibility Polygon (polígono de visibilidade com obstrução)
 * ✔ Wall crossing (colisão de token contra paredes)
 *
 * TODAS as funções são matemática pura — NÃO dependem de Konva.
 */

import { LineSegment, Point2D, FogEdge, FogRegion } from '../models/fog-region.model';
import { Wall } from '../models/wall.model';

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
// CROSSING DETECTION (Fog)
// ═══════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════
// RAYCASTING — Visibility polygon computation
// ═══════════════════════════════════════════════════════════
//
// Algoritmo clássico de "visibility polygon" via raycasting:
//   1. Para cada vértice de parede, calcula-se o ângulo relativo
//      à origem da luz/visão
//   2. Adiciona-se um pequeno epsilon (+/-) para capturar bordas
//   3. Para cada ângulo, dispara-se um ray e encontra-se a parede
//      mais próxima
//   4. Constrói-se o polígono de visibilidade a partir dos pontos
//      de interseção
//
// Isso produz o efeito de luz "recortada" por paredes.
// ═══════════════════════════════════════════════════════════

/** Um raio (origem + direção) */
export interface Ray {
    origin: Point2D;
    direction: Point2D; // normalizado
    angle: number;
}

/** Resultado de raycasting */
export interface RaycastHit {
    /** Ponto de interseção */
    point: Point2D;
    /** Parede atingida */
    wall: Wall;
    /** Distância da origem */
    distance: number;
    /** Ângulo do raio */
    angle: number;
}

/**
 * Gera um polígono de visibilidade a partir de uma origem,
 * considerando um conjunto de paredes que bloqueiam.
 *
 * @param origin Origem da luz/visão
 * @param walls  Paredes que bloqueiam luz
 * @param radius Raio máximo de visão
 * @param coneAngle Opcional: ângulo do cone (radianos)
 * @param coneRotation Opcional: rotação do cone (radianos)
 * @returns Pontos do polígono de visibilidade (x, y alternados)
 */
export function computeVisibilityPolygon(
    origin: Point2D,
    walls: Wall[],
    radius: number,
    coneAngle?: number,
    coneRotation?: number,
): number[] {
    if (walls.length === 0) {
        // Sem paredes: polígono é um círculo completo
        return generateCirclePoints(origin, radius, 64, coneAngle, coneRotation);
    }

    // Coleta ângulos relevantes: extremidades das paredes + epsilon
    const angles = new Set<number>();
    const angleEps = 0.0001; // ~0.0057 graus

    for (const wall of walls) {
        if (!wall.flags.blocksLight) continue;
        const a1 = Math.atan2(wall.y1 - origin.y, wall.x1 - origin.x);
        const a2 = Math.atan2(wall.y2 - origin.y, wall.x2 - origin.x);
        angles.add(a1);
        angles.add(a2);
        angles.add(a1 - angleEps);
        angles.add(a1 + angleEps);
        angles.add(a2 - angleEps);
        angles.add(a2 + angleEps);
    }

    // Filtra ângulos dentro do cone, se aplicável
    let sortedAngles: number[] = [];
    if (coneAngle !== undefined && coneRotation !== undefined) {
        const halfCone = coneAngle / 2;
        const coneStart = coneRotation - halfCone;
        const coneEnd = coneRotation + halfCone;

        for (const a of angles) {
            let normalized = a;
            while (normalized < coneStart) normalized += Math.PI * 2;
            while (normalized > coneEnd) normalized -= Math.PI * 2;
            if (normalized >= coneStart && normalized <= coneEnd) {
                sortedAngles.push(a);
            }
        }

        // Adiciona as bordas do cone
        sortedAngles.push(coneRotation - halfCone);
        sortedAngles.push(coneRotation + halfCone);
    } else {
        sortedAngles = Array.from(angles);
    }

    // Ordena ângulos
    sortedAngles.sort((a, b) => a - b);

    // Para cada ângulo, dispara um raio e encontra a parede mais próxima
    const points: number[] = [];

    if (coneAngle !== undefined && coneRotation !== undefined) {
        points.push(origin.x, origin.y);
    }

    for (const angle of sortedAngles) {
        const dirX = Math.cos(angle);
        const dirY = Math.sin(angle);

        const hit = castRay(origin, dirX, dirY, walls, radius);
        if (hit) {
            points.push(hit.point.x, hit.point.y);
        } else {
            // Nada atingido: vai até a borda do raio
            points.push(
                origin.x + dirX * radius,
                origin.y + dirY * radius,
            );
        }
    }

    return points;
}

/**
 * Dispara um único raio da origem em uma direção e encontra
 * a parede mais próxima.
 */
export function castRay(
    origin: Point2D,
    dirX: number,
    dirY: number,
    walls: Wall[],
    maxDist: number,
): RaycastHit | null {
    let closestHit: RaycastHit | null = null;

    for (const wall of walls) {
        if (!wall.flags.blocksLight) continue;

        const hit = raySegmentIntersection(
            origin.x, origin.y,
            origin.x + dirX * maxDist, origin.y + dirY * maxDist,
            wall.x1, wall.y1, wall.x2, wall.y2,
        );

        if (hit && hit.distance > 1) { // Ignora interseção na origem
            if (!closestHit || hit.distance < closestHit.distance) {
                closestHit = {
                    point: hit.point,
                    wall,
                    distance: hit.distance,
                    angle: Math.atan2(dirY, dirX),
                };
            }
        }
    }

    return closestHit;
}

/**
 * Interseção entre um raio (segmento origem→max) e um segmento de parede.
 */
function raySegmentIntersection(
    ox: number, oy: number,
    rx: number, ry: number, // ponto máximo do raio
    wx1: number, wy1: number,
    wx2: number, wy2: number,
): { point: Point2D; distance: number } | null {
    const d1x = rx - ox;
    const d1y = ry - oy;
    const d2x = wx2 - wx1;
    const d2y = wy2 - wy1;

    const cross = d1x * d2y - d1y * d2x;
    if (Math.abs(cross) < 1e-10) return null; // paralelos

    const dx = wx1 - ox;
    const dy = wy1 - oy;

    const t = (dx * d2y - dy * d2x) / cross;
    const u = (dx * d1y - dy * d1x) / cross;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        return {
            point: {
                x: ox + t * d1x,
                y: oy + t * d1y,
            },
            distance: t * Math.sqrt(d1x * d1x + d1y * d1y),
        };
    }

    return null;
}

/**
 * Gera pontos de um círculo para fallback (sem paredes).
 */
export function generateCirclePoints(
    center: Point2D,
    radius: number,
    segments: number,
    coneAngle?: number,
    coneRotation?: number,
): number[] {
    const points: number[] = [];

    // ── CONE VERDADEIRO (triângulo/pirâmide) ──
    // Em vez de gerar pontos ao longo de um arco circular (setor circular),
    // geramos APENAS o ponto de origem + os 2 pontos das bordas do cone,
    // formando um triângulo com a extremidade reta (não arredondada).
    // Isso resulta em um cone de iluminação REAL como uma pirâmide:
    //   - Parte estreita no token
    //   - Expande linearmente até a distância máxima
    //   - Extremidade frontal RETA (não curvada)
    if (coneAngle !== undefined && coneRotation !== undefined) {
        const halfAngle = coneAngle / 2;
        const startAngle = coneRotation - halfAngle;
        const endAngle = coneRotation + halfAngle;

        // Origem do cone (vértice)
        points.push(center.x, center.y);

        // Borda esquerda do cone
        points.push(
            center.x + Math.cos(startAngle) * radius,
            center.y + Math.sin(startAngle) * radius,
        );

        // Borda direita do cone
        points.push(
            center.x + Math.cos(endAngle) * radius,
            center.y + Math.sin(endAngle) * radius,
        );

        return points;
    }

    // ── CÍRCULO COMPLETO (radial) ──
    const step = (Math.PI * 2) / segments;

    for (let i = 0; i <= segments; i++) {
        const angle = i * step;
        points.push(
            center.x + Math.cos(angle) * radius,
            center.y + Math.sin(angle) * radius,
        );
    }

    return points;
}

/**
 * Verifica se um segmento de movimento cruza alguma parede.
 * Para collision detection de tokens.
 */
export function detectWallCrossing(
    fromX: number, fromY: number,
    toX: number, toY: number,
    walls: Wall[],
): { wall: Wall; intersection: Point2D } | null {
    let best: { wall: Wall; intersection: Point2D; dist: number } | null = null;

    for (const wall of walls) {
        if (!wall.flags.blocksMovement) continue;

        const hit = raySegmentIntersection(
            fromX, fromY, toX, toY,
            wall.x1, wall.y1, wall.x2, wall.y2,
        );

        if (hit) {
            if (!best || hit.distance < best.dist) {
                best = { wall, intersection: hit.point, dist: hit.distance };
            }
        }
    }

    return best ? { wall: best.wall, intersection: best.intersection } : null;
}
