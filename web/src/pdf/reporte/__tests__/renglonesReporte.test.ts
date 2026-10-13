import { arbolParaFicha, coloresEnOrden } from '../../../test/fabricas';
import type { ArbolParaFicha, CodigoNombre } from '../../../queries/fichasQueries';
import { TEXTO_ARBOL } from '../../arbol/textosArbol';
import { ESTADO_FOTO, type FotoPdf } from '../../estadoFoto';
import type { Medidor } from '../../plantilla/medirTexto';
import { ANCHO_TEXTO_REPORTE } from '../../plantilla/tokens';
import { datosArbolReporte, datosTarjeta } from '../datosReporte';
import {
  repartoEnRenglones,
  type CodigoEnRenglones,
  type MedidoresReporte,
} from '../renglonesReporte';

const modo = vi.hoisted(() => ({ cortar: false }));
vi.mock('../../plantilla/textoLargo', () => ({
  get CORTAR_TEXTO_LARGO() {
    return modo.cortar;
  },
}));

// Cada letra mide distinto: un texto medido con la de otro no da el renglón justo.
const porCaracter =
  (puntos: number): Medidor =>
  (texto) =>
    [...texto].length * puntos;

const MEDIDORES: MedidoresReporte = {
  fila: porCaracter(4),
  dato: porCaracter(3),
  especieTarjeta: porCaracter(5),
  codigo: porCaracter(6),
  idFila: porCaracter(7),
  idTarjeta: porCaracter(5.5),
};

const COLOR_DE = coloresEnOrden('ANC');
const LISTA: FotoPdf = { estado: ESTADO_FOTO.lista, src: 'data:image/png;base64,' };

const CORTO = arbolParaFicha({
  especie: {
    codigo: 'ANC',
    nombre: 'Anchico',
    nombreCientifico: null,
    tipo: 'flora',
    subtipo: 'arbol',
  },
  parcela: { codigo: 'P1', nombre: 'Norte' },
  grupo: { codigo: 'G1', nombre: 'Línea 1' },
  fotoUrl: 'p/arbol.jpg',
});

const LARGO = arbolParaFicha({
  ...CORTO,
  idArbol: 'LPN123L23BANCHC1234-SS2026B-LPN123L23BANCHC1234-SS2026B',
  especie: {
    ...CORTO.especie!,
    nombre: 'Anchico de la ladera alta del arroyo grande del monte boreal',
  },
  parcela: { codigo: 'P1', nombre: 'Un nombre de sesenta caracteres para la parcela de la lomita' },
  grupo: { codigo: 'G1', nombre: 'Un nombre de sesenta caracteres para el grupo de la lomadita' },
});

const repartoDe = (...arboles: ArbolParaFicha[]) => ({
  tarjetas: arboles.map((arbol) => datosTarjeta(arbol, LISTA, COLOR_DE)),
  listado: arboles.map((arbol) => datosArbolReporte(arbol, COLOR_DE)),
});

/** Cada texto con su letra y su ancho, en las tarjetas y en el listado. */
const BLOQUES = [
  {
    bloque: 'tarjetas',
    anchos: ANCHO_TEXTO_REPORTE.tarjeta,
    idArbol: MEDIDORES.idTarjeta,
    especie: MEDIDORES.especieTarjeta,
    nombre: MEDIDORES.dato,
  },
  {
    bloque: 'listado',
    anchos: ANCHO_TEXTO_REPORTE.listado,
    idArbol: MEDIDORES.idFila,
    especie: MEDIDORES.fila,
    nombre: MEDIDORES.fila,
  },
] as const;

/** Lo que deja el código, en mono, y el separador en el primer renglón de parcela y grupo. */
const anchoTrasCodigo = (codigo: string, medir: Medidor, ancho: number) =>
  ancho - MEDIDORES.codigo(codigo) - medir(TEXTO_ARBOL.separadorCodigo);

