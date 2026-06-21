import { Injectable, signal, computed } from '@angular/core';
import { LightSource, LightData, DEFAULT_LIGHT_DATA, DEFAULT_LIGHT_SOURCE } from '../models/light-source.model';

/**
 * ═══════════════════════════════════════════════════════════
 * LIGHT SERVICE — Gerenciamento de fontes de luz
 * ═══════════════════════════════════════════════════════════
 *
 * Responsabilidades:
 *   ✔ CRUD de fontes de luz
 *   ✔ Luzes de token (automáticas)
 *   ✔ Luz ambiente
 *   ✔ State management com signals
 */
@Injectable({ providedIn: 'root' })
export class LightService {
    private lightsSignal = signal<LightSource[]>([]);
    private ambientLightSignal = signal<LightSource | null>(null);

    /** Todas as luzes */
    readonly lights = this.lightsSignal.asReadonly();

    /** Luz ambiente (ilumina tudo sem raycasting) */
    readonly ambientLight = this.ambientLightSignal.asReadonly();

    /** Contagem de luzes */
    readonly lightCount = computed(() => this.lightsSignal().length);

    /** Se há alguma luz ativa */
    readonly hasActiveLights = computed(() =>
        this.lightsSignal().some(l => l.enabled) || this.ambientLightSignal()?.enabled === true,
    );

    // ═══════════════════════════════════════════════════════
    // CRUD
    // ═══════════════════════════════════════════════════════

    addLight(light: Omit<LightSource, 'id'>): LightSource {
        const newLight: LightSource = {
            ...light,
            id: `light-${crypto.randomUUID()}`,
        };
        this.lightsSignal.update(list => [...list, newLight]);
        return newLight;
    }

    updateLight(id: string, changes: Partial<LightSource>): void {
        this.lightsSignal.update(list =>
            list.map(l => l.id === id ? { ...l, ...changes } : l),
        );
    }

    removeLight(id: string): void {
        this.lightsSignal.update(list => list.filter(l => l.id !== id));
    }

    getLightById(id: string): LightSource | undefined {
        return this.lightsSignal().find(l => l.id === id);
    }

    /** Cria uma luz associada a um token */
    createTokenLight(tokenId: string, radius: number, color: string): LightSource {
        const id = `light-${tokenId}`;
        const newLight: LightSource = {
            id,
            x: 0, y: 0,
            radius,
            intensity: 0.8,
            color,
            type: 'token',
            enabled: true,
            useRaycasting: true,
            softness: 0.4,
            tokenId,
        };
        this.lightsSignal.update(list => [...list, newLight]);
        return newLight;
    }


    removeTokenLight(tokenId: string): void {
        this.lightsSignal.update(list =>
            list.filter(l => l.tokenId !== tokenId),
        );
    }

    /** Atualiza posição de todas as luzes de token (chamado quando token move) */
    updateTokenLightPosition(tokenId: string, x: number, y: number): void {
        this.lightsSignal.update(list =>
            list.map(l =>
                l.tokenId === tokenId ? { ...l, x, y } : l,
            ),
        );
    }

    // ═══════════════════════════════════════════════════════
    // AMBIENT LIGHT
    // ═══════════════════════════════════════════════════════

    setAmbientLight(light: LightSource | null): void {
        this.ambientLightSignal.set(light);
    }

    removeAmbientLight(): void {
        this.ambientLightSignal.set(null);
    }

    // ═══════════════════════════════════════════════════════
    // QUERIES FOR RENDERER
    // ═══════════════════════════════════════════════════════

    /** Retorna luzes ativas (para o renderizador) */
    getActiveLights(): LightSource[] {
        return this.lightsSignal().filter(l => l.enabled);
    }

    // ═══════════════════════════════════════════════════════
    // SERIALIZATION
    // ═══════════════════════════════════════════════════════

    getSnapshot(): LightData {
        return {
            lights: this.lightsSignal(),
        };
    }

    loadFromSnapshot(data: LightData): void {
        this.lightsSignal.set(data.lights ?? []);
    }

    clear(): void {
        this.lightsSignal.set([]);
        this.ambientLightSignal.set(null);
    }
}
