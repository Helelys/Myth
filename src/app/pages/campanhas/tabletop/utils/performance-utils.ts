/**
 * Utilitários de performance para otimizar renderizações.
 * Fornece debounce, throttle e gerenciamento de animation frame.
 */

/**
 * Cria uma função com debounce.
 * A função só será chamada após `delay` ms sem nova invocação.
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Cria uma função com throttle.
 * A função será chamada no máximo uma vez a cada `limit` ms.
 */
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;

  return (...args: Parameters<T>) => {
    if (inThrottle) {
      lastArgs = args;
      return;
    }

    inThrottle = true;
    fn(...args);

    setTimeout(() => {
      inThrottle = false;
      if (lastArgs) {
        fn(...lastArgs);
        lastArgs = null;
      }
    }, limit);
  };
}

/**
 * Gerenciador de requestAnimationFrame.
 * Agrupa múltiplas chamadas de redraw em um único frame.
 */
export class AnimationFrameManager {
  private pendingFrames = new Set<string>();
  private rafId: number | null = null;
  private callback: (id: string) => void;

  constructor(callback: (id: string) => void) {
    this.callback = callback;
  }

  /**
   * Agenda um redraw para o próximo animation frame.
   * Se múltiplos redraws com o mesmo ID forem agendados,
   * apenas um será executado.
   */
  scheduleRedraw(id: string): void {
    this.pendingFrames.add(id);

    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => {
        this.flush();
      });
    }
  }

  /**
   * Executa todos os redraws pendentes.
   */
  private flush(): void {
    this.rafId = null;
    const ids = Array.from(this.pendingFrames);
    this.pendingFrames.clear();

    for (const id of ids) {
      this.callback(id);
    }
  }

  /**
   * Cancela todos os redraws pendentes.
   */
  cancelAll(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.pendingFrames.clear();
  }

  /**
   * Limpa os recursos do gerenciador.
   */
  destroy(): void {
    this.cancelAll();
    this.callback = () => {};
  }
}

/**
 * Object pool para reutilizar objetos e evitar alocação de memória.
 * Útil para objetos temporários em loops de renderização.
 */
export class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;

  constructor(factory: () => T, reset: (obj: T) => void, initialSize = 10) {
    this.factory = factory;
    this.reset = reset;

    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.factory();
  }

  release(obj: T): void {
    this.reset(obj);
    this.pool.push(obj);
  }

  releaseMany(objects: T[]): void {
    for (const obj of objects) {
      this.release(obj);
    }
  }
}
