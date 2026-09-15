/** Punto con coordenadas pero sin precisión: el provider entregó el fix sin `coords.accuracy`. */
export const GPS_ACCURACY_UNKNOWN_LABEL = 's/d';

/** Precisión en metros redondeada ("± 3 m"); "s/d" si no se conoce. */
export function formatGpsAccuracy(meters: number | null): string {
  return meters === null ? GPS_ACCURACY_UNKNOWN_LABEL : `± ${Math.round(meters)} m`;
}
