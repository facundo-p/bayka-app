/**
 * Lógica pura del formulario de plantación (#633): valores tal como se cargan,
 * validación con las mismas reglas que la web y conversión a los campos que se
 * guardan.
 */
import { GPS_CAPTURE_FREQUENCY_DEFAULT, GPS_CAPTURE_REQUIRED_DEFAULT } from '../constants/gpsCapture';
import { PHOTO_CAPTURE_ALL_TREES_DEFAULT } from '../constants/photoCapture';
import { VISIBLE_IN_APP_DEFAULT } from '../constants/visibilidad';
import type { CamposDePlantacion } from './camposDePlantacion';
import { errorCodigoPlantacion, normalizarCodigoPlantacion } from './codigoDePlantacion';
import { recortarIso } from './fechaDeCalendario';

const LARGO_MINIMO = 2;

export type ValoresDelFormulario = {
  lugar: string;
  periodo: string;
  codigo: string;
  descripcion: string;
  /** YYYY-MM-DD, o '' sin fecha: la elige el calendario, no se tipea. */
  fechaInicio: string;
  objetivoArboles: string;
  gpsFrequency: string;
  gpsRequired: boolean;
  fotoEnTodos: boolean;
  visibleParaTecnicos: boolean;
};

export type PlantacionEditable = Partial<Omit<CamposDePlantacion, 'codigo'>> &
  Pick<CamposDePlantacion, 'lugar' | 'periodo'> & {
    /** Null en una plantación anterior al código que todavía no lo bajó. */
    codigo?: string | null;
    pendingSync?: boolean;
  };

/**
 * Subida antes de que existiera el código: lo trae el próximo pull, y un valor tipeado acá no
 * tendría base contra la cual subirse. Un alta sin subir, en cambio, sin código no sube.
 */
export function codigoLlegaConElPull(plantacion?: PlantacionEditable | null): boolean {
  return !!plantacion && !plantacion.codigo && !plantacion.pendingSync;
}

// ─── Validación ──────────────────────────────────────────────────────────────

/** Muy por encima de cualquier plantación real y lejos del tope de integer de Postgres (2147483647). */
export const OBJETIVO_MAXIMO = 10_000_000;

/** Sin toLocaleString: el Intl de Hermes no es confiable en todos los builds. */
export function conPuntosDeMiles(valor: number): string {
  return String(valor).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function esEnteroPositivo(texto: string, maximo = Number.MAX_SAFE_INTEGER): boolean {
  const valor = Number(texto.trim());
  return texto.trim() !== '' && Number.isInteger(valor) && valor >= 1 && valor <= maximo;
}

/** Frecuencia de captura GPS: entero ≥ 1. */
export function validateGpsFrequency(raw: string): string | null {
  return esEnteroPositivo(raw) ? null : 'La frecuencia debe ser un número entero mayor o igual a 1.';
}

/** Opcional; si está, entero entre 1 (CHECK de Supabase) y OBJETIVO_MAXIMO. */
export function validarObjetivo(raw: string): string | null {
  if (raw.trim() === '') return null;
  return esEnteroPositivo(raw, OBJETIVO_MAXIMO)
    ? null
    : `El objetivo debe ser un número entero entre 1 y ${conPuntosDeMiles(OBJETIVO_MAXIMO)} árboles.`;
}

/** Primer error del formulario, o null. */
export function validarFormulario(
  valores: ValoresDelFormulario,
  { codigoEditable = true }: { codigoEditable?: boolean } = {},
): string | null {
  if (valores.lugar.trim().length < LARGO_MINIMO) return `Lugar debe tener al menos ${LARGO_MINIMO} caracteres.`;
  if (valores.periodo.trim().length < LARGO_MINIMO) return `Periodo debe tener al menos ${LARGO_MINIMO} caracteres.`;
  return (codigoEditable ? errorCodigoPlantacion(normalizarCodigoPlantacion(valores.codigo)) : null)
    ?? validarObjetivo(valores.objetivoArboles)
    ?? validateGpsFrequency(valores.gpsFrequency);
}

// ─── Conversión ──────────────────────────────────────────────────────────────

export function valoresIniciales(plantacion?: PlantacionEditable | null): ValoresDelFormulario {
  return {
    lugar: plantacion?.lugar ?? '',
    periodo: plantacion?.periodo ?? '',
    codigo: plantacion?.codigo ?? '',
    descripcion: plantacion?.descripcion ?? '',
    fechaInicio: recortarIso(plantacion?.fechaInicio),
    objetivoArboles: plantacion?.objetivoArboles != null ? String(plantacion.objetivoArboles) : '',
    gpsFrequency: String(plantacion?.gpsCaptureFrequency ?? GPS_CAPTURE_FREQUENCY_DEFAULT),
    gpsRequired: plantacion?.gpsCaptureRequired ?? GPS_CAPTURE_REQUIRED_DEFAULT,
    fotoEnTodos: plantacion?.photoCaptureAllTrees ?? PHOTO_CAPTURE_ALL_TREES_DEFAULT,
    visibleParaTecnicos: plantacion?.visibleInApp ?? VISIBLE_IN_APP_DEFAULT,
  };
}

/** Valores ya validados → campos a guardar. Vacío (o solo espacios) es null: vaciar un campo lo borra. */
export function aCamposDePlantacion(valores: ValoresDelFormulario): CamposDePlantacion {
  const objetivo = valores.objetivoArboles.trim();
  return {
    lugar: valores.lugar.trim(),
    periodo: valores.periodo.trim(),
    codigo: normalizarCodigoPlantacion(valores.codigo),
    // Sin recortar: si no, abrir y guardar reescribe una descripción de la web con espacios.
    descripcion: valores.descripcion.trim() === '' ? null : valores.descripcion,
    fechaInicio: valores.fechaInicio === '' ? null : valores.fechaInicio,
    objetivoArboles: objetivo === '' ? null : Number(objetivo),
    gpsCaptureFrequency: Number(valores.gpsFrequency.trim()),
    gpsCaptureRequired: valores.gpsRequired,
    photoCaptureAllTrees: valores.fotoEnTodos,
    visibleInApp: valores.visibleParaTecnicos,
  };
}
