import { plantacionConStats } from '../../../test/fabricas';
import { sugerencias } from '../sugerencias';

test('sin plantaciones: no hay sugerencias', () => {
  expect(sugerencias([])).toEqual([]);
});

test('la temporada activa (más árboles entre las activas) va primero', () => {
  const chica = plantacionConStats({
    id: 'chica',
    estado: 'activa',
    arboles: 10,
    createdAt: '2026-01-01T00:00:00Z',
  });
  const grande = plantacionConStats({
    id: 'grande',
    estado: 'activa',
    arboles: 500,
    createdAt: '2025-01-01T00:00:00Z',
  });
  const resultado = sugerencias([chica, grande]);
  expect(resultado[0].id).toBe('grande');
});

test('luego de la temporada, el resto va por fecha de creación descendente, sin repetir la temporada', () => {
  const temporada = plantacionConStats({
    id: 'temporada',
    estado: 'activa',
    arboles: 999,
    createdAt: '2026-01-01T00:00:00Z',
  });
  const vieja = plantacionConStats({
    id: 'vieja',
    estado: 'finalizada',
    arboles: 5,
    createdAt: '2024-01-01T00:00:00Z',
  });
  const reciente = plantacionConStats({
    id: 'reciente',
    estado: 'finalizada',
    arboles: 5,
    createdAt: '2026-06-01T00:00:00Z',
  });
  const resultado = sugerencias([vieja, temporada, reciente]);
  expect(resultado.map((item) => item.id)).toEqual(['temporada', 'reciente', 'vieja']);
});

test('sin plantaciones activas: solo ordena por fecha de creación descendente', () => {
  const a = plantacionConStats({
    id: 'a',
    estado: 'finalizada',
    createdAt: '2026-01-01T00:00:00Z',
  });
  const b = plantacionConStats({
    id: 'b',
    estado: 'finalizada',
    createdAt: '2026-06-01T00:00:00Z',
  });
  const resultado = sugerencias([a, b]);
  expect(resultado.map((item) => item.id)).toEqual(['b', 'a']);
});

test('tope de 4 sugerencias aunque haya más plantaciones', () => {
  const plantaciones = Array.from({ length: 6 }, (_, indice) =>
    plantacionConStats({
      id: `p${indice}`,
      estado: 'finalizada',
      createdAt: `2026-0${indice + 1}-01T00:00:00Z`,
    }),
  );
  expect(sugerencias(plantaciones)).toHaveLength(4);
});

test('mapea al formato de ResultadoBusqueda esperado por la paleta', () => {
  const unica = plantacionConStats({
    id: 'p1',
    lugar: 'La Maluka',
    periodo: 'Otoño 2026',
    estado: 'finalizada',
  });
  const [resultado] = sugerencias([unica]);
  expect(resultado).toEqual({
    tipo: 'plantacion',
    id: 'p1',
    titulo: 'La Maluka',
    meta: 'Otoño 2026',
    to: '/plantaciones/p1',
  });
});

test('nunca sugiere una plantación archivada, aunque sea la de más árboles', () => {
  const archivada = plantacionConStats({
    id: 'archivada',
    arboles: 999,
    archivadaEn: '2026-09-01T00:00:00Z',
  });
  const activa = plantacionConStats({ id: 'activa', arboles: 1 });
  expect(sugerencias([archivada, activa]).map((resultado) => resultado.id)).toEqual(['activa']);
});
