import { estimarPeso, PESO_PDF } from '../pesoReporte';
import {
  estimarReporte,
  FILAS_POR_HOJA,
  MODO_REPORTE,
  TOPE_TARJETAS,
  type ModoReporte,
} from '../planReporte';

const peso = (total: number, conFoto: number, modo: ModoReporte = MODO_REPORTE.conFotos) =>
  estimarPeso(estimarReporte({ total, conFoto, modo }));

test('cada tarjeta suma una foto y cada hoja del listado, su texto', () => {
  expect(peso(FILAS_POR_HOJA + 2, 2)).toBe(
    PESO_PDF.base + 2 * PESO_PDF.porFoto + PESO_PDF.porHojaListado,
  );
});

test('una hoja del listado a medio llenar pesa como una entera', () => {
  expect(peso(1, 0)).toBe(PESO_PDF.base + PESO_PDF.porHojaListado);
});

test('las fotos que pasan el tope van al listado y no suman foto', () => {
  const hojasListado = Math.ceil(50 / FILAS_POR_HOJA);
  expect(peso(TOPE_TARJETAS + 50, TOPE_TARJETAS + 50)).toBe(
    PESO_PDF.base + TOPE_TARJETAS * PESO_PDF.porFoto + hojasListado * PESO_PDF.porHojaListado,
  );
});

test('sin fotos, el peso es solo el del listado', () => {
  const hojasListado = Math.ceil(7000 / FILAS_POR_HOJA);
  expect(peso(7000, 148, MODO_REPORTE.sinFotos)).toBe(
    PESO_PDF.base + hojasListado * PESO_PDF.porHojaListado,
  );
});

test('400 tarjetas rondan los 27 MB', () => {
  expect(peso(400, 400) / 1e6).toBeCloseTo(26.8, 0);
});
