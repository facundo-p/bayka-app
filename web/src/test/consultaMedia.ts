/** Los px de `feature` en una media query: `(max-width: 900px)` con `max-width` da `[900]`. */
export function valoresPx(consulta: string, feature: string): number[] {
  const patron = new RegExp(`\\(\\s*${feature}:\\s*(\\d+)px\\s*\\)`, 'g');
  return [...consulta.matchAll(patron)].map(([, valor]) => Number(valor));
}
