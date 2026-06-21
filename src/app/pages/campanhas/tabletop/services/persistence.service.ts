import { Injectable, effect, inject } from '@angular/core';
import { MapData } from '../models';
import { MapService, TokenService, CameraService, FogService, GridService } from './';

/**
 * Estado completo e serializável do Tabletop VTT.
 *
 * REGRAS:
 * - mapas: NUNCA salvam imageObj (HTMLImageElement não é serializável)
 * - grid: NÃO é persistido (sempre recriado do zero)
 * - tokens: salvos normalmente
 * - camera: salva posição/zoom
 * - fog: salva se habilitado/desabilitado
 */
export interface TabletopPersistedState {
    maps: MapData[];
    tokens: any[];
    camera: { x: number; y: number; scale: number };
    fog: any;
}

export type SaveTrigger = 'autosave' | 'immediate' | 'beforeunload';

/**
 * Serviço central de persistência do Tabletop VTT.
 *
 * DOIS MODOS DE SALVAR:
 *
 * 1) AUTOSAVE (via effect) — debounce 150ms
 *    Dispara quando signals mudam (posição, escala, etc.)
 *    Ideal para arrasto contínuo (dragmove, wheel)
 *
 * 2) SAVE IMEDIATO — sem debounce
 *    Dispara em eventos críticos:
 *      ✔ dragend do mapa/token
 *      ✔ transformend do mapa
 *      ✔ criar/excluir mapa ou token
 *      ✔ beforeunload (F5)
 *
 * Garantias:
 *   - NUNCA salva objetos não-serializáveis (imageObj removido)
 *   - NUNCA perde alterações recentes no F5
 *   - salvamento é síncrono e rápido (localStorage é IO local)
 */
@Injectable({ providedIn: 'root' })
export class PersistenceService {
    private readonly STORAGE_KEY = 'mythmaker_vtt_state';

    private mapService = inject(MapService);
    private tokenService = inject(TokenService);
    private cameraService = inject(CameraService);
    private fogService = inject(FogService);
    private gridService = inject(GridService);

    private debounceTimer: ReturnType<typeof setTimeout> | null = null;
    private isSaving = false;

    constructor() {
        console.log('[SAVE] PersistenceService CONSTRUTOR executado');

        // ── Autosave: salva com debounce pequeno (150ms) ──
        effect(() => {
            this.mapService.mapList();
            this.tokenService.tokenList();
            this.cameraService.scale();
            this.cameraService.x();
            this.cameraService.y();
            this.gridService.enabled();
            this.gridService.cellSize();
            this.fogService.enabled();

            console.log('[SAVE] EFFECT disparado. maps:', this.mapService.mapList().length);
            this.scheduleAutoSave();
        });

        // ── Proteção contra F5 / fechar aba ──
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', () => {
                console.log('[UNLOAD] beforeunload DISPARADO');
                this.saveNow('beforeunload');
            });
        }
    }

    /** Autosave com debounce de 150ms — para arrasto contínuo */
    private scheduleAutoSave(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this.saveNow('autosave');
        }, 150);
    }

    /**
     * Salva IMEDIATAMENTE, sem debounce.
     * Usar em eventos críticos: dragend, transformend, criar/excluir.
     */
    saveNow(trigger: SaveTrigger = 'immediate'): void {
        console.log(`[SAVE] saveNow() chamado. trigger: ${trigger}, isSaving: ${this.isSaving}`);

        if (this.isSaving) return;
        this.isSaving = true;

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }

        try {
            const mapsSnapshot = this.mapService.getSnapshot();
            console.log('[SAVE] mapsSnapshot:', JSON.stringify(mapsSnapshot.map(m => ({ id: m.id, name: m.name, x: m.x, y: m.y, scaleX: m.scaleX, hasImageUrl: !!m.imageUrl, imageUrlLen: m.imageUrl?.length || 0 }))));
            console.log('[SAVE] maps count:', mapsSnapshot.length);

            const state: TabletopPersistedState = {
                maps: mapsSnapshot,
                tokens: this.tokenService.getSnapshot(),
                camera: {
                    x: this.cameraService.getSnapshot().x,
                    y: this.cameraService.getSnapshot().y,
                    scale: this.cameraService.getSnapshot().scale,
                },
                fog: this.fogService.getSnapshot(),
            };

            console.log('[SAVE] localStorage ANTES:', localStorage.getItem(this.STORAGE_KEY)?.substring(0, 200));

            const json = JSON.stringify(state);
            console.log('[SAVE] JSON length:', json.length, 'bytes');
            localStorage.setItem(this.STORAGE_KEY, json);

            console.log('[SAVE] localStorage DEPOIS (primeiros 200 chars):', localStorage.getItem(this.STORAGE_KEY)?.substring(0, 200));

            if (trigger !== 'beforeunload') {
                console.debug('[Persistence] Salvo (trigger:', trigger, ')');
            }
        } catch (err) {
            console.warn('[Persistence] Erro ao salvar estado:', err);
        } finally {
            this.isSaving = false;
        }
    }

    /** Restaura o estado completo do localStorage */
    load(): void {
        console.log('[LOAD] load() chamado');
        const raw = localStorage.getItem(this.STORAGE_KEY);
        console.log('[LOAD] raw do localStorage:', raw ? raw.substring(0, 300) + '... (len:' + raw.length + ')' : 'null/vazio');

        if (!raw) {
            console.log('[LOAD] localStorage vazio — nada a restaurar');
            return;
        }

        try {
            console.log('[LOAD] Tentando JSON.parse...');
            const state: TabletopPersistedState = JSON.parse(raw);
            console.log('[LOAD] parsed com sucesso:', {
                maps: state.maps?.length ?? 0,
                tokens: state.tokens?.length ?? 0,
                hasCamera: !!state.camera,
                hasFog: !!state.fog
            });

            if (state.maps && Array.isArray(state.maps)) {
                console.log('[LOAD] maps do JSON:', state.maps.map(m => ({ id: m.id, name: m.name, x: m.x, y: m.y, hasImageUrl: !!m.imageUrl })));
                this.mapService.loadFromSnapshot(state.maps);
                console.log('[LOAD] Após mapService.loadFromSnapshot — mapList length:', this.mapService.mapList().length);
            } else {
                console.log('[LOAD] state.maps é inválido:', state.maps);
            }

            if (state.tokens && Array.isArray(state.tokens)) {
                this.tokenService.loadFromSnapshot(state.tokens);
            }

            if (state.camera) {
                this.cameraService.loadFromSnapshot({
                    x: state.camera.x ?? 0,
                    y: state.camera.y ?? 0,
                    scale: state.camera.scale ?? 1,
                });
            }

            if (state.fog) {
                this.fogService.loadFromSnapshot(state.fog);
            }
        } catch (err) {
            console.error('[LOAD] JSON inválido ou erro no parse:', err);
            // Remove dados corrompidos
            localStorage.removeItem(this.STORAGE_KEY);
        }
    }

    /** Remove todos os dados persistidos */
    clear(): void {
        localStorage.removeItem(this.STORAGE_KEY);
    }
}
