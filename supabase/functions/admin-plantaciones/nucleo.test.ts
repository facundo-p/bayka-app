import { describe, expect, test, vi } from 'vitest';
import {
  LIMITE_FOTOS_QUITADAS,
  MENSAJES,
  TAMANO_TANDA_FOTOS,
  manejarAdminPlantaciones,
  secretosIguales,
  type Deps,
  type EntradaStorage,
  type PerfilDb,
} from './nucleo';

const ID = '11111111-2222-3333-4444-555555555555';
const OTRO_ID = '66666666-7777-8888-9999-000000000000';
const ORG = 'org-1';

const SUPERADMIN: PerfilDb = { id: 's1', rol: 'superadmin', activo: true, organizacionId: ORG };
const ADMIN: PerfilDb = { id: 'a1', rol: 'admin', activo: true, organizacionId: ORG };

const RESUMEN = { grupos: 1, arboles: 2 };
const SERVICE_KEY = 'service-role-key';

/** Árbol de carpetas de Storage: ruta → entradas directas. */
function storage(arbol: Record<string, EntradaStorage[]>) {
  return vi.fn(async (ruta: string) => arbol[ruta] ?? []);
}

const archivo = (nombre: string): EntradaStorage => ({ nombre, esCarpeta: false });
const carpeta = (nombre: string): EntradaStorage => ({ nombre, esCarpeta: true });

/** Deps felices por defecto; cada test pisa lo que necesita. */
function crearDeps(caller: PerfilDb | null = SUPERADMIN): Deps {
  return {
    perfilDelToken: vi.fn(async () => caller),
    eliminarPlantacion: vi.fn(async () => ({ success: true, resumen: RESUMEN })),
    listarCarpeta: storage({
      [`plantations/${ID}`]: [carpeta('parcelas')],
      [`plantations/${ID}/parcelas`]: [carpeta('p1')],
      [`plantations/${ID}/parcelas/p1`]: [carpeta('trees')],
      [`plantations/${ID}/parcelas/p1/trees`]: [archivo('t1.jpg'), archivo('t2.jpg')],
    }),
    borrarArchivos: vi.fn(async () => undefined),
    marcarFotosLimpias: vi.fn(async () => undefined),
    fotosPendientes: vi.fn(async () => [ID]),
    esServiceRole: vi.fn((jwt: string) => jwt === SERVICE_KEY),
    fotosQuitadasPorLimpiar: vi.fn(async () => [
      { id: 1, ruta: 'plantations/p/parcelas/q/trees/t1.jpg' },
      { id: 2, ruta: 'plantations/p/parcelas/q/trees/t2.jpg' },
    ]),
    marcarFotosQuitadasBorradas: vi.fn(async () => undefined),
  };
}

const ELIMINAR = { accion: 'eliminar', plantacionId: ID, nombreConfirmacion: 'Lugar' } as const;

describe('solicitud', () => {
  test('sin token → 403 y no llama al RPC', async () => {
    const deps = crearDeps();
    const respuesta = await manejarAdminPlantaciones(null, ELIMINAR, deps);
    expect(respuesta.status).toBe(403);
    expect(deps.eliminarPlantacion).not.toHaveBeenCalled();
  });

  test.each([
    ['sin accion', { plantacionId: ID }],
    ['accion desconocida', { accion: 'borrarTodo', plantacionId: ID }],
    ['eliminar sin id', { accion: 'eliminar' }],
    ['id que no es uuid (prefijo abierto)', { accion: 'eliminar', plantacionId: '' }],
    ['limpiarFotos con id inválido', { accion: 'limpiarFotos', plantacionId: '../x' }],
  ])('%s → 400', async (_caso, cuerpo) => {
    const deps = crearDeps();
    const respuesta = await manejarAdminPlantaciones('jwt', cuerpo, deps);
    expect(respuesta).toEqual({ status: 400, body: { ok: false, error: MENSAJES.solicitudInvalida } });
    expect(deps.listarCarpeta).not.toHaveBeenCalled();
  });
});

