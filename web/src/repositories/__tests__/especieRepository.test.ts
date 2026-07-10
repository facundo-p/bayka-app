import { resetEstadoMock } from '../../test/supabaseMock';
import { capturarConsultas } from '../../test/capturarConsultas';
import { PG_ERROR } from '../../lib/postgresErrorCodes';
import {
  CodigoEspecieDuplicadoError,
  crearEspecie,
  editarEspecie,
  type EspecieInput,
} from '../especieRepository';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

const INPUT: EspecieInput = { codigo: 'ANC', nombre: 'Anchico', nombreCientifico: 'Parapiptadenia rigida' };
const INPUT_SIN_CIENTIFICO: EspecieInput = { codigo: 'IBI', nombre: 'Ibirá Pitá', nombreCientifico: null };

const ERROR_DUPLICADO = { message: 'duplicate key value violates unique constraint', code: PG_ERROR.UNIQUE_VIOLATION };

beforeEach(resetEstadoMock);

describe('crearEspecie', () => {
  test('inserta código, nombre y nombre_cientifico; devuelve el id creado', async () => {
    const consultas = capturarConsultas((consulta) =>
      consulta.tabla === 'species' ? { data: { id: 'sp-nuevo' } } : { data: null },
    );
    const id = await crearEspecie(INPUT);

    expect(id).toBe('sp-nuevo');
    const [insert] = consultas;
    expect(insert.tabla).toBe('species');
    expect(insert.operacion).toBe('insert');
    expect(insert.payload).toEqual({
      codigo: 'ANC',
      nombre: 'Anchico',
      nombre_cientifico: 'Parapiptadenia rigida',
    });
  });

  test('nombre científico vacío se guarda como null', async () => {
    const consultas = capturarConsultas(() => ({ data: { id: 'sp-2' } }));
    await crearEspecie(INPUT_SIN_CIENTIFICO);

    expect((consultas[0].payload as Record<string, unknown>).nombre_cientifico).toBeNull();
  });

  test('código duplicado (unique_violation) lanza CodigoEspecieDuplicadoError', async () => {
    capturarConsultas(() => ({ error: ERROR_DUPLICADO }));
    await expect(crearEspecie(INPUT)).rejects.toBeInstanceOf(CodigoEspecieDuplicadoError);
  });

  test('otros errores propagan su mensaje crudo', async () => {
    capturarConsultas(() => ({ error: { message: 'insufficient_privilege' } }));
    await expect(crearEspecie(INPUT)).rejects.toThrow('insufficient_privilege');
  });
});

describe('editarEspecie', () => {
  test('actualiza los campos filtrando por id', async () => {
    const consultas = capturarConsultas(() => ({ data: null }));
    await editarEspecie('sp-1', INPUT);

    const [update] = consultas;
    expect(update.tabla).toBe('species');
    expect(update.operacion).toBe('update');
    expect(update.filtros).toEqual([{ metodo: 'eq', columna: 'id', valor: 'sp-1' }]);
    expect(update.payload).toEqual({
      codigo: 'ANC',
      nombre: 'Anchico',
      nombre_cientifico: 'Parapiptadenia rigida',
    });
  });

  test('código duplicado al editar lanza CodigoEspecieDuplicadoError', async () => {
    capturarConsultas(() => ({ error: ERROR_DUPLICADO }));
    await expect(editarEspecie('sp-1', INPUT)).rejects.toBeInstanceOf(CodigoEspecieDuplicadoError);
  });
});
