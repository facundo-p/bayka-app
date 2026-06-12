import { resetEstadoMock } from '../../test/supabaseMock';
import { capturarConsultas } from '../../test/capturarConsultas';
import type { ConsultaCapturada, RespuestaMock } from '../../test/queryBuilderMock';
import {
  agruparPorEspecie,
  agruparPorMes,
  agruparPorParcela,
  calcularKpis,
  obtenerDashboard,
  porcentaje,
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

describe('porcentaje', () => {
  test('redondea al entero más cercano', () => {
    expect(porcentaje(1, 3)).toBe(33);
    expect(porcentaje(2, 3)).toBe(67);
  });

  test('total 0 devuelve 0 (nunca NaN)', () => {
    expect(porcentaje(0, 0)).toBe(0);
  });
});

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

describe('obtenerDashboard', () => {
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

  test('lee los árboles en una sola consulta liviana con tope', async () => {
    const consultas = capturarConsultas(responder);
    await obtenerDashboard('plant-1');

    const deArboles = consultas.filter((consulta) => consulta.tabla === 'trees');
    expect(deArboles).toHaveLength(1);
    expect(deArboles[0].limite).toBe(15000);
    expect(deArboles[0].columnas).toMatch(/^species_id/);
    expect(deArboles[0].filtros).toContainEqual({
      metodo: 'eq',
      columna: 'groups.plantation_id',
      valor: 'plant-1',
    });
  });

  test('arma los KPIs y las distribuciones agregadas en cliente', async () => {
    capturarConsultas(responder);

    expect(await obtenerDashboard('plant-1')).toEqual({
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

    const dashboard = await obtenerDashboard('plant-1');

    const deArboles = consultas.filter((consulta) => consulta.tabla === 'trees');
    expect(deArboles).toHaveLength(2);
    expect(deArboles[1].columnas).not.toContain('latitude');
    expect(dashboard.porcentajeConGps).toBe(0);
    expect(dashboard.totalArboles).toBe(2);
  });
});
