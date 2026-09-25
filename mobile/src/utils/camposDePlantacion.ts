/**
 * Campos de la plantación que el admin edita desde mobile (#633): un solo lugar
 * para el mapeo local ↔ Supabase y para los snapshots *Server, así el alta, la
 * edición, el pull y el push no repiten la lista.
 */
import type { plantations } from '../database/schema';

export interface CamposDePlantacion {
  lugar: string;
  periodo: string;
  descripcion: string | null;
  /** YYYY-MM-DD. */
  fechaInicio: string | null;
  objetivoArboles: number | null;
  gpsCaptureFrequency: number;
  gpsCaptureRequired: boolean;
  photoCaptureAllTrees: boolean;
  visibleInApp: boolean;
}

/** Todo lo que el formulario define además de lugar y periodo. */
export type AjustesDePlantacion = Omit<CamposDePlantacion, 'lugar' | 'periodo'>;

export type CampoDePlantacion = keyof CamposDePlantacion;
type FilaDePlantacion = typeof plantations.$inferSelect;

const COLUMNA_REMOTA = {
  lugar: 'lugar',
  periodo: 'periodo',
  descripcion: 'descripcion',
  fechaInicio: 'fecha_inicio',
  objetivoArboles: 'objetivo_arboles',
  gpsCaptureFrequency: 'gps_capture_frequency',
  gpsCaptureRequired: 'gps_capture_required',
  photoCaptureAllTrees: 'photo_capture_all_trees',
  visibleInApp: 'visible_in_app',
} as const satisfies Record<CampoDePlantacion, string>;

const COLUMNA_SNAPSHOT = {
  lugar: 'lugarServer',
  periodo: 'periodoServer',
  descripcion: 'descripcionServer',
  fechaInicio: 'fechaInicioServer',
  objetivoArboles: 'objetivoArbolesServer',
  gpsCaptureFrequency: 'gpsCaptureFrequencyServer',
  gpsCaptureRequired: 'gpsCaptureRequiredServer',
  photoCaptureAllTrees: 'photoCaptureAllTreesServer',
  visibleInApp: 'visibleInAppServer',
} as const satisfies Record<CampoDePlantacion, keyof FilaDePlantacion>;

export type SnapshotDePlantacion = Pick<FilaDePlantacion, (typeof COLUMNA_SNAPSHOT)[CampoDePlantacion]>;

/** NOT NULL en las dos bases: un null acá es "sin dato", nunca un valor. */
const OBLIGATORIOS: ReadonlySet<CampoDePlantacion> = new Set<CampoDePlantacion>([
  'lugar',
  'periodo',
  'gpsCaptureFrequency',
  'gpsCaptureRequired',
  'photoCaptureAllTrees',
  'visibleInApp',
]);

const CAMPOS = Object.keys(COLUMNA_REMOTA) as CampoDePlantacion[];

function esValorDe(campo: CampoDePlantacion, valor: unknown): boolean {
  return valor !== undefined && !(valor === null && OBLIGATORIOS.has(campo));
}

/** Los campos de una fila local (vivos, no el snapshot). */
export function camposDeFila(fila: FilaDePlantacion): CamposDePlantacion {
  const campos: Record<string, unknown> = {};
  for (const campo of CAMPOS) campos[campo] = fila[campo];
  return campos as unknown as CamposDePlantacion;
}

/** Lo último que se sabe del server, leído de las columnas *Server. */
export function desdeSnapshot(fila: FilaDePlantacion): Partial<CamposDePlantacion> {
  const campos: Record<string, unknown> = {};
  for (const campo of CAMPOS) campos[campo] = fila[COLUMNA_SNAPSHOT[campo]];
  return campos as Partial<CamposDePlantacion>;
}

/**
 * Los campos de `nuevos` que difieren de `base`. No cuenta lo ausente en `nuevos` ni lo que
 * `base` no conoce (ausente, o null en un obligatorio: un snapshot anterior a ese campo).
 */