/** Un texto entero, en un renglón, para comparar con lo que no cambia. */
const enUno = (entidad: CodigoNombre | null) =>
  entidad && { codigo: entidad.codigo, nombre: [entidad.nombre] };

describe('con el texto entero', () => {
  beforeEach(() => {
    modo.cortar = false;
  });

  /** Cada renglón entra en su ancho, y con la palabra que sigue ya no entraría. */
  function sonRenglonesJustos(renglones: readonly string[], medir: Medidor, anchos: number[]) {
    renglones.forEach((renglon, indice) => {
      const ancho = anchos[Math.min(indice, anchos.length - 1)];
      expect(medir(renglon)).toBeLessThanOrEqual(ancho);
      const siguiente = renglones[indice + 1]?.split(' ')[0];
      if (siguiente && renglon) expect(medir(`${renglon} ${siguiente}`)).toBeGreaterThan(ancho);
    });
  }

  function esNombreEntero(
    partido: CodigoEnRenglones,
    original: CodigoNombre,
    medir: Medidor,
    ancho: number,
  ) {
    expect(partido.codigo).toBe(original.codigo);
    expect(partido.nombre.join(' ').trim()).toBe(original.nombre);
    const primero = anchoTrasCodigo(original.codigo, medir, ancho);
    sonRenglonesJustos(partido.nombre, medir, [primero, ancho]);
  }

  test.each(BLOQUES)(
    'en $bloque, especie, parcela y grupo van enteros, partidos por palabra a su ancho',
    ({ bloque, anchos, especie, nombre }) => {
      const original = repartoDe(LARGO)[bloque][0];
      const [partido] = repartoEnRenglones(repartoDe(LARGO), MEDIDORES)[bloque];
      expect(partido.especie.titulo.length).toBeGreaterThan(1);
      expect(partido.especie.titulo.join(' ')).toBe(original.especie.titulo);
      sonRenglonesJustos(partido.especie.titulo, especie, [anchos.especie]);
      esNombreEntero(partido.parcela!, original.parcela!, nombre, anchos.parcela);
      esNombreEntero(partido.grupo, original.grupo, nombre, anchos.grupo);
    },
  );

  test.each(BLOQUES)(
    'en $bloque, un ID sin espacios que no entra se parte por carácter',
    ({ bloque, anchos, idArbol }) => {
      const [partido] = repartoEnRenglones(repartoDe(LARGO), MEDIDORES)[bloque];
      expect(partido.idArbol.length).toBeGreaterThan(1);
      expect(partido.idArbol.join('')).toBe(LARGO.idArbol);
      const caben = Math.floor(anchos.idArbol / idArbol('X'));
      expect(partido.idArbol.slice(0, -1).every((renglon) => renglon.length === caben)).toBe(true);
    },
  );

  test('si el código no deja lugar, el nombre arranca en el segundo renglón', () => {
    const caracteres = Math.ceil(ANCHO_TEXTO_REPORTE.tarjeta.parcela / MEDIDORES.codigo('X'));
    const codigo = 'X'.repeat(caracteres);
    const { tarjetas, listado } = repartoEnRenglones(
      repartoDe({ ...LARGO, parcela: { codigo, nombre: 'Norte' } }),
      MEDIDORES,
    );
    const conNombreAbajo = { codigo, nombre: ['', 'Norte'] };
    expect([tarjetas[0].parcela, listado[0].parcela]).toEqual([conNombreAbajo, conNombreAbajo]);
  });
});

