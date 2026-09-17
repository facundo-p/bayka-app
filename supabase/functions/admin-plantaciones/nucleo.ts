/** Lógica de admin-plantaciones con deps inyectadas (index.ts pasa clientes reales, los tests mocks); sin imports, testeable fuera de Deno. */

export const ACCION = {
  eliminar: 'eliminar',
  limpiarFotos: 'limpiarFotos',
} as const;

/** Códigos de `eliminar_plantacion` en `{ success: false, error }`. */
export const ERROR_ELIMINACION = {
  noAutorizado: 'NOT_AUTHORIZED',
  requiereSuperadmin: 'REQUIERE_SUPERADMIN',
  requiereArchivar: 'REQUIERE_ARCHIVAR',
  nombreNoCoincide: 'NOMBRE_NO_COINCIDE',
} as const;

const ROL_SUPERADMIN = 'superadmin';

/** `remove` de Storage acepta muchas rutas, pero en tandas chicas un fallo afecta a pocas. */
export const TAMANO_TANDA_FOTOS = 100;

/** Las fotos viven en `plantations/{id}/parcelas/{parcela}/trees/{arbol}.jpg`. */
export function prefijoFotos(plantacionId: string): string {
  return `plantations/${plantacionId}`;
}

/** Contrato con la web: se muestran tal cual. */
export const MENSAJES = {
  noAutorizado: 'Tu usuario no tiene permisos para eliminar esta plantación.',
  requiereSuperadmin: 'La plantación tiene datos cargados: solo un superadmin puede eliminarla.',
  requiereArchivar: 'La plantación tiene datos cargados: archivala antes de eliminarla.',
  nombreNoCoincide: 'El nombre escrito no coincide con el de la plantación.',
  soloSuperadmin: 'Necesitás permisos de superadmin para limpiar fotos.',
  solicitudInvalida: 'Solicitud inválida',
  errorGenerico: 'No se pudo completar la operación. Probá de nuevo.',
} as const;

const RECHAZOS_ELIMINACION: Record<string, { status: number; mensaje: string }> = {
  [ERROR_ELIMINACION.noAutorizado]: { status: 403, mensaje: MENSAJES.noAutorizado },
  [ERROR_ELIMINACION.requiereSuperadmin]: { status: 409, mensaje: MENSAJES.requiereSuperadmin },
  [ERROR_ELIMINACION.requiereArchivar]: { status: 409, mensaje: MENSAJES.requiereArchivar },
  [ERROR_ELIMINACION.nombreNoCoincide]: { status: 409, mensaje: MENSAJES.nombreNoCoincide },
};

/** Evita que un id mal formado arme un prefijo que abarque fotos de otras plantaciones. */
const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PerfilDb = { id: string; rol: string; activo: boolean; organizacionId: string | null };

export type ResultadoEliminacion = {
  success: boolean;
  error?: string;
  resumen?: Record<string, unknown>;
};

export type EntradaStorage = { nombre: string; esCarpeta: boolean };

export type Deps = {
  perfilDelToken: (jwt: string) => Promise<PerfilDb | null>;
  /** RPC `eliminar_plantacion` con el JWT del caller: la autorización vive en SQL. Lanza ante error de transporte. */
  eliminarPlantacion: (
    jwt: string,
    plantacionId: string,
    nombreConfirmacion: string | null,
  ) => Promise<ResultadoEliminacion>;
  /** Entradas directas de una carpeta de `tree-photos` (no recursivo). Lanza ante error. */
  listarCarpeta: (ruta: string) => Promise<EntradaStorage[]>;
  borrarArchivos: (rutas: string[]) => Promise<void>;
  marcarFotosLimpias: (plantacionId: string) => Promise<void>;
  /** Ids de `plantaciones_eliminadas` de la organización con `fotos_limpias = false`. */
  fotosPendientes: (organizacionId: string, plantacionId?: string) => Promise<string[]>;
};

export type CuerpoAdminPlantaciones =
  | { accion: typeof ACCION.eliminar; plantacionId: string; nombreConfirmacion?: string }
  | { accion: typeof ACCION.limpiarFotos; plantacionId?: string };