export function camposCambiados(
  base: Partial<CamposDePlantacion>,
  nuevos: Partial<CamposDePlantacion>,
): Partial<CamposDePlantacion> {
  const cambiados: Record<string, unknown> = {};
  for (const campo of CAMPOS) {
    const valor = nuevos[campo];
    if (valor !== undefined && esValorDe(campo, base[campo]) && valor !== base[campo]) cambiados[campo] = valor;
  }
  return cambiados as Partial<CamposDePlantacion>;
}

/**
 * Lo que el server tenía cuando se editó (#634). Con edición offline pendiente, la base
 * guardada al entrar en edición (el pull refresca el snapshot, no la base; una fila editada
 * antes de 0025 cae al snapshot); si no, el valor vivo, que es el del último pull.
 */
export function baseDeLaEdicion(fila: FilaDePlantacion): Partial<CamposDePlantacion> {
  if (!fila.pendingEdit) return camposDeFila(fila);
  return fila.baseDeEdicion ?? desdeSnapshot(fila);
}

/** La base al entrar en edición offline: el snapshot del pull si lo hay, si no el valor vivo. */
export function baseAntesDeEditar(fila: FilaDePlantacion): Partial<CamposDePlantacion> {
  return desdeSnapshot({ ...fila, ...snapshotAntesDeEditar(fila) });
}

/**
 * Lo que hay que subir para que el server refleje la fila con `edicion` aplicada: solo lo
 * que cambió respecto de la base. Así una fila que nunca bajó un campo (null en vivo y en
 * la base) no borra el del server.
 */
export function cambiosParaElServer(
  fila: FilaDePlantacion,
  edicion: Partial<CamposDePlantacion> = {},
): Partial<CamposDePlantacion> {
  return camposCambiados(baseDeLaEdicion(fila), { ...camposDeFila(fila), ...edicion });
}

/** La base de cada campo de `cambios`. */
export function baseDe(
  cambios: Partial<CamposDePlantacion>,
  base: Partial<CamposDePlantacion>,
): Partial<CamposDePlantacion> {
  const deLosCambios: Record<string, unknown> = {};
  for (const campo of CAMPOS) {
    if (cambios[campo] !== undefined) deLosCambios[campo] = base[campo];
  }
  return deLosCambios as Partial<CamposDePlantacion>;
}

function sinLosDe(
  campos: Partial<CamposDePlantacion>,
  excluir: Partial<CamposDePlantacion>,
): Partial<CamposDePlantacion> {
  return Object.fromEntries(
    Object.entries(campos).filter(([campo]) => excluir[campo as CampoDePlantacion] === undefined),
  ) as Partial<CamposDePlantacion>;
}

export type EdicionDelFormulario = {
  /** Lo que el usuario cambió en el formulario: lo único que se escribe en la fila. */
  tocados: Partial<CamposDePlantacion>;
  /** Lo que hay que subir: lo tocado más lo editado offline antes y todavía sin subir. */
  cambios: Partial<CamposDePlantacion>;
  /** La base de cada campo de `cambios`. */
  base: Partial<CamposDePlantacion>;
  /** La base completa a guardar si la edición queda offline. */
  baseDeEdicion: Partial<CamposDePlantacion>;
};

/**
 * Una edición del formulario sobre la fila (#634). `vistos` son los valores con que se
 * abrió: solo cuenta lo que el usuario tocó, y su base es lo que vio (si un pull cambió un
 * campo con el form abierto, no se lo pisa sin avisar). Lo editado offline antes sube con
 * la base de entonces.
 */
export function edicionDelFormulario(
  fila: FilaDePlantacion,
  edicion: Partial<CamposDePlantacion>,
  vistos: Partial<CamposDePlantacion> = camposDeFila(fila),
): EdicionDelFormulario {
  const tocados = camposCambiados(vistos, edicion);
  const pendientes = fila.pendingEdit ? cambiosParaElServer(fila) : {};
  const baseAnterior = fila.pendingEdit ? baseDeLaEdicion(fila) : baseAntesDeEditar(fila);
  const baseDeEdicion = { ...baseAnterior, ...baseDe(sinLosDe(tocados, pendientes), vistos) };
  const cambios = { ...pendientes, ...tocados };
  return { tocados, cambios, base: baseDe(cambios, baseDeEdicion), baseDeEdicion };
}

