import { estimarPeso, PESO_PDF } from '../pesoReporte';
import { estimarReporte, MODO_REPORTE, type ModoReporte } from '../planReporte';

const peso = (total: number, conFoto: number, modo: ModoReporte = MODO_REPORTE.conFotos) =>
  estimarPeso(estimarReporte({ total, conFoto, modo }));

test('cada hoja suma su texto, y cada tarjeta, su foto', () => {
  const { hojas } = estimarReporte({ total: 40, conFoto: 2, modo: MODO_REPORTE.conFotos });
  expect(peso(40, 2)).toBe(PESO_PDF.base + hojas * PESO_PDF.porHoja + 2 * PESO_PDF.porFoto);
});

test('sin fotos, las fotos no suman aunque el filtro las tenga', () => {
  const { hojas } = estimarReporte({ total: 40, conFoto: 2, modo: MODO_REPORTE.sinFotos });
  expect(peso(40, 2, MODO_REPORTE.sinFotos)).toBe(PESO_PDF.base + hojas * PESO_PDF.porHoja);
});

test('las fotos que pasan el tope van al listado y no suman foto', () => {
  expect(peso(450, 450) - peso(450, 400)).toBe(0);
});

// Contra PDFs reales generados en la demo: 50 filas pesaron 34 KB y 7.000, 1,4 MB.
test.each([
  [50, 34_000],
  [7000, 1_400_000],
])('%i árboles sin fotos se estiman a menos de 5%% del PDF real', (total, real) => {
  expect(Math.abs(peso(total, 0) - real) / real).toBeLessThan(0.05);
});

test('400 tarjetas con fotos reales rondan los 27 MB', () => {
  expect(peso(400, 400) / 1e6).toBeCloseTo(27, 0);
});
