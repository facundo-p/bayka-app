import { describe, expect, test } from 'vitest';
import { perfilResumen, plantacionConStats } from '../../../test/fabricas';
import {
  contarArboles,
  FILTRO_ESTADO,
  FILTRO_VISIBLES,
  filtrarPlantaciones,
  ORDEN_PLANTACION,
  resumenPlantaciones,
  TECNICO_TODOS,
  tecnicoElegible,
  tecnicosAsignados,
  TEMPORADA_TODAS,
  temporadasDisponibles,
  type FiltrosPlantaciones,
} from '../filtros';

const MENDOZA = plantacionConStats({
  id: 'p1',
  lugar: 'Mendoza',
  periodo: '2025-2026',
  estado: 'activa',
  createdAt: '2026-06-12T12:00:00Z',
  arboles: 120,
  tecnicos: ['u1'],
});

const SALTA = plantacionConStats({
  id: 'p2',
  lugar: 'Salta',
  periodo: '2024-2025',
  estado: 'finalizada',
  createdAt: '2025-01-15T12:00:00Z',
  arboles: 800,
  tecnicos: ['u1', 'u2'],
  visibleInApp: false,
});

const CORRIENTES = plantacionConStats({
  id: 'p3',
  lugar: 'Corrientes',
  periodo: '2024-2025',
  estado: 'activa',
  createdAt: '2025-08-20T12:00:00Z',
  arboles: 340,
});

const TODAS = [MENDOZA, SALTA, CORRIENTES];

const SIN_FILTROS: FiltrosPlantaciones = {
  busqueda: '',
  estado: FILTRO_ESTADO.todas,
  temporada: TEMPORADA_TODAS,
  visiblePor: TECNICO_TODOS,
  visibles: FILTRO_VISIBLES.todas,
  orden: ORDEN_PLANTACION.arboles,
};

/** Ids resultantes, para comparar filtro y orden en una sola aserción. */
function ids(filtros: Partial<FiltrosPlantaciones>): string[] {
  return filtrarPlantaciones(TODAS, { ...SIN_FILTROS, ...filtros }).map((p) => p.id);
}

describe('búsqueda', () => {
  test('sin término devuelve todas', () => {
    expect(ids({})).toHaveLength(3);
  });

  test('coincide por lugar sin distinguir mayúsculas', () => {
    expect(ids({ busqueda: 'mendo' })).toEqual(['p1']);
    expect(ids({ busqueda: 'SALTA' })).toEqual(['p2']);
  });

  test('coincide por temporada', () => {
    expect(ids({ busqueda: '2024-2025' })).toEqual(['p2', 'p3']);
  });

  test('los espacios alrededor del término se ignoran', () => {
    expect(ids({ busqueda: '  Salta  ' })).toEqual(['p2']);
  });

  test('ignora tildes en el término y en el lugar (#438)', () => {
    const conTilde = [plantacionConStats({ id: 'p9', lugar: 'Ñandubaysal Río Seco' })];
    const buscar = (busqueda: string) =>
      filtrarPlantaciones(conTilde, { ...SIN_FILTROS, busqueda }).map((p) => p.id);
    expect(buscar('rio')).toEqual(['p9']);
    expect(buscar('RÍO')).toEqual(['p9']);
    expect(buscar('nandubay')).toEqual(['p9']);
  });

  test('sin coincidencias devuelve vacío', () => {
    expect(ids({ busqueda: 'zzz-no-existe' })).toEqual([]);
  });
});

describe('estado y temporada', () => {
  test('el estado separa activas de finalizadas', () => {
    expect(ids({ estado: FILTRO_ESTADO.activas })).toEqual(['p3', 'p1']);
    expect(ids({ estado: FILTRO_ESTADO.finalizadas })).toEqual(['p2']);
  });

  test('la temporada acota al período elegido', () => {
    expect(ids({ temporada: '2024-2025' })).toEqual(['p2', 'p3']);
  });

  test('búsqueda, estado y temporada componen con AND', () => {
    // Corrientes es la única activa de 2024-2025 que además coincide con "co".
    expect(ids({ busqueda: 'co', estado: FILTRO_ESTADO.activas, temporada: '2024-2025' })).toEqual([
      'p3',
    ]);
    // Salta es finalizada: el estado la excluye aunque la temporada coincida.
    expect(
      ids({ estado: FILTRO_ESTADO.activas, temporada: '2024-2025', busqueda: 'salta' }),
    ).toEqual([]);
  });
});

describe('visible por y visibles', () => {
  test('visible por acota a las plantaciones asignadas al técnico', () => {
    expect(ids({ visiblePor: 'u1' })).toEqual(['p2', 'p1']);
    expect(ids({ visiblePor: 'u2' })).toEqual(['p2']);
    expect(ids({ visiblePor: 'u-sin-asignaciones' })).toEqual([]);
  });

  test('visibles separa las que se ven en la app de las ocultas', () => {
    expect(ids({ visibles: FILTRO_VISIBLES.si })).toEqual(['p3', 'p1']);
    expect(ids({ visibles: FILTRO_VISIBLES.no })).toEqual(['p2']);
  });

  test('técnico + visibles sí = lo que el técnico ve en la app', () => {
    expect(ids({ visiblePor: 'u1', visibles: FILTRO_VISIBLES.si })).toEqual(['p1']);
  });
});

