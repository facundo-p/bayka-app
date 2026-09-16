/**
 * Cancelación de la corrida de sync en curso (#451).
 *
 * El watchdog no cancela solo: le ofrece el botón al usuario. Esto es lo que ese
 * botón mueve.
 *
 * Es estado de módulo, como `syncActivityStore`, porque una corrida es una sola:
 * la abre `useSync`, que es quien tiene el botón, y así también quedan adentro las
 * fases de fotos, que corren fuera de los orquestadores. Un pull suelto
 * (pull-to-refresh) no abre corrida y por lo tanto no es cancelable — no tiene
 * dónde ofrecerlo.
 *
 * Al ser de módulo, el corte alcanza a TODO lo que pase por `fetchAllRows`,
 * incluida una descarga de catálogo que estuviera corriendo en paralelo. Eso es
 * aceptable —se aborta, y se reintenta— con una condición que no se negocia:
 * ningún rollback destructivo puede dispararse por una cancelación. Por eso
 * `relanzarSiEsCancelacion` va ANTES del revert en `downloadService`.
 */

/** No es un error de sync: el usuario pidió salir. Los callers lo distinguen para no reportar una falla. */
export class SyncCanceladoError extends Error {
  constructor() {
    super('SYNC_CANCELADO');
    this.name = 'SyncCanceladoError';
  }
}

export const esCancelacion = (error: unknown): boolean =>
  (error as { name?: string } | null)?.name === 'SyncCanceladoError';

/**
 * Va primero en todo `catch` de "seguir ante fallas". El sync está lleno de ellos
 * —una parcela que falla no frena a las demás, un pull que falla no frena al push—
 * y sin esto se tragan la cancelación: el usuario aprieta el botón y la sync sigue.
 */
export function relanzarSiEsCancelacion(error: unknown): void {
  if (esCancelacion(error)) throw error;
}

let control: AbortController | null = null;

export function iniciarCorrida(): void {
  control = new AbortController();
}

/** Sin esto, la cancelación de una corrida cortaría la siguiente apenas arranque. */
export function terminarCorrida(): void {
  control = null;
}

export function cancelarCorrida(): void {
  control?.abort();
}

/**
 * Para `.abortSignal()` de postgrest: mata la página en vuelo en vez de esperar al
 * próximo borde. Storage no tiene equivalente —`FileOptions` de storage-js 2.101 no
 * acepta `signal`— así que una foto en curso se corta recién al terminar o al
 * vencer su timeout.
 */
export function signalDeCancelacion(): AbortSignal | undefined {
  return control?.signal;
}

export function estaCancelado(): boolean {
  return control?.signal.aborted ?? false;
}

/**
 * Corta si el usuario canceló. Va en los bordes seguros —entre páginas, entre
 * transacciones, entre fotos— y nunca en medio de una escritura: ahí la base
 * quedaría a medias.
 */
export function abortarSiCancelado(): void {
  if (estaCancelado()) throw new SyncCanceladoError();
}