describe('con el texto cortado', () => {
  beforeEach(() => {
    modo.cortar = true;
  });

  const ELIPSIS = '…';

  /** Termina en «…», sale del original y no le entraba ni un carácter más. */
  function esCorteJusto(cortado: string, original: string, medir: Medidor, libre: number) {
    const conservado = cortado.slice(0, -ELIPSIS.length);
    // Los espacios no cuentan: el «…» va pegado a la palabra.
    const espacios = original.slice(conservado.length).search(/\S/);
    const conUnoMas = original.slice(0, conservado.length + espacios + 1) + ELIPSIS;
    expect(cortado.endsWith(ELIPSIS)).toBe(true);
    expect(original.startsWith(conservado)).toBe(true);
    expect(medir(cortado)).toBeLessThanOrEqual(libre);
    expect(medir(conUnoMas)).toBeGreaterThan(libre);
  }

  /** El nombre comparte el renglón con el código y el separador. */
  function esNombreJusto(
    cortado: CodigoEnRenglones,
    original: CodigoNombre,
    medir: Medidor,
    ancho: number,
  ) {
    expect(cortado.codigo).toBe(original.codigo);
    expect(cortado.nombre).toHaveLength(1);
    const libre = anchoTrasCodigo(original.codigo, medir, ancho);
    esCorteJusto(cortado.nombre[0], original.nombre, medir, libre);
  }

  test.each(BLOQUES)(
    'en $bloque, ID, especie, parcela y grupo se cortan con «…» justo al ancho de su renglón',
    ({ bloque, anchos, idArbol, especie, nombre }) => {
      const original = repartoDe(LARGO)[bloque][0];
      const [cortado] = repartoEnRenglones(repartoDe(LARGO), MEDIDORES)[bloque];
      expect(cortado.idArbol).toHaveLength(1);
      esCorteJusto(cortado.idArbol[0], original.idArbol, idArbol, anchos.idArbol);
      expect(cortado.especie.titulo).toHaveLength(1);
      esCorteJusto(cortado.especie.titulo[0], original.especie.titulo, especie, anchos.especie);
      esNombreJusto(cortado.parcela!, original.parcela!, nombre, anchos.parcela);
      esNombreJusto(cortado.grupo, original.grupo, nombre, anchos.grupo);
    },
  );

  test('si el código no deja lugar, del nombre queda el «…»', () => {
    const caracteres = Math.ceil(ANCHO_TEXTO_REPORTE.tarjeta.parcela / MEDIDORES.codigo('X'));
    const codigo = 'X'.repeat(caracteres);
    const { tarjetas, listado } = repartoEnRenglones(
      repartoDe({ ...LARGO, parcela: { codigo, nombre: 'Norte' } }),
      MEDIDORES,
    );
    const sinLugar = { codigo, nombre: ['…'] };
    expect([tarjetas[0].parcela, listado[0].parcela]).toEqual([sinLugar, sinLugar]);
  });
});

describe.each([false, true])('cortar: %s', (cortar) => {
  beforeEach(() => {
    modo.cortar = cortar;
  });

  test('lo que entra va igual, en un renglón', () => {
    const reparto = repartoDe(CORTO, { ...CORTO, parcela: null });
    const enRenglones = repartoEnRenglones(reparto, MEDIDORES);
    const enUnRenglon = <T extends (typeof reparto.listado)[number]>(modelo: T) => ({
      ...modelo,
      idArbol: [modelo.idArbol],
      especie: { ...modelo.especie, titulo: [modelo.especie.titulo] },
      parcela: enUno(modelo.parcela),
      grupo: enUno(modelo.grupo),
    });
    expect(enRenglones).toEqual({
      tarjetas: reparto.tarjetas.map(enUnRenglon),
      listado: reparto.listado.map(enUnRenglon),
    });
  });

  test('sin parcela sigue sin parcela, y la foto y los demás datos no cambian', () => {
    const original = repartoDe({ ...LARGO, parcela: null });
    const { tarjetas, listado } = repartoEnRenglones(original, MEDIDORES);
    const salvoLosTextos = <T extends (typeof original.listado)[number]>(modelo: T) => ({
      ...modelo,
      idArbol: expect.any(Array),
      especie: { ...modelo.especie, titulo: expect.any(Array) },
      grupo: { ...modelo.grupo, nombre: expect.any(Array) },
    });
    expect(tarjetas).toEqual(original.tarjetas.map(salvoLosTextos));
    expect(listado).toEqual(original.listado.map(salvoLosTextos));
  });
});
