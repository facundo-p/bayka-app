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
  type ConteoArboles,
} from '../dashboardQueries';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(resetEstadoMock);

/** Un árbol de la parcela 1; cada caso pisa lo que necesita. */
function conteo(extra: Partial<ConteoArboles> = {}): ConteoArboles {
  return {
    parcelaId: 'parc-1',
    speciesId: 'sp-1',
    mes: '2026-06',
    conGps: false,
    conFoto: false,
    cantidad: 1,
    ...extra,
  };
}

const ESPECIES = [
  { id: 'sp-1', codigo: 'QB', nombre: 'Quebracho', nombreCientifico: null },
  { id: 'sp-2', codigo: 'AL', nombre: 'Algarrobo', nombreCientifico: null },
];

describe('calcularKpis', () => {
  test('suma cantidades: NN, especies y porcentajes de GPS y foto redondeados', () => {
    const arboles = [
      conteo({ conGps: true, conFoto: true }),
      conteo({ cantidad: 2 }),
      conteo({ speciesId: null }),
    ];

    expect(calcularKpis(arboles)).toEqual({
      totalArboles: 4,
      arbolesNN: 1,
      especiesUsadas: 1,
      porcentajeConGps: 25,
      porcentajeConFoto: 25,
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
      conteo({ speciesId: 'sp-2', cantidad: 2 }),
      conteo({ speciesId: 'sp-2', mes: '2026-05' }),
      conteo({ speciesId: null, cantidad: 2 }),
      conteo(),
    ];

    expect(agruparPorEspecie(arboles, ESPECIES)).toEqual([
      { codigo: 'AL', nombre: 'Algarrobo', cantidad: 3 },
      { codigo: 'NN', nombre: 'Sin identificar', cantidad: 2 },
      { codigo: 'QB', nombre: 'Quebracho', cantidad: 1 },
    ]);
  });
});

describe('agruparPorParcela', () => {
  test('suma por parcela y deja en 0 las que no tienen árboles', () => {
    const parcelas = [
      { id: 'parc-1', nombre: 'Norte', codigo: 'P1' },
      { id: 'parc-2', nombre: 'Sur', codigo: 'P2' },
    ];
    const arboles = [conteo({ cantidad: 2 }), conteo({ conGps: true })];

    expect(agruparPorParcela(arboles, parcelas)).toEqual([
      { nombre: 'Norte', codigo: 'P1', cantidad: 3 },
      { nombre: 'Sur', codigo: 'P2', cantidad: 0 },
    ]);
  });
});

describe('agruparPorMes', () => {
  test('suma por mes y ordena cronológicamente', () => {
    const arboles = [
      conteo({ mes: '2026-06' }),
      conteo({ mes: '2026-04' }),
      conteo({ mes: '2026-06', speciesId: 'sp-2', cantidad: 3 }),
    ];

    expect(agruparPorMes(arboles)).toEqual([
      { mes: '2026-04', cantidad: 1 },
      { mes: '2026-06', cantidad: 4 },
    ]);
  });
});

describe('filtrarPorParcela', () => {
  const arboles = [conteo(), conteo({ parcelaId: 'parc-2' })];

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
      conteo({ conGps: true, conFoto: true }),
      conteo({ speciesId: null }),
      conteo({ speciesId: 'sp-2', parcelaId: 'parc-2', conGps: true }),
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
  const FILA_CONTEO = {
    parcela_id: 'parc-1',
    species_id: 'sp-1',
    mes: '2026-06',
    con_gps: true,
    con_foto: true,
    cantidad: 1,
  };

  function responder(consulta: ConsultaCapturada): RespuestaMock {
    if (consulta.tabla === 'dashboard_arboles') {
      return {
        data: [FILA_CONTEO, { ...FILA_CONTEO, species_id: null, con_gps: false, con_foto: false }],
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

  test('cuenta los árboles en el server con un solo RPC, sin bajarlos', async () => {
    const consultas = capturarConsultas(responder);
    await obtenerFuenteDashboard('plant-1');

    const rpcs = consultas.filter((consulta) => consulta.operacion === 'rpc');
    expect(rpcs).toHaveLength(1);
    expect(rpcs[0].tabla).toBe('dashboard_arboles');
    expect(rpcs[0].payload).toEqual({ p_plantation_id: 'plant-1' });
    expect(consultas.some((consulta) => consulta.tabla === 'trees')).toBe(false);
  });

  test('arma los KPIs y las distribuciones con los conteos del server', async () => {
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

  test('propaga el error del RPC', async () => {
    capturarConsultas((consulta) =>
      consulta.tabla === 'dashboard_arboles'
        ? { error: { message: 'permission denied' } }
        : responder(consulta),
    );

    await expect(obtenerFuenteDashboard('plant-1')).rejects.toThrow('permission denied');
  });
});
