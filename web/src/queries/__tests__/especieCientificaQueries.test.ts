import { resetEstadoMock } from '../../test/supabaseMock';
import { capturarConsultas } from '../../test/capturarConsultas';
import { listarEspeciesCientificas, listarNombresCientificos } from '../especieCientificaQueries';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(resetEstadoMock);

const CIENTIFICAS = [
  { id: 'ec-1', nombre: 'Prosopis alba' },
  { id: 'ec-2', nombre: 'Schinus molle' },
];

const fila = (id: string, codigo: string, nombre: string, cientifica: string | null) => ({
  id,
  codigo,
  nombre,
  nombre_cientifico: null,
  tipo: 'flora',
  subtipo: 'arbol',
  especie_cientifica_id: cientifica,
});

describe('listarNombresCientificos', () => {
  test('lee id y nombre ordenados por nombre', async () => {
    const consultas = capturarConsultas(() => ({ data: CIENTIFICAS }));

    expect(await listarNombresCientificos()).toEqual(CIENTIFICAS);
    expect(consultas[0].tabla).toBe('especies_cientificas');
    expect(consultas[0].columnas).toBe('id, nombre');
    expect(consultas[0].orden).toEqual({ columna: 'nombre', ascending: true });
  });

  test('propaga el error', async () => {
    capturarConsultas(() => ({ error: { message: 'falló' } }));
    await expect(listarNombresCientificos()).rejects.toThrow('falló');
  });
});

describe('listarEspeciesCientificas', () => {
  test('agrupa en cada especie científica las especies vinculadas', async () => {
    capturarConsultas((consulta) =>
      consulta.tabla === 'especies_cientificas'
        ? { data: CIENTIFICAS }
        : {
            data: [
              fila('sp-1', 'ALB', 'Algarrobo blanco', 'ec-1'),
              fila('sp-2', 'IGA', 'Igarobá', 'ec-1'),
              fila('sp-3', 'TAL', 'Tala', null),
            ],
          },
    );

    expect(await listarEspeciesCientificas()).toEqual([
      {
        id: 'ec-1',
        nombre: 'Prosopis alba',
        especies: [
          { id: 'sp-1', codigo: 'ALB', nombre: 'Algarrobo blanco' },
          { id: 'sp-2', codigo: 'IGA', nombre: 'Igarobá' },
        ],
      },
      { id: 'ec-2', nombre: 'Schinus molle', especies: [] },
    ]);
  });
});
