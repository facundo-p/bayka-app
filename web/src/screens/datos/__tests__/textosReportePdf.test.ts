import { ETAPA_REPORTE } from '../../../services/pdfReporte';
import {
  porcentajeDeFotos,
  textoAvisoTope,
  textoEstimacion,
  textoEtapa,
  textoFotosFallidas,
  textoProgreso,
  textoResumenConteo,
  textoTarjetas,
} from '../textosReportePdf';

test('el resumen dice cuántos árboles trae el filtro y cuántos con foto', () => {
  expect(textoResumenConteo({ total: 7124, conFoto: 148 })).toBe(
    '7.124 árboles en el filtro, 148 con foto.',
  );
  expect(textoResumenConteo({ total: 1, conFoto: 0 })).toBe('1 árbol en el filtro, 0 con foto.');
});

test.each([
  [0, 'Ningún árbol con foto'],
  [1, '1 tarjeta con foto'],
  [400, '400 tarjetas con foto'],
])('con %i tarjetas, «Con fotos» dice «%s»', (tarjetas, texto) => {
  expect(textoTarjetas(tarjetas)).toBe(texto);
});

const ESTIMACION = { tarjetas: 0, filasListado: 7000, hojas: 226 };

test('la estimación exacta junta hojas y peso aproximado', () => {
  const estimacion = { ...ESTIMACION, esPiso: false };
  expect(textoEstimacion(estimacion, 1_378_000)).toBe('226 hojas · ≈ 1,4 MB');
  expect(textoEstimacion({ ...estimacion, hojas: 1 }, 30_000)).toBe('1 hoja · ≈ 30 KB');
});

test('la estimación que es un piso dice «o más» en las hojas y en el peso', () => {
  const estimacion = { ...ESTIMACION, esPiso: true };
  expect(textoEstimacion(estimacion, 1_378_000)).toBe('226 hojas o más · 1,4 MB o más');
  expect(textoEstimacion({ ...estimacion, hojas: 1 }, 30_000)).toBe('1 hoja o más · 30 KB o más');
});

test('el aviso del tope aparece recién al pasarlo y dice cuántas van al listado', () => {
  expect(textoAvisoTope(400)).toBeNull();
  expect(textoAvisoTope(1234)).toBe(
    'Hay 1.234 árboles con foto: solo los primeros 400 salen como tarjeta. ' +
      'Los otros 834 van al listado, sin foto.',
  );
});

test.each([
  [{ etapa: ETAPA_REPORTE.leyendoArboles }, 'Leyendo árboles…', null],
  [{ etapa: ETAPA_REPORTE.bajandoFotos, listas: 37, total: 148 }, 'Bajando fotos: 37 de 148', 25],
  [{ etapa: ETAPA_REPORTE.bajandoFotos, listas: 0, total: 0 }, 'Bajando fotos: 0 de 0', null],
  [{ etapa: ETAPA_REPORTE.armandoPdf }, 'Armando el PDF…', null],
] as const)('progreso %j: «%s», barra %s', (progreso, texto, porcentaje) => {
  expect(textoProgreso(progreso)).toBe(texto);
  expect(porcentajeDeFotos(progreso)).toBe(porcentaje);
});

test('lo que se anuncia cambia con la etapa, no con cada foto', () => {
  expect(textoEtapa({ etapa: ETAPA_REPORTE.leyendoArboles })).toBe('Leyendo árboles…');
  expect(textoEtapa({ etapa: ETAPA_REPORTE.bajandoFotos, listas: 1, total: 148 })).toBe(
    textoEtapa({ etapa: ETAPA_REPORTE.bajandoFotos, listas: 90, total: 148 }),
  );
  expect(textoEtapa({ etapa: ETAPA_REPORTE.bajandoFotos, listas: 1, total: 148 })).toBe(
    'Bajando fotos…',
  );
  expect(textoEtapa({ etapa: ETAPA_REPORTE.armandoPdf })).toBe('Armando el PDF…');
});

test('las fotos fallidas se avisan en singular y en plural', () => {
  expect(textoFotosFallidas(1)).toBe(
    'El reporte se descargó, pero 1 foto no se pudo bajar y salió como «Foto no disponible».',
  );
  expect(textoFotosFallidas(3)).toBe(
    'El reporte se descargó, pero 3 fotos no se pudieron bajar y salieron como «Foto no disponible».',
  );
});
