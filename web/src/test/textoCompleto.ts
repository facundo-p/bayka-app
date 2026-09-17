/**
 * Matcher de `getByText` para un texto repartido entre varios elementos (ej. el
 * recuento, con las cifras en `<strong>`): toma el elemento más profundo cuyo
 * texto completo coincide.
 */
export function textoCompleto(texto: string) {
  return (_contenido: string, elemento: Element | null): boolean =>
    elemento?.textContent === texto &&
    Array.from(elemento.children).every((hijo) => hijo.textContent !== texto);
}
