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

type CampoDePlantacion = keyof CamposDePlantacion;
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
