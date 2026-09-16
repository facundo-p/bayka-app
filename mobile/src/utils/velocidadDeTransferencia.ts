/**
 * Formateo de la velocidad de transferencia de fotos (#450).
 *
 * Es un **promedio**, no una velocidad instantánea: `supabase-js` no expone
 * progreso dentro de un archivo —el upload es un POST único con un `Uint8Array`, y
 * `downloadFileAsync` tampoco emite avance parcial— así que el número se refresca
 * al completar cada foto. Con fotos de 2-4 MB eso es cada varios segundos, que
 * alcanza para distinguir "lento" de "trabado", que es el objetivo.
 */

const KB = 1024;
const MB = 1024 * KB;

/** Debajo de esto el número redondeado sería 0 KB/s, que parece "no avanza". */
const MINIMO_LEGIBLE = KB;

export interface TransferenciaMedida {
  /** Bytes completados en esta fase. */
  bytes?: number;
  /** Momento en que arrancó la fase, en ms. */
  desde?: number;
}

/**
 * Velocidad promedio lista para mostrar, o `null` si todavía no hay con qué
 * calcularla: sin ninguna foto completa, sin marca de arranque, o con un tiempo
 * transcurrido de cero. Nunca devuelve `NaN` ni `Infinity`.
 */
export function formatearVelocidad(medida: TransferenciaMedida, ahora: number): string | null {
  const { bytes, desde } = medida;
  if (!bytes || bytes <= 0 || !desde) return null;

  // Un tiempo de cero da Infinity y uno negativo —reloj corrido hacia atrás— da un
  // número negativo: los dos caen en el mismo guard, no hace falta otro antes.
  const porSegundo = bytes / ((ahora - desde) / 1000);
  if (!Number.isFinite(porSegundo) || porSegundo <= 0) return null;

  if (porSegundo < MINIMO_LEGIBLE) return '~<1 KB/s';
  if (porSegundo >= MB) return `~${(porSegundo / MB).toFixed(1)} MB/s`;
  return `~${Math.round(porSegundo / KB)} KB/s`;
}
