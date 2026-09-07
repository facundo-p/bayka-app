/**
 * Parser de NOVEDADES.md (el changelog público). Sin dependencias: solo entiende
 * el subconjunto de markdown que ese archivo usa como contrato — `## Título` por
 * versión y bullets `- **Titular.** Detalle`.
 *
 * Tolerante por diseño: nunca lanza. Una línea rara se ignora y un bold
 * malformado cae entero al detalle; la pantalla de novedades no puede romperse
 * porque alguien escribió mal un asterisco.
 */

export type ItemNovedad = { titular?: string; detalle: string };

/** Una versión publicada. `titulo` es opaco: no se parsea versión ni fecha. */
export type EntradaNovedades = { titulo: string; items: ItemNovedad[] };

const ENCABEZADO = /^##\s+(.*\S)\s*$/;
const BULLET = /^-\s+(.*\S)\s*$/;
const TITULAR = /^\*\*(.+?)\*\*\s*(.*)$/;

function parsearBullet(contenido: string): ItemNovedad {
  const conTitular = TITULAR.exec(contenido);
  if (!conTitular) return { detalle: contenido };
  return { titular: conTitular[1], detalle: conTitular[2].trim() };
}

export function parsearNovedades(crudo: string): EntradaNovedades[] {
  const entradas: EntradaNovedades[] = [];
  let actual: EntradaNovedades | null = null;
  let ultimoItem: ItemNovedad | null = null;

  for (const linea of crudo.split('\n')) {
    const encabezado = ENCABEZADO.exec(linea);
    if (encabezado) {
      actual = { titulo: encabezado[1], items: [] };
      entradas.push(actual);
      ultimoItem = null;
      continue;
    }
    // Todo lo anterior al primer `## ` es intro del archivo, no novedades.
    if (!actual) continue;

    if (linea.trim() === '') {
      ultimoItem = null;
      continue;
    }

    const bullet = BULLET.exec(linea);
    if (bullet) {
      ultimoItem = parsearBullet(bullet[1]);
      actual.items.push(ultimoItem);
      continue;
    }

    // Continuación del bullet anterior: el archivo va wrapeado a 80 columnas.
    if (ultimoItem) {
      const continuacion = linea.trim();
      ultimoItem.detalle = ultimoItem.detalle ? `${ultimoItem.detalle} ${continuacion}` : continuacion;
    }
  }

  return entradas;
}
