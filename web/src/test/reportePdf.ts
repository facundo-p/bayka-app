/*
 * Árboles y render del reporte de árboles en node, para los tests de sus dos
 * modos: texto entero y cortado. El render pasa por `renderizarDocumento`, el
 * mismo camino del worker.
 */
import type { ArbolParaFicha } from '../queries/fichasQueries';
import { ESTADO_FOTO, type FotoPdf } from '../pdf/estadoFoto';
import { registrarFuentes } from '../pdf/plantilla/fuentes';
import { encabezadoDePlantacion } from '../pdf/plantilla/textos';
import { datosArbolReporte, datosTarjeta } from '../pdf/reporte/datosReporte';
import { MODO_REPORTE, repartirArboles, type ModoReporte } from '../pdf/reporte/planReporte';
import { renderizarDocumento } from '../pdf/reporte/renderReporte';
import {
  leerMedidoresReporte,
  repartoEnRenglones,
  type MedidoresReporte,
} from '../pdf/reporte/renglonesReporte';
import { arbolParaFicha, coloresEnOrden } from './fabricas';
import { FUENTES_NODE, LOGO_NODE, PNG_DE_PRUEBA } from './pdfNode';

export const COLOR_DE = coloresEnOrden('ANC', 'ANCHC');

export const ENCABEZADO = encabezadoDePlantacion(
  { lugar: 'San Sebastián', periodo: '2025-2026' },
  LOGO_NODE,
);

export const EMITIDO = '12/10/2026';

export const LISTA: FotoPdf = { estado: ESTADO_FOTO.lista, src: PNG_DE_PRUEBA };

/** Todo lo que puede no entrar en un renglón, largo. */
export const PEOR_CASO = arbolParaFicha({
  subId: 'LPN123L23BANCHC1234',
  idArbol: 'LPN123L23BANCHC1234-SS2026B',
  posicion: 1234,
  especie: {
    codigo: 'ANCHC',
    nombre: 'Anchico colorado de los montes misioneros del Alto Paraná',
    nombreCientifico: null,
    tipo: 'flora',
    subtipo: 'arbol',
  },
  parcela: { codigo: 'LPN123', nombre: 'Loma de los Paraísos Norte, ladera del arroyo Itaembé' },
  grupo: { codigo: 'L23B', nombre: 'Línea 23B del sector bajo del bañado grande' },
  fotoUrl: 'p/arbol.jpg',
  createdAt: '2026-09-14T13:00:00Z',
  gps: { lat: -27.3601234, lng: -55.8974411, precision: 12.5 },
});

/** Todo en un renglón: el alto mínimo de la fila y de la tarjeta. */
export const CORTO = arbolParaFicha({
  ...PEOR_CASO,
  especie: { ...PEOR_CASO.especie!, codigo: 'ANC', nombre: 'Anchico' },
  parcela: { codigo: 'P1', nombre: 'Norte' },
  grupo: { codigo: 'L1', nombre: 'Línea 1' },
});

// Nombres de 60 caracteres, cada uno desde otra palabra: alguno cae donde
// textkit apretaba los espacios hasta pegar las palabras (#876).
const FRASE = 'Loma de los Paraísos Norte, ladera del arroyo Itaembé y el bañado grande del sector';
const PALABRAS = FRASE.split(' ');
export const DE_60 = PALABRAS.map((_, desde) => PALABRAS.slice(desde).join(' ').slice(0, 60))
  .filter((nombre) => nombre.length === 60)
  .map((nombre, indice) =>
    arbolParaFicha({
      ...PEOR_CASO,
      id: `s${indice}`,
      especie: { ...PEOR_CASO.especie!, nombre },
      parcela: { ...PEOR_CASO.parcela!, nombre },
      grupo: { ...PEOR_CASO.grupo, nombre },
    }),
  );

export const SIN_NADA = arbolParaFicha({ especie: null, parcela: null, posicion: null, gps: null });

export const muchos = (cantidad: number, arbol = PEOR_CASO) =>
  Array.from({ length: cantidad }, (_, indice) => ({ ...arbol, id: `t${indice}` }));

/** Los modelos de cada bloque, con las fotos ya bajadas; `fotoDe` decide cuál falla. */
export function repartoDe(
  arboles: readonly ArbolParaFicha[],
  modo: ModoReporte = MODO_REPORTE.conFotos,
  fotoDe: (indice: number) => FotoPdf = () => LISTA,
) {
  const { tarjetas, listado } = repartirArboles(arboles, modo);
  return {
    tarjetas: tarjetas.map((arbol, indice) => datosTarjeta(arbol, fotoDe(indice), COLOR_DE)),
    listado: listado.map((arbol) => datosArbolReporte(arbol, COLOR_DE)),
  };
}

/** El PDF como lo arma el worker. */
export async function renderizar(...parametros: Parameters<typeof repartoDe>) {
  const documento = { encabezado: ENCABEZADO, emitido: EMITIDO, reparto: repartoDe(...parametros) };
  const blob = await renderizarDocumento({ documento, fuentes: FUENTES_NODE });
  return Buffer.from(await blob.arrayBuffer());
}

/** Los textos en sus renglones, medidos con las fuentes reales, como en el worker. */
export async function enRenglones(reparto: ReturnType<typeof repartoDe>) {
  registrarFuentes(FUENTES_NODE);
  return repartoEnRenglones(reparto, await leerMedidoresReporte());
}

/** Miden 0: todo entra, y cada texto va entero en un renglón. */
const SIN_MEDIDA = () => 0;

export const MEDIDORES_EN_CERO: MedidoresReporte = {
  fila: SIN_MEDIDA,
  dato: SIN_MEDIDA,
  especieTarjeta: SIN_MEDIDA,
  codigo: SIN_MEDIDA,
  idFila: SIN_MEDIDA,
  idTarjeta: SIN_MEDIDA,
};

/** Cada texto en un solo renglón, sin medir: lo que no entra lo acomoda textkit. */
export const enUnRenglon = (reparto: ReturnType<typeof repartoDe>) =>
  repartoEnRenglones(reparto, MEDIDORES_EN_CERO);
