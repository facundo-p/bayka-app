import { resetEstadoMock } from '../../test/supabaseMock';
import { capturarConsultas } from '../../test/capturarConsultas';
import type { ConsultaCapturada, RespuestaMock } from '../../test/queryBuilderMock';
import {
  agruparPorEspecie,
  agruparPorMes,
  agruparPorParcela,
  calcularDashboard,
  calcularKpis,
  filtrarPorParcela,
  obtenerFuenteDashboard,
  type ArbolDashboard,
} from '../dashboardQueries';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(resetEstadoMock);

/** Árbol base de los tests de agregación; cada caso pisa lo que necesita. */
function arbol(extra: Partial<ArbolDashboard> = {}): ArbolDashboard {
  return {
    speciesId: 'sp-1',
    fotoUrl: null,
    createdAt: '2026-06-03T12:00:00Z',
    latitude: null,
    groupId: 'gr-1',
    parcelaId: 'parc-1',
    ...extra,
  };
}

const ESPECIES = [
  { id: 'sp-1', codigo: 'QB', nombre: 'Quebracho', nombreCientifico: null },
  { id: 'sp-2', codigo: 'AL', nombre: 'Algarrobo', nombreCientifico: null },
];

describe('calcularKpis', () => {
  test('cuenta NN y especies, y redondea los porcentajes de GPS y foto', () => {
    const arboles = [
      arbol({ latitude: -27.1, fotoUrl: 'plantations/p1/trees/t1.jpg' }),
      // Foto local de mobile sin sincronizar: no cuenta como subida.
      arbol({ fotoUrl: 'file:///data/foto.jpg' }),
      arbol({ speciesId: null }),
    ];

    expect(calcularKpis(arboles)).toEqual({
      totalArboles: 3,
      arbolesNN: 1,
      especiesUsadas: 1,
      porcentajeConGps: 33,
      porcentajeConFoto: 33,
    });
  });

  test('sin árboles todos los valores quedan en 0', () => {
    expect(calcularKpis([])).toEqual({
      totalArboles: 0,
      arbolesNN: 0,
      especiesUsadas: 0,
      porcentajeConGps: 0,
      porcentajeConFoto: 0,
    });
  });
});

describe('agruparPorEspecie', () => {
  test('ordena descendente y agrupa los sin especie como Sin identificar', () => {
    const arboles = [
      arbol({ speciesId: 'sp-2' }),
      arbol({ speciesId: 'sp-2' }),
      arbol({ speciesId: 'sp-2' }),
      arbol({ speciesId: null }),
      arbol({ speciesId: null }),
      arbol(),
    ];

    expect(agruparPorEspecie(arboles, ESPECIES)).toEqual([
      { codigo: 'AL', nombre: 'Algarrobo', cantidad: 3 },
      { codigo: 'NN', nombre: 'Sin identificar', cantidad: 2 },
      { codigo: 'QB', nombre: 'Quebracho', cantidad: 1 },
    ]);
  });
});

describe('agruparPorParcela', () => {
  test('cuenta por parcela y deja en 0 las que no tienen árboles', () => {
    const parcelas = [
      { id: 'parc-1', nombre: 'Norte', codigo: 'P1' },
      { id: 'parc-2', nombre: 'Sur', codigo: 'P2' },
    ];
    const arboles = [arbol(), arbol(), arbol({ parcelaId: 'parc-1' })];

    expect(agruparPorParcela(arboles, parcelas)).toEqual([
      { nombre: 'Norte', codigo: 'P1', cantidad: 3 },
      { nombre: 'Sur', codigo: 'P2', cantidad: 0 },
    ]);
  });
});

describe('agruparPorMes', () => {
  test('agrupa como YYYY-MM y ordena cronológicamente', () => {
    const arboles = [
      arbol({ createdAt: '2026-06-03T12:00:00Z' }),
      arbol({ createdAt: '2026-04-10T08:00:00Z' }),
      arbol({ createdAt: '2026-06-20T18:30:00Z' }),
    ];

    expect(agruparPorMes(arboles)).toEqual([
      { mes: '2026-04', cantidad: 1 },
      { mes: '2026-06', cantidad: 2 },
    ]);
  });
});

describe('filtrarPorParcela', () => {
  const arboles = [arbol(), arbol({ parcelaId: 'parc-2' })];

  test('sin parcela devuelve la misma lista, sin copiarla', () => {
    expect(filtrarPorParcela(arboles, null)).toBe(arboles);
  });

  test('con parcela deja solo los de esa parcela', () => {
    expect(filtrarPorParcela(arboles, 'parc-2')).toEqual([arboles[1]]);
  });
});

