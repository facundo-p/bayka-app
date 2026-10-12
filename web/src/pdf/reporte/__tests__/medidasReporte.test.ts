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