/** El campo local de una columna de Supabase, o undefined si no es editable. */
export function campoDeColumnaRemota(columna: string): CampoDePlantacion | undefined {
  return CAMPOS.find((campo) => COLUMNA_REMOTA[campo] === columna);
}

export function hayCambios(campos: Partial<CamposDePlantacion>): boolean {
  return Object.keys(campos).length > 0;
}

/**
 * Pull con edición pendiente: de lo que trae el server, los valores vivos a actualizar. Solo
 * los campos que el usuario no tocó (vivo igual al snapshot anterior, null incluido); si no,
 * el push vería el valor viejo como una edición y lo pisaría en el server. Lo borrado a
 * propósito (snapshot con valor, vivo null) no se toca.
 */
export function remotosNoEditados(
  fila: FilaDePlantacion,
  remotos: Partial<CamposDePlantacion>,
): Partial<CamposDePlantacion> {
  const noEditados: Record<string, unknown> = {};
  for (const campo of CAMPOS) {
    if (remotos[campo] !== undefined && fila[campo] === fila[COLUMNA_SNAPSHOT[campo]]) noEditados[campo] = remotos[campo];
  }
  return noEditados as Partial<CamposDePlantacion>;
}

/**
 * Pull con edición pendiente: los campos no editados toman el valor del server y su base
 * también (#634); si no, el push los vería distintos de la base y los mandaría.
 */
export function rebaseDeEdicionPendiente(
  fila: FilaDePlantacion,
  remotos: Partial<CamposDePlantacion>,
): Partial<CamposDePlantacion> & Pick<Partial<FilaDePlantacion>, 'baseDeEdicion'> {
  const noEditados = remotosNoEditados(fila, remotos);
  if (!fila.baseDeEdicion) return noEditados;
  return { ...noEditados, baseDeEdicion: { ...fila.baseDeEdicion, ...noEditados } };
}

/** Payload para Supabase: solo los campos presentes. */
export function aColumnasRemotas(campos: Partial<CamposDePlantacion>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const campo of CAMPOS) {
    if (campos[campo] !== undefined) payload[COLUMNA_REMOTA[campo]] = campos[campo];
  }
  return payload;
}

/**
 * Campos de una fila de Supabase. Se omite lo ausente (server sin la columna) y el
 * null de una columna obligatoria, para no pisar el valor local con basura.
 */
export function desdeFilaRemota(remota: Record<string, unknown>): Partial<CamposDePlantacion> {
  const campos: Record<string, unknown> = {};
  for (const campo of CAMPOS) {
    const valor = remota[COLUMNA_REMOTA[campo]];
    if (esValorDe(campo, valor)) campos[campo] = valor;
  }
  return campos as Partial<CamposDePlantacion>;
}

/** Los mismos valores, en las columnas *Server: lo último que se sabe del server. */
export function aSnapshot(campos: Partial<CamposDePlantacion>): Partial<SnapshotDePlantacion> {
  const snapshot: Record<string, unknown> = {};
  for (const campo of CAMPOS) {
    if (campos[campo] !== undefined) snapshot[COLUMNA_SNAPSHOT[campo]] = campos[campo];
  }
  return snapshot as Partial<SnapshotDePlantacion>;
}

/**
 * Snapshot al entrar en edición offline: el del pull si lo hay, si no el valor vivo,
 * que sin edición pendiente es el del server.
 */
export function snapshotAntesDeEditar(fila: FilaDePlantacion): SnapshotDePlantacion {
  const snapshot: Record<string, unknown> = {};
  for (const campo of CAMPOS) {
    const columna = COLUMNA_SNAPSHOT[campo];
    snapshot[columna] = fila[columna] ?? fila[campo];
  }
  return snapshot as unknown as SnapshotDePlantacion;
}

/** Valores a restaurar al descartar una edición; un obligatorio sin snapshot queda como está. */
export function restaurarDesdeSnapshot(fila: FilaDePlantacion): Partial<CamposDePlantacion> {
  const campos: Record<string, unknown> = {};
  for (const campo of CAMPOS) {
    const valor = fila[COLUMNA_SNAPSHOT[campo]];
    if (esValorDe(campo, valor)) campos[campo] = valor;
  }
  return campos as Partial<CamposDePlantacion>;
}
