import { CAJA_TARJETA, MEDIDA_REPORTE } from '../../plantilla/tokens';
import { altoFila, altoTarjeta, type TextosDelAlto } from '../altosReporte';
import type { CodigoEnRenglones } from '../renglonesReporte';

const renglones = (cantidad: number) => Array.from({ length: cantidad }, () => 'Loma');
const entidad = (cantidad: number): CodigoEnRenglones => ({
  codigo: 'P1',
  nombre: renglones(cantidad),
});

type Cantidades = { idArbol?: number; especie?: number; parcela?: number | null; grupo?: number };

/** Lo que miden los altos: cuántos renglones lleva cada texto. */
function arbol({
  idArbol = 1,
  especie = 1,
  parcela = 1,
  grupo = 1,
}: Cantidades = {}): TextosDelAlto {
  return {
    idArbol: renglones(idArbol),
    especie: { color: '#000', sinIdentificar: false, titulo: renglones(especie) },
    parcela: parcela === null ? null : entidad(parcela),
    grupo: entidad(grupo),
  };
}

describe('altoFila', () => {
  test('con todo en un renglón, mide lo de siempre', () => {
    expect(altoFila(arbol())).toBe(MEDIDA_REPORTE.altoFilaListado);
    expect(altoFila(arbol({ parcela: null }))).toBe(MEDIDA_REPORTE.altoFilaListado);
  });

  // Cada renglón de más suma 9,75 pt: 7,8 pt de letra con interlineado de 1,25.
  test.each([
    [{ especie: 3 }, 33.5],
    [{ especie: 2, parcela: 3, grupo: 2 }, 33.5],
    [{ idArbol: 2 }, 23.75],
  ])('con %o, mide lo que su celda con más renglones', (cantidades, alto) => {
    expect(altoFila(arbol(cantidades))).toBeCloseTo(alto);
  });
});

describe('altoTarjeta', () => {
  test('con todo en un renglón, mide lo de siempre: el alto de la foto', () => {
    expect(altoTarjeta(arbol())).toBe(CAJA_TARJETA.alto);
    expect(altoTarjeta(arbol({ parcela: null }))).toBe(CAJA_TARJETA.alto);
  });

  // 119 pt de datos y 17,5 de relleno y borde: hay 8,6 pt de aire antes de crecer.
  test.each([
    [{ grupo: 2 }, 146.875],
    [{ especie: 2, parcela: 2, grupo: 2 }, 172.25],
    [{ idArbol: 2, especie: 3, parcela: 3, grupo: 1 }, 197.25],
  ])('con %o, mide lo que sus datos', (cantidades, alto) => {
    expect(altoTarjeta(arbol(cantidades))).toBeCloseTo(alto);
  });
});
