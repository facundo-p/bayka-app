import { MENSAJES } from '../../../../supabase/functions/admin-plantaciones/nucleo';
import { estadoMock, resetEstadoMock } from '../../test/supabaseMock';
import {
  MENSAJE_ADMIN_PLANTACIONES_GENERICO,
  eliminarPlantacion,
  limpiarFotosPendientes,
} from '../adminPlantacionesService';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(resetEstadoMock);

test('invoca admin-plantaciones con el payload del contrato', async () => {
  estadoMock.respuestaInvoke = { data: { ok: true, fotosPendientes: false }, error: null };
  const resultado = await eliminarPlantacion('plant-1', 'Mendoza');
  expect(estadoMock.invocaciones).toEqual([
    {
      funcion: 'admin-plantaciones',
      cuerpo: { accion: 'eliminar', plantacionId: 'plant-1', nombreConfirmacion: 'Mendoza' },
    },
  ]);
  expect(resultado).toEqual({ fotosPendientes: false });
});

test('informa las fotos pendientes', async () => {
  estadoMock.respuestaInvoke = { data: { ok: true, fotosPendientes: true }, error: null };
  expect(await eliminarPlantacion('plant-1')).toEqual({ fotosPendientes: true });
});

test('un rechazo HTTP usa el mensaje del server', async () => {
  estadoMock.respuestaInvoke = {
    data: null,
    error: { context: { json: async () => ({ ok: false, error: MENSAJES.nombreNoCoincide }) } },
  };
  await expect(eliminarPlantacion('plant-1', 'Otro')).rejects.toThrow(MENSAJES.nombreNoCoincide);
});

test('una falla de red usa el mensaje genérico', async () => {
  estadoMock.respuestaInvoke = { data: null, error: { message: 'fetch failed' } };
  await expect(eliminarPlantacion('plant-1')).rejects.toThrow(MENSAJE_ADMIN_PLANTACIONES_GENERICO);
});

describe('limpiarFotosPendientes (#523)', () => {
  test('invoca limpiarFotos para la plantación y devuelve el conteo', async () => {
    estadoMock.respuestaInvoke = { data: { ok: true, limpiadas: 1, pendientes: 0 }, error: null };
    const resultado = await limpiarFotosPendientes('plant-1');
    expect(estadoMock.invocaciones).toEqual([
      {
        funcion: 'admin-plantaciones',
        cuerpo: { accion: 'limpiarFotos', plantacionId: 'plant-1' },
      },
    ]);
    expect(resultado).toEqual({ limpiadas: 1, pendientes: 0 });
  });

  test('sin conteos en la respuesta asume cero', async () => {
    estadoMock.respuestaInvoke = { data: { ok: true }, error: null };
    expect(await limpiarFotosPendientes('plant-1')).toEqual({ limpiadas: 0, pendientes: 0 });
  });

  test('un rechazo usa el mensaje del server', async () => {
    estadoMock.respuestaInvoke = {
      data: null,
      error: { context: { json: async () => ({ ok: false, error: MENSAJES.soloSuperadmin }) } },
    };
    await expect(limpiarFotosPendientes('plant-1')).rejects.toThrow(MENSAJES.soloSuperadmin);
  });
});
