import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { VttMouseEvent, VttDragEvent, VttWheelEvent } from '../models';

/**
 * Serviço de eventos do Tabletop VTT.
 * Centraliza todos os eventos de mouse, teclado e interação.
 *
 * Preparado para futuro multiplayer:
 * - Eventos podem ser transmitidos via WebSocket
 * - Timestamps incluídos para sincronização
 */
@Injectable({ providedIn: 'root' })
export class VttEventService {
  /** Eventos de mouse */
  private mouseDownSubject = new Subject<VttMouseEvent>();
  private mouseMoveSubject = new Subject<VttMouseEvent>();
  private mouseUpSubject = new Subject<VttMouseEvent>();
  private wheelSubject = new Subject<VttWheelEvent>();

  /** Eventos de drag */
  private dragStartSubject = new Subject<VttDragEvent>();
  private dragMoveSubject = new Subject<VttDragEvent>();
  private dragEndSubject = new Subject<VttDragEvent>();

  /** Eventos de hover */
  private hoverStartSubject = new Subject<string>();
  private hoverEndSubject = new Subject<void>();

  /** Eventos de teclado */
  private keyDownSubject = new Subject<KeyboardEvent>();
  private keyUpSubject = new Subject<KeyboardEvent>();

  /** Observables públicos */
  readonly mouseDown$: Observable<VttMouseEvent> = this.mouseDownSubject.asObservable();
  readonly mouseMove$: Observable<VttMouseEvent> = this.mouseMoveSubject.asObservable();
  readonly mouseUp$: Observable<VttMouseEvent> = this.mouseUpSubject.asObservable();
  readonly wheel$: Observable<VttWheelEvent> = this.wheelSubject.asObservable();

  readonly dragStart$: Observable<VttDragEvent> = this.dragStartSubject.asObservable();
  readonly dragMove$: Observable<VttDragEvent> = this.dragMoveSubject.asObservable();
  readonly dragEnd$: Observable<VttDragEvent> = this.dragEndSubject.asObservable();

  readonly hoverStart$: Observable<string> = this.hoverStartSubject.asObservable();
  readonly hoverEnd$: Observable<void> = this.hoverEndSubject.asObservable();

  readonly keyDown$: Observable<KeyboardEvent> = this.keyDownSubject.asObservable();
  readonly keyUp$: Observable<KeyboardEvent> = this.keyUpSubject.asObservable();

  // --- Métodos de emissão ---

  emitMouseDown(event: VttMouseEvent): void {
    this.mouseDownSubject.next(event);
  }

  emitMouseMove(event: VttMouseEvent): void {
    this.mouseMoveSubject.next(event);
  }

  emitMouseUp(event: VttMouseEvent): void {
    this.mouseUpSubject.next(event);
  }

  emitWheel(event: VttWheelEvent): void {
    this.wheelSubject.next(event);
  }

  emitDragStart(event: VttDragEvent): void {
    this.dragStartSubject.next(event);
  }

  emitDragMove(event: VttDragEvent): void {
    this.dragMoveSubject.next(event);
  }

  emitDragEnd(event: VttDragEvent): void {
    this.dragEndSubject.next(event);
  }

  emitHoverStart(tokenId: string): void {
    this.hoverStartSubject.next(tokenId);
  }

  emitHoverEnd(): void {
    this.hoverEndSubject.next();
  }

  emitKeyDown(event: KeyboardEvent): void {
    this.keyDownSubject.next(event);
  }

  emitKeyUp(event: KeyboardEvent): void {
    this.keyUpSubject.next(event);
  }

  /** Limpa todos os subjects (prevenção de memory leak) */
  completeAll(): void {
    this.mouseDownSubject.complete();
    this.mouseMoveSubject.complete();
    this.mouseUpSubject.complete();
    this.wheelSubject.complete();
    this.dragStartSubject.complete();
    this.dragMoveSubject.complete();
    this.dragEndSubject.complete();
    this.hoverStartSubject.complete();
    this.hoverEndSubject.complete();
    this.keyDownSubject.complete();
    this.keyUpSubject.complete();
  }
}