export type CuerpoRespuesta = {
  ok: boolean;
  error?: string;
  resumen?: Record<string, unknown>;
  /** La plantación se borró pero quedaron fotos en Storage; `limpiarFotos` reintenta. */
  fotosPendientes?: boolean;
  limpiadas?: number;
  pendientes?: number;
};

export type Respuesta = { status: number; body: CuerpoRespuesta };

const fallo = (status: number, error: string): Respuesta => ({ status, body: { ok: false, error } });

function idValido(id: unknown): id is string {
  return typeof id === 'string' && PATRON_UUID.test(id);
}

async function listarArchivos(ruta: string, deps: Deps): Promise<string[]> {
  const entradas = await deps.listarCarpeta(ruta);
  const porEntrada = await Promise.all(
    entradas.map((entrada) => {
      const hija = `${ruta}/${entrada.nombre}`;
      return entrada.esCarpeta ? listarArchivos(hija, deps) : Promise.resolve([hija]);
    }),
  );
  return porEntrada.flat();
}

/** true si no quedó ninguna foto. Nunca lanza: los datos ya se borraron. */
async function limpiarFotosDe(plantacionId: string, deps: Deps): Promise<boolean> {
  try {
    const rutas = await listarArchivos(prefijoFotos(plantacionId), deps);
    for (let desde = 0; desde < rutas.length; desde += TAMANO_TANDA_FOTOS) {
      await deps.borrarArchivos(rutas.slice(desde, desde + TAMANO_TANDA_FOTOS));
    }
    await deps.marcarFotosLimpias(plantacionId);
    return true;
  } catch {
    return false;
  }
}

async function eliminar(
  jwt: string,
  plantacionId: string,
  nombreConfirmacion: string | null,
  deps: Deps,
): Promise<Respuesta> {
  const resultado = await deps.eliminarPlantacion(jwt, plantacionId, nombreConfirmacion);
  if (!resultado.success) {
    const rechazo = RECHAZOS_ELIMINACION[resultado.error ?? ''];
    return rechazo ? fallo(rechazo.status, rechazo.mensaje) : fallo(500, MENSAJES.errorGenerico);
  }
  const limpias = await limpiarFotosDe(plantacionId, deps);
  return {
    status: 200,
    body: { ok: true, resumen: resultado.resumen, fotosPendientes: !limpias },
  };
}

async function limpiarFotos(jwt: string, plantacionId: string | undefined, deps: Deps) {
  const caller = await deps.perfilDelToken(jwt);
  if (!caller?.activo || caller.rol !== ROL_SUPERADMIN || !caller.organizacionId) {
    return fallo(403, MENSAJES.soloSuperadmin);
  }
  const ids = await deps.fotosPendientes(caller.organizacionId, plantacionId);
  let limpiadas = 0;
  for (const id of ids) {
    if (await limpiarFotosDe(id, deps)) limpiadas += 1;
  }
  return { status: 200, body: { ok: true, limpiadas, pendientes: ids.length - limpiadas } };
}

function nombreDe(cuerpo: { nombreConfirmacion?: unknown }): string | null {
  return typeof cuerpo.nombreConfirmacion === 'string' ? cuerpo.nombreConfirmacion : null;
}

export async function manejarAdminPlantaciones(
  jwt: string | null,
  cuerpo: unknown,
  deps: Deps,
): Promise<Respuesta> {
  if (!jwt) return fallo(403, MENSAJES.noAutorizado);
  if (typeof cuerpo !== 'object' || cuerpo === null || !('accion' in cuerpo)) {
    return fallo(400, MENSAJES.solicitudInvalida);
  }
  const pedido = cuerpo as CuerpoAdminPlantaciones;
  if (pedido.accion === ACCION.eliminar && idValido(pedido.plantacionId)) {
    return eliminar(jwt, pedido.plantacionId, nombreDe(pedido), deps);
  }
  const idOpcionalValido = pedido.plantacionId === undefined || idValido(pedido.plantacionId);
  if (pedido.accion === ACCION.limpiarFotos && idOpcionalValido) {
    return limpiarFotos(jwt, pedido.plantacionId, deps);
  }
  return fallo(400, MENSAJES.solicitudInvalida);
}
