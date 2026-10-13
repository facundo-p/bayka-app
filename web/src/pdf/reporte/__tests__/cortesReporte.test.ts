import { arbolParaFicha, coloresEnOrden } from '../../../test/fabricas';
import type { ArbolParaFicha, CodigoNombre } from '../../../queries/fichasQueries';
import { TEXTO_ARBOL } from '../../arbol/textosArbol';
import { ESTADO_FOTO, type FotoPdf } from '../../estadoFoto';
import type { Medidor } from '../../plantilla/cortarTexto';
import { ANCHO_TEXTO_REPORTE } from '../../plantilla/tokens';
import { cortarReparto, type MedidasReporte } from '../cortesReporte';
import { datosArbolReporte, datosTarjeta, type ModeloArbolReporte } from '../datosReporte';

// Cada letra mide distinto: un renglón medido con la de otro no da el corte justo.
const porCaracter =
  (puntos: number): Medidor =>
  (texto) =>
    [...texto].length * puntos;

const MEDIDAS: MedidasReporte = {
  fila: porCaracter(4),
  dato: porCaracter(3),
  especieTarjeta: porCaracter(5),
  codigo: porCaracter(6),
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

/** El nombre comparte el renglón con el código, en mono, y el separador. */
function esNombreJusto(
  cortado: CodigoNombre,
  original: CodigoNombre,
  medir: Medidor,
  ancho: number,
) {
  expect(cortado.codigo).toBe(original.codigo);
  const libre = ancho - MEDIDAS.codigo(cortado.codigo) - medir(TEXTO_ARBOL.separadorCodigo);
  esCorteJusto(cortado.nombre, original.nombre, medir, libre);
}

test('lo que entra no cambia: el reparto sale igual', () => {
  const reparto = repartoDe(CORTO, { ...CORTO, parcela: null });
  expect(cortarReparto(reparto, MEDIDAS)).toEqual(reparto);
});

const RENGLONES = [
  {
    bloque: 'tarjetas',
    anchos: ANCHO_TEXTO_REPORTE.tarjeta,
    nombre: MEDIDAS.dato,
    especie: MEDIDAS.especieTarjeta,
  },
  {
    bloque: 'listado',
    anchos: ANCHO_TEXTO_REPORTE.listado,
    nombre: MEDIDAS.fila,
    especie: MEDIDAS.fila,
  },
] as const;

test.each(RENGLONES)(
  'en $bloque, especie, parcela y grupo se cortan con «…» justo al ancho de su renglón',
  ({ bloque, anchos, nombre, especie }) => {
    const original = repartoDe(LARGO)[bloque][0];
    const [cortado] = cortarReparto(repartoDe(LARGO), MEDIDAS)[bloque];
    esCorteJusto(cortado.especie.titulo, original.especie.titulo, especie, anchos.especie);
    esNombreJusto(cortado.parcela!, original.parcela!, nombre, anchos.parcela);
    esNombreJusto(cortado.grupo, original.grupo, nombre, anchos.grupo);
  },
);

/** Igual al original salvo los textos que se cortan. */
const salvoLoCortado = (modelo: ModeloArbolReporte) => ({
  ...modelo,
  especie: { ...modelo.especie, titulo: expect.any(String) },
  grupo: { ...modelo.grupo, nombre: expect.any(String) },
});

test('sin parcela sigue sin parcela, y la foto y los demás datos no cambian', () => {
  const original = repartoDe({ ...LARGO, parcela: null });
  const { tarjetas, listado } = cortarReparto(original, MEDIDAS);
  expect(tarjetas).toEqual(original.tarjetas.map(salvoLoCortado));
  expect(listado).toEqual(original.listado.map(salvoLoCortado));
});
