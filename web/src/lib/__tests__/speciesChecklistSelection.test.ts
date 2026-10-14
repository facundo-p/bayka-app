import {
  avisoBloqueadas,
  filtrarCatalogo,
  planificarAccionMasiva,
  type ContextoSeleccion,
} from '../speciesChecklistSelection';
import type { EspecieCatalogo } from '../../queries/especieQueries';

const CATALOGO: EspecieCatalogo[] = [
  { id: 'sp-1', codigo: 'QB', nombre: 'Quebracho', nombreCientifico: 'Schinopsis balansae' },
  { id: 'sp-2', codigo: 'AL', nombre: 'Algarrobo', nombreCientifico: null },
  { id: 'sp-3', codigo: 'CE', nombre: 'Ceibo', nombreCientifico: 'Erythrina crista-galli' },
];

function contexto(parcial: Partial<ContextoSeleccion> = {}): ContextoSeleccion {
  return {
    idsVisibles: ['sp-1', 'sp-2', 'sp-3'],
    habilitadas: new Set<string>(),
    bloqueadas: new Set<string>(),
    ...parcial,
  };
}

describe('filtrarCatalogo', () => {
  test('sin texto devuelve el catálogo completo', () => {
    expect(filtrarCatalogo(CATALOGO, '   ')).toEqual(CATALOGO);
  });

  test('filtra por nombre, código o científico sin distinguir mayúsculas', () => {
    expect(filtrarCatalogo(CATALOGO, 'ceib').map((especie) => especie.id)).toEqual(['sp-3']);
    expect(filtrarCatalogo(CATALOGO, 'algarrobo').map((especie) => especie.id)).toEqual(['sp-2']);
    expect(filtrarCatalogo(CATALOGO, 'schinopsis').map((especie) => especie.id)).toEqual(['sp-1']);
  });
});

describe('planificarAccionMasiva — marcar', () => {
  test('habilita sólo las visibles no habilitadas', () => {
    const plan = planificarAccionMasiva(contexto({ habilitadas: new Set(['sp-1']) }), 'marcar');
    expect(plan.idsHabilitar).toEqual(['sp-2', 'sp-3']);
    expect(plan.idsQuitar).toEqual([]);
    expect(plan.bloqueadasMantenidas).toBe(0);
  });

  test('opera sólo sobre las visibles (respeta el filtro de búsqueda)', () => {
    const plan = planificarAccionMasiva(contexto({ idsVisibles: ['sp-3'] }), 'marcar');
    expect(plan.idsHabilitar).toEqual(['sp-3']);
  });
});

describe('planificarAccionMasiva — desmarcar', () => {
  test('sin bloqueadas quita todas las visibles habilitadas y no avisa', () => {
    const plan = planificarAccionMasiva(
      contexto({ habilitadas: new Set(['sp-1', 'sp-2', 'sp-3']) }),
      'desmarcar',
    );
    expect(plan.idsQuitar).toEqual(['sp-1', 'sp-2', 'sp-3']);
    expect(plan.idsHabilitar).toEqual([]);
    expect(plan.bloqueadasMantenidas).toBe(0);
  });

  test('conserva las bloqueadas y cuenta cuántas quedaron', () => {
    const plan = planificarAccionMasiva(
      contexto({
        habilitadas: new Set(['sp-1', 'sp-2', 'sp-3']),
        bloqueadas: new Set(['sp-1']),
      }),
      'desmarcar',
    );
    expect(plan.idsQuitar).toEqual(['sp-2', 'sp-3']);
    expect(plan.bloqueadasMantenidas).toBe(1);
  });

  test('todas bloqueadas → no quita nada y avisa por todas', () => {
    const plan = planificarAccionMasiva(
      contexto({
        habilitadas: new Set(['sp-1', 'sp-2', 'sp-3']),
        bloqueadas: new Set(['sp-1', 'sp-2', 'sp-3']),
      }),
      'desmarcar',
    );
    expect(plan.idsQuitar).toEqual([]);
    expect(plan.bloqueadasMantenidas).toBe(3);
  });

  test('sólo cuenta bloqueadas visibles', () => {
    const plan = planificarAccionMasiva(
      contexto({
        idsVisibles: ['sp-2', 'sp-3'],
        habilitadas: new Set(['sp-1', 'sp-2', 'sp-3']),
        bloqueadas: new Set(['sp-1']),
      }),
      'desmarcar',
    );
    expect(plan.idsQuitar).toEqual(['sp-2', 'sp-3']);
    expect(plan.bloqueadasMantenidas).toBe(0);
  });
});

describe('avisoBloqueadas', () => {
  test('singular para una especie', () => {
    expect(avisoBloqueadas(1)).toContain('1 especie quedó habilitada');
  });

  test('plural con el conteo correcto', () => {
    expect(avisoBloqueadas(3)).toBe(
      '3 especies quedaron habilitadas porque tienen árboles registrados y no se pueden quitar.',
    );
  });
});
