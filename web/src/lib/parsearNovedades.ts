/**
 * Parser de NOVEDADES.md (el changelog público). Sin dependencias: solo entiende
 * el subconjunto de markdown que ese archivo usa como contrato — `## Título` por
 * versión, bullets `- **Titular.** Detalle` y, en la sección en pruebas (#375),
 * sub-bullets indentados con los pasos para probar cada ítem. Los comentarios
 * `<!-- … -->` de una línea no se muestran; el de `sincronizado-hasta:` es la
 * marca que deja el skill `/novedades`.
 *
 * Tolerante por diseño: nunca lanza. Una línea rara se ignora y un bold
 * malformado cae entero al detalle; la pantalla de novedades no puede romperse
 * porque alguien escribió mal un asterisco.
 */

export type ItemNovedad = { titular?: string; detalle: string; pasos?: string[] };

/** Una versión publicada o la sección en pruebas. `titulo` es opaco: no se parsea versión ni fecha. */
export type EntradaNovedades = { titulo: string; items: ItemNovedad[]; sincronizadoHasta?: string };

/** Prefijo del título de la sección que acumula lo que está en staging. Contrato con `/novedades`. */
export const TITULO_EN_PRUEBAS = 'En pruebas';

const ENCABEZADO = /^##\s+(.*\S)\s*$/;
const BULLET = /^-\s+(.*\S)\s*$/;
const PASO = /^\s{2,}-\s+(.*\S)\s*$/;
const TITULAR = /^\*\*(.+?)\*\*\s*(.*)$/;
const COMENTARIO = /<!--(.*?)-->/g;
const MARCA = /^\s*sincronizado-hasta:\s*(.*\S)\s*$/;

type Estado = {
  entradas: EntradaNovedades[];
  actual: EntradaNovedades | null;
  item: ItemNovedad | null;
  enPaso: boolean;
};

export function esEntradaEnPruebas(entrada: EntradaNovedades): boolean {
  return entrada.titulo.startsWith(TITULO_EN_PRUEBAS);
}

function parsearBullet(contenido: string): ItemNovedad {
  const conTitular = TITULAR.exec(contenido);
  if (!conTitular) return { detalle: contenido };
  return { titular: conTitular[1], detalle: conTitular[2].trim() };
}

function separarComentarios(linea: string): { visible: string; comentarios: string[] } {
  const comentarios: string[] = [];
  const visible = linea.replace(COMENTARIO, (_, contenido: string) => {
    comentarios.push(contenido);
    return '';
  });
  return { visible: visible.trimEnd(), comentarios };
}

function anotarMarca(entrada: EntradaNovedades | null, comentarios: string[]): void {
  if (!entrada) return;
  for (const comentario of comentarios) {
    const marca = MARCA.exec(comentario);
    if (marca) entrada.sincronizadoHasta = marca[1];
  }
}

function abrirEntrada(estado: Estado, titulo: string): void {
  estado.actual = { titulo, items: [] };
  estado.entradas.push(estado.actual);
  estado.item = null;
  estado.enPaso = false;
}

function agregarPaso(estado: Estado, paso: string): void {
  // Un paso sin ítem arriba no tiene a qué pertenecer.
  if (!estado.item) return;
  estado.item.pasos = [...(estado.item.pasos ?? []), paso];
  estado.enPaso = true;
}

// El archivo va wrapeado a 80 columnas: la línea sigue al paso o al detalle de arriba.
function agregarContinuacion(estado: Estado, texto: string): void {
  const { item } = estado;
  if (!item) return;
  if (estado.enPaso && item.pasos) {
    const ultimo = item.pasos.length - 1;
    item.pasos[ultimo] = `${item.pasos[ultimo]} ${texto}`;
    return;
  }
  item.detalle = item.detalle ? `${item.detalle} ${texto}` : texto;
}

function procesarVisible(estado: Estado, linea: string): void {
  const encabezado = ENCABEZADO.exec(linea);
  if (encabezado) return abrirEntrada(estado, encabezado[1]);
  // Todo lo anterior al primer `## ` es intro del archivo, no novedades.
  if (!estado.actual) return;

  if (linea.trim() === '') {
    estado.item = null;
    estado.enPaso = false;
    return;
  }
  const bullet = BULLET.exec(linea);
  if (bullet) {
    estado.item = parsearBullet(bullet[1]);
    estado.actual.items.push(estado.item);
    estado.enPaso = false;
    return;
  }
  const paso = PASO.exec(linea);
  if (paso) return agregarPaso(estado, paso[1]);
  agregarContinuacion(estado, linea.trim());
}

function procesarLinea(estado: Estado, linea: string): void {
  const { visible, comentarios } = separarComentarios(linea);
  // Una línea que solo tenía comentarios no existe: no corta la continuación.
  const soloComentarios = comentarios.length > 0 && visible.trim() === '';
  if (!soloComentarios) procesarVisible(estado, visible);
  anotarMarca(estado.actual, comentarios);
}

export function parsearNovedades(crudo: string): EntradaNovedades[] {
  const estado: Estado = { entradas: [], actual: null, item: null, enPaso: false };
  for (const linea of crudo.split('\n')) procesarLinea(estado, linea);
  return estado.entradas;
}
