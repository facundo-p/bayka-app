/**
 * Funciones que `pagina.evaluate` serializa y corre en la página. Por eso no
 * pueden usar nada de este módulo ni de Node: solo lo que tiene la página.
 */

export function contarNodos() {
  return document.querySelectorAll('*').length;
}

/** `medir` es global de la página: la inyecta `abrirPagina` con medir.navegador.js. */
export function medirEnPagina([selectorRaiz, selectorCards]) {
  return window.medir(selectorRaiz, selectorCards);
}

export function desplegarDetails() {
  for (const details of document.querySelectorAll('details')) details.open = true;
}
