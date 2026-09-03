import type { PlantacionConStats } from '../../../queries/plantationQueries';
import { sugerencias } from '../sugerencias';

function plantacion(parcial: Partial<PlantacionConStats> & { id: string }): PlantacionConStats {
  return {
    lugar: parcial.id,
    periodo: '2025-2026',
    estado: 'activa',
    visibleInApp: true,
    gpsCaptureFrequency: 10,
    gpsCaptureRequired: true,
    createdAt: '2026-01-01T00:00:00Z',
    descripcion: null,
    fechaInicio: null,
    objetivoArboles: null,
    arboles: 0,
    parcelas: 0,
    usuarios: 0,
    ...parcial,
  };
}

test('sin plantaciones: no hay sugerencias', () => {
  expect(sugerencias([])).toEqual([]);
});

test('la temporada activa (más árboles entre las activas) va primero', () => {
  const chica = plantacion({ id: 'chica', estado: 'activa', arboles: 10, createdAt: '2026-01-01T00:00:00Z' });
  const grande = plantacion({ id: 'grande', estado: 'activa', arboles: 500, createdAt: '2025-01-01T00:00:00Z' });
  const resultado = sugerencias([chica, grande]);
  expect(resultado[0].id).toBe('grande');
});

test('luego de la temporada, el resto va por fecha de creación descendente, sin repetir la temporada', () => {
  const temporada = plantacion({ id: 'temporada', estado: 'activa', arboles: 999, createdAt: '2026-01-01T00:00:00Z' });
  const vieja = plantacion({ id: 'vieja', estado: 'finalizada', arboles: 5, createdAt: '2024-01-01T00:00:00Z' });
  const reciente = plantacion({ id: 'reciente', estado: 'finalizada', arboles: 5, createdAt: '2026-06-01T00:00:00Z' });
  const resultado = sugerencias([vieja, temporada, reciente]);
  expect(resultado.map((item) => item.id)).toEqual(['temporada', 'reciente', 'vieja']);
});

test('sin plantaciones activas: solo ordena por fecha de creación descendente', () => {
  const a = plantacion({ id: 'a', estado: 'finalizada', createdAt: '2026-01-01T00:00:00Z' });
  const b = plantacion({ id: 'b', estado: 'finalizada', createdAt: '2026-06-01T00:00:00Z' });
  const resultado = sugerencias([a, b]);
  expect(resultado.map((item) => item.id)).toEqual(['b', 'a']);
});

test('tope de 4 sugerencias aunque haya más plantaciones', () => {
  const plantaciones = Array.from({ length: 6 }, (_, indice) =>
    plantacion({ id: `p${indice}`, estado: 'finalizada', createdAt: `2026-0${indice + 1}-01T00:00:00Z` }),
  );
  expect(sugerencias(plantaciones)).toHaveLength(4);
});

test('mapea al formato de ResultadoBusqueda esperado por la paleta', () => {
  const unica = plantacion({ id: 'p1', lugar: 'La Maluka', periodo: 'Otoño 2026', estado: 'finalizada' });
  const [resultado] = sugerencias([unica]);
  expect(resultado).toEqual({
    tipo: 'plantacion',
    id: 'p1',
    titulo: 'La Maluka',
    meta: 'Otoño 2026',
    to: '/plantaciones/p1',
  });
});
