import { resetEstadoMock } from '../../test/supabaseMock';
import type { ConsultaCapturada, RespuestaMock } from '../../test/queryBuilderMock';
import { capturarConsultas } from '../../test/capturarConsultas';
import { PG_ERROR } from '../../lib/postgresErrorCodes';
import type { Perfil } from '../profileRepository';
import {
  actualizarConfigGps,
  actualizarFotoEnTodos,
  actualizarVisibilidad,
  archivarPlantacion,
  reabrirPlantacion,
  crearPlantacion,
  desarchivarPlantacion,
  editarPlantacion,
  existePlantacion,
  plantacionTrasConflicto,
  type PlantacionInput,
} from '../plantationRepository';
import { ConflictoDeEdicionError, MENSAJE_CONFLICTO_EDICION } from '../edicionDePlantacion';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

const PERFIL: Perfil = {
  id: 'user-1',
  nombre: 'Ana',
  rol: 'admin',
  activo: true,
  organizacionId: 'org-1',
};

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

  test('si falla la parcela default borra la plantación por RPC (rollback best-effort) y lanza', async () => {
    const consultas = capturarConsultas((consulta) => {
      if (consulta.tabla === 'parcelas') return { error: { message: 'falló la parcela' } };
      return responderOk(consulta);
    });

    await expect(crearPlantacion(INPUT_BASE, PERFIL)).rejects.toThrow('falló la parcela');
    // Un DELETE directo afecta 0 filas sin error: no hay policy DELETE (#480).
    expect(consultas.some((consulta) => consulta.operacion === 'delete')).toBe(false);
    const borrado = consultas.find((consulta) => consulta.operacion === 'rpc');
    expect(borrado).toEqual(
      expect.objectContaining({ tabla: 'eliminar_plantacion', payload: { p_id: 'plant-nuevo' } }),
    );
  });

  test('si el rollback también falla, se propaga el error original', async () => {
    capturarConsultas((consulta) => {
      if (consulta.tabla === 'parcelas') return { error: { message: 'falló la parcela' } };
      if (consulta.operacion === 'rpc') throw new Error('sin red');
      return responderOk(consulta);
    });

    await expect(crearPlantacion(INPUT_BASE, PERFIL)).rejects.toThrow('falló la parcela');
  });

  test('otros errores del insert no se reintentan y se propagan', async () => {
    const consultas = capturarConsultas(() => ({ error: { message: 'sin permisos' } }));
    await expect(crearPlantacion(INPUT_COMPLETO, PERFIL)).rejects.toThrow('sin permisos');
    expect(consultas).toHaveLength(1);
  });
});

const EDICION_OK: RespuestaMock = { data: { success: true } };

function rpcDeEdicion(consultas: ConsultaCapturada[]) {
  return consultas.filter((consulta) => consulta.tabla === 'editar_plantacion');
}

describe('editarPlantacion', () => {
  test('manda por la RPC solo los campos que cambiaron, con su base', async () => {
    const consultas = capturarConsultas(() => EDICION_OK);
    await editarPlantacion('plant-1', { ...INPUT_COMPLETO, objetivoArboles: 700 }, INPUT_COMPLETO);

    expect(consultas).toEqual([
      expect.objectContaining({
        tabla: 'editar_plantacion',
        operacion: 'rpc',
        payload: {
          p_id: 'plant-1',
          p_cambios: { objetivo_arboles: 700 },
          p_base: { objetivo_arboles: 500 },
        },
      }),
    ]);
  });

  test('vaciar un opcional lo manda como null', async () => {
    const consultas = capturarConsultas(() => EDICION_OK);
    await editarPlantacion('plant-1', INPUT_BASE, INPUT_COMPLETO);

    expect(consultas[0].payload).toMatchObject({
      p_cambios: { descripcion: null, fecha_inicio: null, objetivo_arboles: null },
    });
  });

  test('sin cambios no llama al server', async () => {
    const consultas = capturarConsultas(() => EDICION_OK);
    await editarPlantacion('plant-1', INPUT_COMPLETO, INPUT_COMPLETO);
    expect(consultas).toHaveLength(0);
  });

  test('un conflicto lanza ConflictoDeEdicionError con el valor del server', async () => {
    capturarConsultas(() => ({
      data: {
        success: false,
        error: 'CONFLICTO_EDICION',
        aplicados: [],
        conflictos: [{ campo: 'objetivo_arboles', valor_servidor: 650 }],
      },
    }));
    const promesa = editarPlantacion(
      'plant-1',
      { ...INPUT_COMPLETO, objetivoArboles: 700 },
      INPUT_COMPLETO,
    );

    await expect(promesa).rejects.toThrow(MENSAJE_CONFLICTO_EDICION);
    await promesa.catch((error: ConflictoDeEdicionError) => {
      expect(error.conflictos).toEqual([{ campo: 'objetivo_arboles', valorServidor: 650 }]);
    });
  });

  test.each([
    ['NOT_AUTHORIZED', /no tiene permisos/],
    ['PLANTACION_FINALIZADA', /finalizada/],
    ['PLANTACION_ARCHIVADA', /desarchivala/],
    ['PLANTACION_INEXISTENTE', /ya no existe/],
    ['OTRO', /No se pudo guardar/],
  ])('el rechazo %s dice qué pasó', async (codigo, mensaje) => {
    capturarConsultas(() => ({ data: { success: false, error: codigo } }));
    await expect(
      editarPlantacion('plant-1', { ...INPUT_COMPLETO, lugar: 'Otro' }, INPUT_COMPLETO),
    ).rejects.toThrow(mensaje);
  });

  test('un error de PostgREST conserva su mensaje', async () => {
    capturarConsultas(() => ({ error: { message: 'sin permisos' } }));
    await expect(
      editarPlantacion('plant-1', { ...INPUT_COMPLETO, lugar: 'Otro' }, INPUT_COMPLETO),
    ).rejects.toThrow('sin permisos');
  });
});

