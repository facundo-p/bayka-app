import { describe, expect, test } from 'vitest';
import type { PlantacionConStats } from '../../../queries/plantationQueries';
import {
  FILTROS_PLANTACIONES_INICIALES,
  filtrarPlantaciones,
  hayFiltrosActivos,
  lugaresDisponibles,
  periodosDisponibles,
  resumenPlantaciones,
  type FiltrosPlantaciones,
} from '../filtrosPlantaciones';

/** Fábrica de plantaciones con los campos relevantes al filtrado. */
function plantacion(over: Partial<PlantacionConStats>): PlantacionConStats {
  return {
    id: 'id',
    lugar: 'Mendoza',
    periodo: '2025-2026',
    estado: 'activa',
    visibleInApp: true,
    gpsCaptureFrequency: 0,
    gpsCaptureRequired: false,
    createdAt: '2026-06-12T12:00:00Z',
    descripcion: null,
    fechaInicio: null,
    objetivoArboles: null,
    arboles: 0,
    parcelas: 0,
    usuarios: 0,
    ...over,
  };
}

const MENDOZA_ACTIVA = plantacion({
  id: 'p1',
  lugar: 'Mendoza',
  periodo: '2025-2026',
  estado: 'activa',
  createdAt: '2026-06-12T12:00:00Z',
  arboles: 120,
});
const SALTA_FINALIZADA = plantacion({
  id: 'p2',
  lugar: 'Salta',
  periodo: '2024-2025',
  estado: 'finalizada',
  createdAt: '2025-01-15T12:00:00Z',
  arboles: 80,
});
const MENDOZA_VIEJA = plantacion({
  id: 'p3',
  lugar: 'Mendoza',
  periodo: '2024-2025',
  estado: 'activa',
  createdAt: '2024-03-01T12:00:00Z',
  arboles: 40,
});
const TODAS = [MENDOZA_ACTIVA, SALTA_FINALIZADA, MENDOZA_VIEJA];

function con(over: Partial<FiltrosPlantaciones>): FiltrosPlantaciones {
  return { ...FILTROS_PLANTACIONES_INICIALES, ...over };
}

function ids(plantaciones: PlantacionConStats[]): string[] {
  return plantaciones.map((plantacion) => plantacion.id);
}

describe('filtrarPlantaciones', () => {
  test('sin filtros devuelve todas', () => {
    expect(filtrarPlantaciones(TODAS, FILTROS_PLANTACIONES_INICIALES)).toEqual(TODAS);
  });

  test('filtra por lugar', () => {
    expect(ids(filtrarPlantaciones(TODAS, con({ lugar: 'Mendoza' })))).toEqual(['p1', 'p3']);
  });

  test('filtra por período', () => {
    expect(ids(filtrarPlantaciones(TODAS, con({ periodo: '2024-2025' })))).toEqual(['p2', 'p3']);
  });

  test('filtra por estado', () => {
    expect(ids(filtrarPlantaciones(TODAS, con({ estado: 'finalizada' })))).toEqual(['p2']);
  });

  test('filtra por rango de fecha (createdAt) inclusive', () => {
    const filtros = con({ desde: '2025-01-01', hasta: '2025-12-31' });
    expect(ids(filtrarPlantaciones(TODAS, filtros))).toEqual(['p2']);
  });

  test('el borde del rango es inclusivo', () => {
    const filtros = con({ desde: '2026-06-12', hasta: '2026-06-12' });
    expect(ids(filtrarPlantaciones(TODAS, filtros))).toEqual(['p1']);
  });

  test('combina lugar + período + estado (AND = intersección)', () => {
    const filtros = con({ lugar: 'Mendoza', periodo: '2024-2025', estado: 'activa' });
    expect(ids(filtrarPlantaciones(TODAS, filtros))).toEqual(['p3']);
  });

  test('combina lugar + rango de fecha', () => {
    const filtros = con({ lugar: 'Mendoza', desde: '2026-01-01' });
    expect(ids(filtrarPlantaciones(TODAS, filtros))).toEqual(['p1']);
  });

  test('rango invertido (desde > hasta) no matchea nada', () => {
    const filtros = con({ desde: '2026-01-01', hasta: '2024-01-01' });
    expect(filtrarPlantaciones(TODAS, filtros)).toEqual([]);
  });

  test('combinación sin coincidencias devuelve lista vacía', () => {
    const filtros = con({ lugar: 'Salta', estado: 'activa' });
    expect(filtrarPlantaciones(TODAS, filtros)).toEqual([]);
  });
});

describe('lugaresDisponibles / periodosDisponibles', () => {
  test('devuelve valores distintos ordenados', () => {
    expect(lugaresDisponibles(TODAS)).toEqual(['Mendoza', 'Salta']);
    expect(periodosDisponibles(TODAS)).toEqual(['2024-2025', '2025-2026']);
  });

  test('lista vacía devuelve arreglo vacío', () => {
    expect(lugaresDisponibles([])).toEqual([]);
    expect(periodosDisponibles([])).toEqual([]);
  });
});

describe('hayFiltrosActivos', () => {
  test('false sin filtros', () => {
    expect(hayFiltrosActivos(FILTROS_PLANTACIONES_INICIALES)).toBe(false);
  });

  test('true con cualquier campo seteado', () => {
    expect(hayFiltrosActivos(con({ lugar: 'Mendoza' }))).toBe(true);
    expect(hayFiltrosActivos(con({ desde: '2025-01-01' }))).toBe(true);
    expect(hayFiltrosActivos(con({ estado: 'activa' }))).toBe(true);
  });
});

describe('resumenPlantaciones', () => {
  test('cuenta plantaciones, temporadas distintas y árboles totales', () => {
    expect(resumenPlantaciones(TODAS)).toBe(
      '3 plantaciones · 2 temporadas · 240 árboles registrados',
    );
  });

  test('sobre el subconjunto filtrado refleja la selección', () => {
    const soloMendoza = filtrarPlantaciones(TODAS, con({ lugar: 'Mendoza' }));
    expect(resumenPlantaciones(soloMendoza)).toBe(
      '2 plantaciones · 2 temporadas · 160 árboles registrados',
    );
  });

  test('lista vacía → 0 plantaciones', () => {
    expect(resumenPlantaciones([])).toBe('0 plantaciones · 0 temporadas · 0 árboles registrados');
  });
});