describe('eliminar', () => {
  test('feliz: RPC con el JWT del caller, borra fotos recursivamente y marca limpias', async () => {
    const deps = crearDeps();
    const respuesta = await manejarAdminPlantaciones('jwt', ELIMINAR, deps);
    expect(respuesta).toEqual({
      status: 200,
      body: { ok: true, resumen: RESUMEN, fotosPendientes: false },
    });
    expect(deps.eliminarPlantacion).toHaveBeenCalledWith('jwt', ID, 'Lugar');
    expect(deps.borrarArchivos).toHaveBeenCalledWith([
      `plantations/${ID}/parcelas/p1/trees/t1.jpg`,
      `plantations/${ID}/parcelas/p1/trees/t2.jpg`,
    ]);
    expect(deps.marcarFotosLimpias).toHaveBeenCalledWith(ID);
  });

  test('sin nombre de confirmación pasa null (plantación sin datos)', async () => {
    const deps = crearDeps(ADMIN);
    await manejarAdminPlantaciones('jwt', { accion: 'eliminar', plantacionId: ID }, deps);
    expect(deps.eliminarPlantacion).toHaveBeenCalledWith('jwt', ID, null);
  });

  test('borra en tandas', async () => {
    const deps = crearDeps();
    const cantidad = TAMANO_TANDA_FOTOS * 2 + 5;
    const nombres = Array.from({ length: cantidad }, (_, i) => archivo(`t${i}.jpg`));
    deps.listarCarpeta = storage({ [`plantations/${ID}`]: nombres });
    await manejarAdminPlantaciones('jwt', ELIMINAR, deps);
    const tandas = vi.mocked(deps.borrarArchivos).mock.calls.map(([rutas]) => rutas.length);
    expect(tandas).toEqual([TAMANO_TANDA_FOTOS, TAMANO_TANDA_FOTOS, 5]);
  });

  test('sin fotos: no borra nada y marca limpias', async () => {
    const deps = crearDeps();
    deps.listarCarpeta = storage({});
    const respuesta = await manejarAdminPlantaciones('jwt', ELIMINAR, deps);
    expect(respuesta.body.fotosPendientes).toBe(false);
    expect(deps.borrarArchivos).not.toHaveBeenCalled();
    expect(deps.marcarFotosLimpias).toHaveBeenCalledWith(ID);
  });

  test.each([
    ['NOT_AUTHORIZED', 403, MENSAJES.noAutorizado],
    ['REQUIERE_SUPERADMIN', 409, MENSAJES.requiereSuperadmin],
    ['REQUIERE_ARCHIVAR', 409, MENSAJES.requiereArchivar],
    ['NOMBRE_NO_COINCIDE', 409, MENSAJES.nombreNoCoincide],
    ['OTRO', 500, MENSAJES.errorGenerico],
  ])('RPC rechaza con %s → %i y no toca Storage', async (codigo, status, mensaje) => {
    const deps = crearDeps();
    deps.eliminarPlantacion = vi.fn(async () => ({ success: false, error: codigo }));
    const respuesta = await manejarAdminPlantaciones('jwt', ELIMINAR, deps);
    expect(respuesta).toEqual({ status, body: { ok: false, error: mensaje } });
    expect(deps.listarCarpeta).not.toHaveBeenCalled();
  });

  test('falla Storage: éxito con fotosPendientes y sin marcar limpias', async () => {
    const deps = crearDeps();
    deps.borrarArchivos = vi.fn(async () => {
      throw new Error('storage caído');
    });
    const respuesta = await manejarAdminPlantaciones('jwt', ELIMINAR, deps);
    expect(respuesta).toEqual({
      status: 200,
      body: { ok: true, resumen: RESUMEN, fotosPendientes: true },
    });
    expect(deps.marcarFotosLimpias).not.toHaveBeenCalled();
  });

  test('falla el listado: también éxito con fotosPendientes', async () => {
    const deps = crearDeps();
    deps.listarCarpeta = vi.fn(async () => {
      throw new Error('storage caído');
    });
    const respuesta = await manejarAdminPlantaciones('jwt', ELIMINAR, deps);
    expect(respuesta.body).toMatchObject({ ok: true, fotosPendientes: true });
  });
});

describe('limpiarFotos', () => {
  test.each([
    ['admin', ADMIN],
    ['superadmin inactivo', { ...SUPERADMIN, activo: false }],
    ['token inválido', null],
  ])('%s → 403', async (_caso, caller) => {
    const deps = crearDeps(caller);
    const respuesta = await manejarAdminPlantaciones('jwt', { accion: 'limpiarFotos' }, deps);
    expect(respuesta).toEqual({ status: 403, body: { ok: false, error: MENSAJES.soloSuperadmin } });
    expect(deps.fotosPendientes).not.toHaveBeenCalled();
  });

  test('reintenta las pendientes de su organización y cuenta el resultado', async () => {
    const deps = crearDeps();
    deps.fotosPendientes = vi.fn(async () => [ID, OTRO_ID]);
    deps.listarCarpeta = vi.fn(async (ruta: string) => {
      if (ruta.includes(OTRO_ID)) throw new Error('storage caído');
      return [];
    });
    const respuesta = await manejarAdminPlantaciones('jwt', { accion: 'limpiarFotos' }, deps);
    expect(respuesta).toEqual({ status: 200, body: { ok: true, limpiadas: 1, pendientes: 1 } });
    expect(deps.fotosPendientes).toHaveBeenCalledWith(ORG, undefined);
    expect(deps.marcarFotosLimpias).toHaveBeenCalledTimes(1);
    expect(deps.marcarFotosLimpias).toHaveBeenCalledWith(ID);
  });

  test('con plantacionId filtra por ese id', async () => {
    const deps = crearDeps();
    await manejarAdminPlantaciones('jwt', { accion: 'limpiarFotos', plantacionId: ID }, deps);
    expect(deps.fotosPendientes).toHaveBeenCalledWith(ORG, ID);
  });

  test('no llama al RPC de eliminar', async () => {
    const deps = crearDeps();
    await manejarAdminPlantaciones('jwt', { accion: 'limpiarFotos' }, deps);
    expect(deps.eliminarPlantacion).not.toHaveBeenCalled();
  });
});