describe('plantacionTrasConflicto', () => {
  test('toma el valor del server donde chocó y lo enviado donde no', () => {
    const conflicto = new ConflictoDeEdicionError([
      { campo: 'objetivo_arboles', valorServidor: 650 },
      { campo: 'descripcion', valorServidor: null },
    ]);
    expect(plantacionTrasConflicto(INPUT_COMPLETO, conflicto)).toEqual({
      ...INPUT_COMPLETO,
      objetivoArboles: 650,
      descripcion: undefined,
    });
  });
});

describe('actualizarFotoEnTodos', () => {
  test('manda el valor nuevo con el opuesto como base', async () => {
    const consultas = capturarConsultas(() => EDICION_OK);
    await actualizarFotoEnTodos('plant-1', true);

    expect(rpcDeEdicion(consultas)[0].payload).toEqual({
      p_id: 'plant-1',
      p_cambios: { photo_capture_all_trees: true },
      p_base: { photo_capture_all_trees: false },
    });
  });
});

describe('actualizarConfigGps', () => {
  test('manda frecuencia y obligatoriedad que cambiaron, con la config anterior como base', async () => {
    const consultas = capturarConsultas(() => EDICION_OK);
    await actualizarConfigGps(
      'plant-1',
      { frecuencia: 5, obligatoria: false },
      { frecuencia: 10, obligatoria: false },
    );

    expect(rpcDeEdicion(consultas)[0].payload).toEqual({
      p_id: 'plant-1',
      p_cambios: { gps_capture_frequency: 5 },
      p_base: { gps_capture_frequency: 10 },
    });
  });
});

describe('actualizarVisibilidad', () => {
  test('manda el valor nuevo con el opuesto como base', async () => {
    const consultas = capturarConsultas(() => EDICION_OK);
    await actualizarVisibilidad('plant-1', false);

    expect(rpcDeEdicion(consultas)[0].payload).toEqual({
      p_id: 'plant-1',
      p_cambios: { visible_in_app: false },
      p_base: { visible_in_app: true },
    });
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

describe('reabrirPlantacion', () => {
  test('llama al RPC con el id', async () => {
    const consultas = capturarConsultas(() => ({ data: { success: true } }));
    await reabrirPlantacion('plant-1');
    expect(consultas).toEqual([
      expect.objectContaining({
        tabla: 'reabrir_plantacion',
        operacion: 'rpc',
        payload: { p_id: 'plant-1' },
      }),
    ]);
  });

  test('cada rechazo del RPC dice qué hacer', async () => {
    capturarConsultas(() => ({ data: { success: false, error: 'NOT_AUTHORIZED' } }));
    await expect(reabrirPlantacion('plant-1')).rejects.toThrow(/Solo un superadmin/);
    capturarConsultas(() => ({ data: { success: false, error: 'PLANTACION_ARCHIVADA' } }));
    await expect(reabrirPlantacion('plant-1')).rejects.toThrow(/desarchivala/);
  });

  test('un error de red o un código desconocido dan el mensaje genérico', async () => {
    capturarConsultas(() => ({ error: { message: 'fetch failed' } }));
    await expect(reabrirPlantacion('plant-1')).rejects.toThrow('No se pudo reabrir');
    capturarConsultas(() => ({ data: { success: false, error: 'OTRO' } }));
    await expect(reabrirPlantacion('plant-1')).rejects.toThrow('No se pudo reabrir');
  });
});

describe('archivar / desarchivar', () => {
  test.each([
    ['archivar_plantacion', archivarPlantacion],
    ['desarchivar_plantacion', desarchivarPlantacion],
  ])('%s: llama al RPC con el id', async (rpc, accion) => {
    const consultas = capturarConsultas(() => ({ data: { success: true } }));
    await accion('plant-1');
    expect(consultas).toEqual([
      expect.objectContaining({ tabla: rpc, operacion: 'rpc', payload: { p_id: 'plant-1' } }),
    ]);
  });

  test('NOT_AUTHORIZED se traduce a un mensaje de permisos', async () => {
    capturarConsultas(() => ({ data: { success: false, error: 'NOT_AUTHORIZED' } }));
    await expect(archivarPlantacion('plant-1')).rejects.toThrow(/no tiene permisos/);
  });

  test('un error de red o un código desconocido dan el mensaje genérico', async () => {
    capturarConsultas(() => ({ error: { message: 'fetch failed' } }));
    await expect(desarchivarPlantacion('plant-1')).rejects.toThrow(
      'No se pudo completar la acción',
    );
    capturarConsultas(() => ({ data: { success: false, error: 'OTRO' } }));
    await expect(archivarPlantacion('plant-1')).rejects.toThrow('No se pudo completar la acción');
  });
});
