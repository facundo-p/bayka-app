import { resetEstadoMock } from '../../test/supabaseMock';
import type { ConsultaCapturada, RespuestaMock } from '../../test/queryBuilderMock';
import { capturarConsultas } from '../../test/capturarConsultas';
import { PG_ERROR } from '../../lib/postgresErrorCodes';
import type { Perfil } from '../profileRepository';
import {
  actualizarConfigGps,
  actualizarVisibilidad,
  crearPlantacion,
  editarPlantacion,
  existePlantacion,
  MENSAJE_GPS_SIN_MIGRACION,
  MENSAJE_VISIBILIDAD_SIN_MIGRACION,
  type PlantacionInput,
} from '../plantationRepository';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

const PERFIL: Perfil = { id: 'user-1', nombre: 'Ana', rol: 'admin', organizacionId: 'org-1' };

const INPUT_COMPLETO: PlantacionInput = {
  lugar: 'Mendoza',
  periodo: '2025-2026',
  descripcion: 'Finca norte',
  fechaInicio: '2026-07-01',
  objetivoArboles: 500,
};

const INPUT_BASE: PlantacionInput = { lugar: 'Mendoza', periodo: '2025-2026' };

const ERROR_COLUMNA = {
  message: 'column "objetivo_arboles" does not exist',
  code: PG_ERROR.UNDEFINED_COLUMN,
};

/** Responde OK: el insert de plantación devuelve el id; el resto, vacío. */
function responderOk(consulta: ConsultaCapturada): RespuestaMock {
  if (consulta.tabla === 'plantations' && consulta.operacion === 'insert') {
    return { data: { id: 'plant-nuevo' } };
  }
  return { data: null };
}

beforeEach(resetEstadoMock);

describe('crearPlantacion', () => {
  test('inserta con estado activa, organización y autor del perfil + parcela P1', async () => {
    const consultas = capturarConsultas(responderOk);
    const id = await crearPlantacion(INPUT_COMPLETO, PERFIL);

    expect(id).toBe('plant-nuevo');
    const [plantacion, parcela] = consultas;
    expect(plantacion.payload).toEqual({
      lugar: 'Mendoza',
      periodo: '2025-2026',
      estado: 'activa',
      organizacion_id: 'org-1',
      creado_por: 'user-1',
      descripcion: 'Finca norte',
      fecha_inicio: '2026-07-01',
      objetivo_arboles: 500,
    });
    expect(parcela.tabla).toBe('parcelas');
    expect(parcela.payload).toEqual({
      plantation_id: 'plant-nuevo',
      codigo: 'P1',
      nombre: 'Parcela 1',
    });
  });

  test('arma el payload solo con campos con valor (sin claves undefined)', async () => {
    const consultas = capturarConsultas(responderOk);
    await crearPlantacion(INPUT_BASE, PERFIL);

    expect(Object.keys(consultas[0].payload as object).sort()).toEqual([
      'creado_por',
      'estado',
      'lugar',
      'organizacion_id',
      'periodo',
    ]);
  });

  test('ante columna inexistente (024 sin aplicar) reintenta solo con los campos base', async () => {
    const consultas = capturarConsultas((consulta) => {
      if (consulta.tabla === 'plantations' && consulta.operacion === 'insert') {
        const payload = consulta.payload as Record<string, unknown>;
        if ('objetivo_arboles' in payload) return { error: ERROR_COLUMNA };
        return { data: { id: 'plant-nuevo' } };
      }
      return { data: null };
    });
    const id = await crearPlantacion(INPUT_COMPLETO, PERFIL);

    expect(id).toBe('plant-nuevo');
    const inserts = consultas.filter((consulta) => consulta.tabla === 'plantations');
    expect(inserts).toHaveLength(2);
    expect(Object.keys(inserts[1].payload as object)).not.toContain('objetivo_arboles');
  });

  test('si falla la parcela default borra la plantación (rollback best-effort) y lanza', async () => {
    const consultas = capturarConsultas((consulta) => {
      if (consulta.tabla === 'parcelas') return { error: { message: 'falló la parcela' } };
      return responderOk(consulta);
    });

    await expect(crearPlantacion(INPUT_BASE, PERFIL)).rejects.toThrow('falló la parcela');
    const borrado = consultas.find((consulta) => consulta.operacion === 'delete');
    expect(borrado?.tabla).toBe('plantations');
    expect(borrado?.filtros).toEqual([{ metodo: 'eq', columna: 'id', valor: 'plant-nuevo' }]);
  });

  test('otros errores del insert no se reintentan y se propagan', async () => {
    const consultas = capturarConsultas(() => ({ error: { message: 'sin permisos' } }));
    await expect(crearPlantacion(INPUT_COMPLETO, PERFIL)).rejects.toThrow('sin permisos');
    expect(consultas).toHaveLength(1);
  });
});