describe('limpiarFotosQuitadas', () => {
  const PEDIDO = { accion: 'limpiarFotosQuitadas' } as const;

  test('con un JWT de usuario (aunque sea superadmin) → 403 y no toca Storage', async () => {
    const deps = crearDeps();
    const respuesta = await manejarAdminPlantaciones('jwt', PEDIDO, deps);
    expect(respuesta).toEqual({ status: 403, body: { ok: false, error: MENSAJES.soloServiceRole } });
    expect(deps.fotosQuitadasPorLimpiar).not.toHaveBeenCalled();
    expect(deps.borrarArchivos).not.toHaveBeenCalled();
  });

  test('borra solo los paths registrados y los marca', async () => {
    const deps = crearDeps();
    const respuesta = await manejarAdminPlantaciones(SERVICE_KEY, PEDIDO, deps);
    expect(respuesta).toEqual({ status: 200, body: { ok: true, limpiadas: 2, pendientes: 0 } });
    expect(deps.fotosQuitadasPorLimpiar).toHaveBeenCalledWith(LIMITE_FOTOS_QUITADAS);
    expect(deps.borrarArchivos).toHaveBeenCalledWith([
      'plantations/p/parcelas/q/trees/t1.jpg',
      'plantations/p/parcelas/q/trees/t2.jpg',
    ]);
    expect(deps.marcarFotosQuitadasBorradas).toHaveBeenCalledWith([1, 2]);
    expect(deps.listarCarpeta).not.toHaveBeenCalled();
  });

  test('sin pendientes no llama a Storage', async () => {
    const deps = crearDeps();
    deps.fotosQuitadasPorLimpiar = vi.fn(async () => []);
    const respuesta = await manejarAdminPlantaciones(SERVICE_KEY, PEDIDO, deps);
    expect(respuesta.body).toEqual({ ok: true, limpiadas: 0, pendientes: 0 });
    expect(deps.borrarArchivos).not.toHaveBeenCalled();
  });

  test('una tanda que falla en Storage no se marca y no corta las demás', async () => {
    const deps = crearDeps();
    const cantidad = TAMANO_TANDA_FOTOS + 3;
    deps.fotosQuitadasPorLimpiar = vi.fn(async () =>
      Array.from({ length: cantidad }, (_, i) => ({ id: i, ruta: `r${i}.jpg` })),
    );
    deps.borrarArchivos = vi.fn(async (rutas: string[]) => {
      if (rutas.length === TAMANO_TANDA_FOTOS) throw new Error('storage caído');
    });
    const respuesta = await manejarAdminPlantaciones(SERVICE_KEY, PEDIDO, deps);
    expect(respuesta.body).toEqual({ ok: true, limpiadas: 3, pendientes: TAMANO_TANDA_FOTOS });
    expect(deps.marcarFotosQuitadasBorradas).toHaveBeenCalledTimes(1);
    expect(deps.marcarFotosQuitadasBorradas).toHaveBeenCalledWith([
      TAMANO_TANDA_FOTOS,
      TAMANO_TANDA_FOTOS + 1,
      TAMANO_TANDA_FOTOS + 2,
    ]);
  });
});

describe('secretosIguales', () => {
  test('acepta el mismo secreto', () => {
    expect(secretosIguales(SERVICE_KEY, SERVICE_KEY)).toBe(true);
  });

  test.each([
    ['otro valor del mismo largo', 'service-role-kez'],
    ['un prefijo', 'service-role'],
    ['un secreto más largo', `${SERVICE_KEY}x`],
    ['vacío', ''],
  ])('rechaza %s', (_caso, recibido) => {
    expect(secretosIguales(recibido, SERVICE_KEY)).toBe(false);
  });

  test('sin secreto configurado no acepta nada, ni siquiera un token vacío', () => {
    expect(secretosIguales('', '')).toBe(false);
  });
});
