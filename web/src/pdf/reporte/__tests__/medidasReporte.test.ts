// El plan pagina con estas medidas: si una se pasa, el contenido se encima o
// desaparece sin que cambie la cantidad de hojas. Estas cuentas, con todo en un
// renglón, lo atajan.
import {
  altoDeRenglon,
  ANCHO_DATOS_TARJETA,
  anchoDeColumna,
  CAJA_TARJETA,
  CUERPO_REPORTE,
  LADO_FOTO_TARJETA,
  MEDIDA_REPORTE as M,
  TAMANO_TEXTO,
} from '../../plantilla/tokens';
import { FILAS_POR_HOJA } from '../planReporte';

/** Parcela, grupo, posición, registrado y GPS. */
const DATOS_POR_TARJETA = 5;

test('la grilla de tarjetas entra en el cuerpo de la hoja horizontal', () => {
  const { columnasTarjetas, filasTarjetas, separacion } = M;
  expect(CAJA_TARJETA.ancho * columnasTarjetas + separacion * (columnasTarjetas - 1)).toBeCloseTo(
    CUERPO_REPORTE.ancho,
  );
  expect(CAJA_TARJETA.alto * filasTarjetas + separacion * (filasTarjetas - 1)).toBeLessThan(
    CUERPO_REPORTE.alto,
  );
});

// Las cajas miden con borde y relleno adentro (border-box).
test('los datos de la tarjeta entran en el alto de la foto', () => {
  const idArbol = M.altoIdArbol + M.aireFilete + M.aireFilete;
  const datos = M.altoEspecie + idArbol + M.altoDato * DATOS_POR_TARJETA;
  expect(datos).toBeLessThanOrEqual(LADO_FOTO_TARJETA);
});

test('el encabezado y las filas del listado entran en el cuerpo', () => {
  const alto = M.altoEncabezadoListado + M.altoFilaListado * FILAS_POR_HOJA;
  expect(alto).toBeLessThan(CUERPO_REPORTE.alto);
});

// react-pdf no dibuja un renglón que no entra en su caja.
test.each([
  ['especie', TAMANO_TEXTO.especieTarjeta, M.altoEspecie],
  // Lo que deja el filete de abajo.
  ['ID árbol', TAMANO_TEXTO.idTarjeta, M.altoIdArbol - M.borde],
  ['dato', TAMANO_TEXTO.dato, M.altoDato],
  ['fila del listado', TAMANO_TEXTO.filaListado, M.altoFilaListado],
  ['encabezado del listado', TAMANO_TEXTO.etiqueta, M.altoEncabezadoListado],
])('el renglón de %s entra en su alto', (_, tamano, alto) => {
  expect(altoDeRenglon(tamano)).toBeLessThanOrEqual(alto);
});

/** IBM Plex Mono: todos sus glifos avanzan 600/1000 de em. */
const AVANCE_MONO = 0.6;

/** Parcela de 6, grupo de 4, especie de 5, posición de 4 cifras y plantación de 7. */
const ID_LARGO = 'LPN123L23BANCHC1234-SS2026B';

const anchoMono = (texto: string, tamano: number) => texto.length * AVANCE_MONO * tamano;

test('un ID de 27 caracteres entra entero en su columna del listado', () => {
  expect(anchoMono(ID_LARGO, TAMANO_TEXTO.filaListado)).toBeLessThan(anchoDeColumna('idArbol'));
});

test('y en la tarjeta, al lado de la foto', () => {
  expect(anchoMono(ID_LARGO, TAMANO_TEXTO.idTarjeta)).toBeLessThan(ANCHO_DATOS_TARJETA);
});
