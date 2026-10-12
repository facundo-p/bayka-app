// La paginación del reporte es fija: si una medida se pasa, el contenido se
// encima o desaparece sin que cambie la cantidad de hojas. Estas cuentas lo atajan.
import {
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
  const especie = M.altoEspecie + M.aireEspecie + M.aireEspecie;
  const datos = M.altoIdArbol + especie + M.altoDato * DATOS_POR_TARJETA;
  expect(datos).toBeLessThanOrEqual(LADO_FOTO_TARJETA);
});

test('el encabezado y las filas del listado entran en el cuerpo', () => {
  const alto = M.altoEncabezadoListado + M.altoFilaListado * FILAS_POR_HOJA;
  expect(alto).toBeLessThan(CUERPO_REPORTE.alto);
});

// react-pdf no dibuja un renglón que no entra en su caja.
test.each([
  ['ID árbol', TAMANO_TEXTO.idTarjeta, M.altoIdArbol],
  // Lo que deja el filete de abajo.
  ['especie', TAMANO_TEXTO.especie, M.altoEspecie - M.borde],
  ['dato', TAMANO_TEXTO.dato, M.altoDato],
  ['fila del listado', TAMANO_TEXTO.filaListado, M.altoFilaListado],
  ['encabezado del listado', TAMANO_TEXTO.etiqueta, M.altoEncabezadoListado],
])('el renglón de %s entra en su alto', (_, tamano, alto) => {
  expect(tamano * M.interlineado).toBeLessThanOrEqual(alto);
});

/** IBM Plex Mono: todos sus glifos avanzan 600/1000 de em. */
const AVANCE_MONO = 0.6;

/** Parcela de 6, grupo de 4, especie de 5, posición de 4 cifras y plantación de 7. */
const ID_LARGO = 'LPN123L23BANCHC1234-SS2026B';

const anchoMono = (texto: string, tamano: number) => texto.length * AVANCE_MONO * tamano;

// Las columnas reparten a peso lo que dejan los rellenos de las celdas.
test('un ID de 27 caracteres entra entero en su columna del listado', () => {
  const pesos = Object.values(M.pesoColumna);
  const libre = CUERPO_REPORTE.ancho - 2 * M.rellenoCelda * pesos.length;
  const pesoTotal = pesos.reduce((suma, peso) => suma + peso, 0);
  const ancho = (libre * M.pesoColumna.idArbol) / pesoTotal;
  expect(anchoMono(ID_LARGO, TAMANO_TEXTO.filaListado)).toBeLessThan(ancho);
});

test('y en la tarjeta, al lado de la foto', () => {
  const marco = 2 * (M.rellenoTarjeta + M.borde);
  const ancho = CAJA_TARJETA.ancho - marco - LADO_FOTO_TARJETA - M.aireFoto;
  expect(anchoMono(ID_LARGO, TAMANO_TEXTO.idTarjeta)).toBeLessThan(ancho);
});