describe('tecnicosAsignados', () => {
  const PERFILES = [
    perfilResumen({ id: 'u1', nombre: 'Ana' }),
    perfilResumen({ id: 'u2', nombre: 'Bruno', activo: false }),
    perfilResumen({ id: 'u3', nombre: 'Carla' }),
  ];

  test('lista los técnicos activos con al menos una asignación, en el orden de los perfiles', () => {
    expect(tecnicosAsignados(PERFILES, TODAS).map((perfil) => perfil.id)).toEqual(['u1']);
  });

  test('sin plantaciones no hay técnicos', () => {
    expect(tecnicosAsignados(PERFILES, [])).toEqual([]);
  });
});

describe('tecnicoElegible', () => {
  test('«todos» siempre es elegible', () => {
    expect(tecnicoElegible(TECNICO_TODOS, [])).toBe(true);
  });

  test('un técnico lo es solo si sigue entre los elegibles', () => {
    expect(tecnicoElegible('u1', ['u1', 'u2'])).toBe(true);
    expect(tecnicoElegible('u3', ['u1', 'u2'])).toBe(false);
  });
});

describe('orden', () => {
  test('por árboles, de mayor a menor', () => {
    expect(ids({ orden: ORDEN_PLANTACION.arboles })).toEqual(['p2', 'p3', 'p1']);
  });

  test('por lugar alfabético', () => {
    expect(ids({ orden: ORDEN_PLANTACION.lugar })).toEqual(['p3', 'p1', 'p2']);
  });

  test('por fecha de creación, de más reciente a más vieja', () => {
    expect(ids({ orden: ORDEN_PLANTACION.creada })).toEqual(['p1', 'p3', 'p2']);
  });

  test('desempata por lugar para que sea estable', () => {
    const empatadas = [
      plantacionConStats({ id: 'b', lugar: 'Bella Vista', arboles: 10 }),
      plantacionConStats({ id: 'a', lugar: 'Alvear', arboles: 10 }),
    ];
    const orden = filtrarPlantaciones(empatadas, SIN_FILTROS).map((p) => p.id);
    expect(orden).toEqual(['a', 'b']);
  });

  test('no muta el arreglo original', () => {
    const original = [...TODAS];
    filtrarPlantaciones(TODAS, { ...SIN_FILTROS, orden: ORDEN_PLANTACION.lugar });
    expect(TODAS).toEqual(original);
  });
});

describe('temporadasDisponibles', () => {
  test('devuelve las distintas, de la más reciente a la más vieja', () => {
    expect(temporadasDisponibles(TODAS)).toEqual(['2025-2026', '2024-2025']);
  });

  test('sin plantaciones devuelve vacío', () => {
    expect(temporadasDisponibles([])).toEqual([]);
  });
});

describe('resumen y conteos', () => {
  test('suma los árboles de las plantaciones dadas', () => {
    expect(contarArboles(TODAS)).toBe(1260);
  });

  test('el resumen cuenta plantaciones, temporadas y árboles', () => {
    expect(resumenPlantaciones(TODAS)).toBe(
      '3 plantaciones · 2 temporadas · 1.260 árboles registrados',
    );
  });

  test('el resumen usa el singular cuando corresponde', () => {
    expect(resumenPlantaciones([MENDOZA])).toBe(
      '1 plantación · 1 temporada · 120 árboles registrados',
    );
  });

  test('el resumen del listado vacío no rompe', () => {
    expect(resumenPlantaciones([])).toBe('0 plantaciones · 0 temporadas · 0 árboles registrados');
  });

  test.each([
    [1, '1 árbol registrado'],
    [2, '2 árboles registrados'],
  ])('el resumen concuerda %i árboles: "%s"', (arboles, texto) => {
    expect(resumenPlantaciones([plantacionConStats({ arboles })])).toBe(
      `1 plantación · 1 temporada · ${texto}`,
    );
  });
});

describe('archivadas', () => {
  const ARCHIVADA = plantacionConStats({
    id: 'p4',
    lugar: 'Tucumán',
    estado: 'finalizada',
    arboles: 50,
    archivadaEn: '2026-09-01T12:00:00Z',
  });
  const CON_ARCHIVADA = [...TODAS, ARCHIVADA];

  function idsCon(estado: FiltrosPlantaciones['estado']): string[] {
    return filtrarPlantaciones(CON_ARCHIVADA, { ...SIN_FILTROS, estado }).map((p) => p.id);
  }

  test('solo aparecen en su propio filtro', () => {
    expect(idsCon(FILTRO_ESTADO.archivadas)).toEqual(['p4']);
    expect(idsCon(FILTRO_ESTADO.todas)).not.toContain('p4');
    expect(idsCon(FILTRO_ESTADO.activas)).not.toContain('p4');
    expect(idsCon(FILTRO_ESTADO.finalizadas)).toEqual(['p2']);
  });

  test('el resumen de la cabecera no las cuenta', () => {
    expect(resumenPlantaciones(CON_ARCHIVADA)).toBe(resumenPlantaciones(TODAS));
  });
});