describe('editarPlantacion', () => {
  test('actualiza los campos del form sin tocar estado ni organizacion_id', async () => {
    const consultas = capturarConsultas(() => ({ data: null }));
    await editarPlantacion('plant-1', INPUT_COMPLETO);

    const [update] = consultas;
    expect(update.operacion).toBe('update');
    expect(update.filtros).toEqual([{ metodo: 'eq', columna: 'id', valor: 'plant-1' }]);
    const payload = update.payload as Record<string, unknown>;
    expect(payload.lugar).toBe('Mendoza');
    expect(payload).not.toHaveProperty('estado');
    expect(payload).not.toHaveProperty('organizacion_id');
    expect(payload).not.toHaveProperty('creado_por');
  });

  test('ante columna inexistente reintenta el update solo con lugar y período', async () => {
    const consultas = capturarConsultas((consulta) => {
      const payload = consulta.payload as Record<string, unknown>;
      return 'descripcion' in payload ? { error: ERROR_COLUMNA } : { data: null };
    });
    await editarPlantacion('plant-1', INPUT_COMPLETO);

    expect(consultas).toHaveLength(2);
    expect(Object.keys(consultas[1].payload as object).sort()).toEqual(['lugar', 'periodo']);
  });
});

describe('actualizarConfigGps', () => {
  test('actualiza frecuencia y obligatoriedad de la plantación', async () => {
    const consultas = capturarConsultas(() => ({ data: null }));
    await actualizarConfigGps('plant-1', { frecuencia: 5, obligatoria: false });

    const [update] = consultas;
    expect(update.tabla).toBe('plantations');
    expect(update.operacion).toBe('update');
    expect(update.payload).toEqual({ gps_capture_frequency: 5, gps_capture_required: false });
    expect(update.filtros).toEqual([{ metodo: 'eq', columna: 'id', valor: 'plant-1' }]);
  });

  test('columna inexistente (023 sin aplicar) lanza el mensaje de migración', async () => {
    capturarConsultas(() => ({
      error: { message: 'column "gps_capture_frequency" does not exist', code: PG_ERROR.UNDEFINED_COLUMN },
    }));
    await expect(
      actualizarConfigGps('plant-1', { frecuencia: 5, obligatoria: true }),
    ).rejects.toThrow(MENSAJE_GPS_SIN_MIGRACION);
  });

  test('otros errores propagan el mensaje original', async () => {
    capturarConsultas(() => ({ error: { message: 'sin permisos' } }));
    await expect(
      actualizarConfigGps('plant-1', { frecuencia: 5, obligatoria: true }),
    ).rejects.toThrow('sin permisos');
  });
});

describe('actualizarVisibilidad', () => {
  test('actualiza visible_in_app de la plantación', async () => {
    const consultas = capturarConsultas(() => ({ data: null }));
    await actualizarVisibilidad('plant-1', false);

    const [update] = consultas;
    expect(update.tabla).toBe('plantations');
    expect(update.operacion).toBe('update');
    expect(update.payload).toEqual({ visible_in_app: false });
    expect(update.filtros).toEqual([{ metodo: 'eq', columna: 'id', valor: 'plant-1' }]);
  });

  test('columna inexistente (024 sin aplicar) lanza el mensaje de migración', async () => {
    capturarConsultas(() => ({
      error: { message: 'column "visible_in_app" does not exist', code: PG_ERROR.UNDEFINED_COLUMN },
    }));
    await expect(actualizarVisibilidad('plant-1', false)).rejects.toThrow(
      MENSAJE_VISIBILIDAD_SIN_MIGRACION,
    );
  });
});

describe('existePlantacion', () => {
  test('compara lugar y período case-insensitive (ilike) y excluye el id en edición', async () => {
    const consultas = capturarConsultas(() => ({ count: 1 }));
    const existe = await existePlantacion(' Mendoza ', '2025-2026', 'plant-1');

    expect(existe).toBe(true);
    expect(consultas[0].filtros).toEqual([
      { metodo: 'ilike', columna: 'lugar', valor: 'Mendoza' },
      { metodo: 'ilike', columna: 'periodo', valor: '2025-2026' },
      { metodo: 'neq', columna: 'id', valor: 'plant-1' },
    ]);
  });

  test('sin coincidencias devuelve false y sin excluirId no agrega neq', async () => {
    const consultas = capturarConsultas(() => ({ count: 0 }));
    expect(await existePlantacion('Mendoza', '2025-2026')).toBe(false);
    expect(consultas[0].filtros.map((filtro) => filtro.metodo)).toEqual(['ilike', 'ilike']);
  });
});
