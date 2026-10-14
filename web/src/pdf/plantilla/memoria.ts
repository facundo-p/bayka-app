/**
 * Calcula una sola vez por clave: el reporte repite los mismos nombres, cajas y
 * caracteres en miles de filas.
 */
export function conMemoria<K, T>(calcular: (clave: K) => T): (clave: K) => T {
  const hechos = new Map<K, T>();
  return (clave) => {
    let hecho = hechos.get(clave);
    if (hecho === undefined) {
      hecho = calcular(clave);
      hechos.set(clave, hecho);
    }
    return hecho;
  };
}