describe('calcularDashboard', () => {
  const FUENTE = {
    arboles: [
      arbol({ latitude: -27.1, fotoUrl: 'plantations/p1/trees/t1.jpg' }),
      arbol({ speciesId: null }),
      arbol({ speciesId: 'sp-2', parcelaId: 'parc-2', latitude: -27.2 }),
    ],
    especies: ESPECIES,
    parcelas: [
      { id: 'parc-1', nombre: 'Norte', codigo: 'P1' },
      { id: 'parc-2', nombre: 'Sur', codigo: 'P2' },
      { id: 'parc-3', nombre: 'Este', codigo: 'P3' },
    ],
    totalGrupos: 7,
  };

  test('con una parcela recalcula KPIs y especies sobre sus árboles', () => {
    const dashboard = calcularDashboard(FUENTE, 'parc-1');

    expect(dashboard.totalArboles).toBe(2);
    expect(dashboard.arbolesNN).toBe(1);
    expect(dashboard.especiesUsadas).toBe(1);
    expect(dashboard.porcentajeConGps).toBe(50);
    expect(dashboard.porcentajeConFoto).toBe(50);
    expect(dashboard.porEspecie).toEqual([
      { codigo: 'QB', nombre: 'Quebracho', cantidad: 1 },
      { codigo: 'NN', nombre: 'Sin identificar', cantidad: 1 },
    ]);
  });

  test('el tamaño de la plantación (grupos y parcelas) no sigue al filtro', () => {
    const dashboard = calcularDashboard(FUENTE, 'parc-2');

    expect(dashboard.totalGrupos).toBe(7);
    expect(dashboard.totalParcelas).toBe(3);
  });

  test('una parcela sin árboles da ceros, no un dashboard de la plantación', () => {
    const dashboard = calcularDashboard(FUENTE, 'parc-3');

    expect(dashboard.totalArboles).toBe(0);
    expect(dashboard.porEspecie).toEqual([]);
    expect(dashboard.porcentajeConGps).toBe(0);
  });
});

describe('obtenerFuenteDashboard', () => {
  const FILA_ARBOL = {
    species_id: 'sp-1',
    foto_url: 'plantations/p1/trees/t1.jpg',
    created_at: '2026-06-03T12:00:00Z',
    latitude: -27.1,
    group_id: 'gr-1',
    groups: { plantation_id: 'plant-1', parcela_id: 'parc-1' },
  };

  function responder(consulta: ConsultaCapturada): RespuestaMock {
    if (consulta.tabla === 'trees') {
      return {
        data: [
          FILA_ARBOL,
          { ...FILA_ARBOL, species_id: null, foto_url: 'file:///f.jpg', latitude: null },
        ],
      };
    }
    if (consulta.tabla === 'species') {
      return { data: [{ id: 'sp-1', codigo: 'QB', nombre: 'Quebracho', nombre_cientifico: null }] };
    }
    if (consulta.tabla === 'parcelas') {
      return { data: [{ id: 'parc-1', nombre: 'Norte', codigo: 'P1' }] };
    }
    return { count: 3 };
  }

  test('lee los árboles paginando con range (sin el tope de 1000)', async () => {
    const consultas = capturarConsultas(responder);
    await obtenerFuenteDashboard('plant-1');

    const deArboles = consultas.filter((consulta) => consulta.tabla === 'trees');
    // Mock con < 1000 filas: una sola página (range 0–999) y corta.
    expect(deArboles).toHaveLength(1);
    expect(deArboles[0].rango).toEqual({ desde: 0, hasta: 999 });
    expect(deArboles[0].limite).toBeUndefined();
    expect(deArboles[0].columnas).toMatch(/^species_id/);
    expect(deArboles[0].filtros).toContainEqual({
      metodo: 'eq',
      columna: 'groups.plantation_id',
      valor: 'plant-1',
    });
  });

  test('arma los KPIs y las distribuciones agregadas en cliente', async () => {
    capturarConsultas(responder);

    expect(calcularDashboard(await obtenerFuenteDashboard('plant-1'), null)).toEqual({
      totalArboles: 2,
      arbolesNN: 1,
      especiesUsadas: 1,
      porcentajeConGps: 50,
      porcentajeConFoto: 50,
      totalGrupos: 3,
      totalParcelas: 1,
      porEspecie: [
        { codigo: 'QB', nombre: 'Quebracho', cantidad: 1 },
        { codigo: 'NN', nombre: 'Sin identificar', cantidad: 1 },
      ],
      porParcela: [{ nombre: 'Norte', codigo: 'P1', cantidad: 2 }],
      porMes: [{ mes: '2026-06', cantidad: 2 }],
    });
  });

  test('si latitude no existe (migracion 023 sin aplicar) reintenta sin la columna', async () => {
    const consultas = capturarConsultas((consulta) => {
      if (consulta.tabla === 'trees') {
        if (consulta.columnas?.includes('latitude')) {
          return { error: { message: 'column trees.latitude does not exist', code: '42703' } };
        }
        // El server real no devuelve la columna no pedida.
        const filas = (responder(consulta).data ?? []) as Record<string, unknown>[];
        return {
          data: filas.map((fila) => {
            const sinLatitude = { ...fila };
            delete sinLatitude.latitude;
            return sinLatitude;
          }),
        };
      }
      return responder(consulta);
    });

    const dashboard = calcularDashboard(await obtenerFuenteDashboard('plant-1'), null);

    const deArboles = consultas.filter((consulta) => consulta.tabla === 'trees');
    expect(deArboles).toHaveLength(2);
    expect(deArboles[1].columnas).not.toContain('latitude');
    expect(dashboard.porcentajeConGps).toBe(0);
    expect(dashboard.totalArboles).toBe(2);
  });
});
