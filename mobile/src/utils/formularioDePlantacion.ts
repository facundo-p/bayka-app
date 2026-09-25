/**
 * Lógica pura del formulario de plantación (#633): valores tal como se tipean,
 * validación con las mismas reglas que la web y conversión a los campos que se
 * guardan.
 */
import { GPS_CAPTURE_FREQUENCY_DEFAULT, GPS_CAPTURE_REQUIRED_DEFAULT } from '../constants/gpsCapture';
import { PHOTO_CAPTURE_ALL_TREES_DEFAULT } from '../constants/photoCapture';
import { VISIBLE_IN_APP_DEFAULT } from '../constants/visibilidad';
import type { CamposDePlantacion } from './camposDePlantacion';

const LARGO_MINIMO = 2;

export type ValoresDelFormulario = {
  lugar: string;
  periodo: string;
  descripcion: string;
  /** DD/MM/AAAA. */
  fechaInicio: string;
  objetivoArboles: string;
  gpsFrequency: string;
  gpsRequired: boolean;
  fotoEnTodos: boolean;
  visibleParaTecnicos: boolean;
};

export type PlantacionEditable = Partial<CamposDePlantacion> & Pick<CamposDePlantacion, 'lugar' | 'periodo'>;

// ─── Fecha: DD/MM/AAAA en pantalla, YYYY-MM-DD en la base ────────────────────

const LARGO_FECHA = 8;

/** Deja solo dígitos y pone las barras mientras se tipea: el teclado numérico no las tiene. */
export function formatearFechaTipeada(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, LARGO_FECHA);
  const partes = [digitos.slice(0, 2), digitos.slice(2, 4), digitos.slice(4)].filter(Boolean);
  return partes.join('/');
}

/** '15/04/2026' → '2026-04-15'; null si no es una fecha real. */
export function fechaAIso(texto: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  if (!match) return null;
  const [, dia, mes, anio] = match;
  const fecha = new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia)));
  const esReal = fecha.getUTCDate() === Number(dia) && fecha.getUTCMonth() === Number(mes) - 1;
  return esReal ? `${anio}-${mes}-${dia}` : null;
}

/** '2026-04-15' → '15/04/2026'. */
export function isoAFecha(iso: string | null | undefined): string {
  const match = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

// ─── Validación ──────────────────────────────────────────────────────────────

function esEnteroPositivo(texto: string): boolean {
  const valor = Number(texto.trim());
  return texto.trim() !== '' && Number.isInteger(valor) && valor >= 1;
}

/** Frecuencia de captura GPS: entero ≥ 1. */
export function validateGpsFrequency(raw: string): string | null {
  return esEnteroPositivo(raw) ? null : 'La frecuencia debe ser un número entero mayor o igual a 1.';
}

/** Opcional; si está, entero ≥ 1 (CHECK de Supabase). */
export function validarObjetivo(raw: string): string | null {
  if (raw.trim() === '') return null;
  return esEnteroPositivo(raw) ? null : 'El objetivo debe ser un número entero de al menos 1 árbol.';
}

/** Opcional; si está, una fecha real. */
export function validarFechaInicio(raw: string): string | null {
  if (raw.trim() === '') return null;
  return fechaAIso(raw) ? null : 'La fecha de inicio debe ser una fecha válida (DD/MM/AAAA).';
}

/** Primer error del formulario, o null. */
export function validarFormulario(valores: ValoresDelFormulario): string | null {
  if (valores.lugar.trim().length < LARGO_MINIMO) return 'Lugar debe tener al menos 2 caracteres.';
  if (valores.periodo.trim().length < LARGO_MINIMO) return 'Periodo debe tener al menos 2 caracteres.';
  return validarFechaInicio(valores.fechaInicio)
    ?? validarObjetivo(valores.objetivoArboles)
    ?? validateGpsFrequency(valores.gpsFrequency);
}

// ─── Conversión ──────────────────────────────────────────────────────────────

export function valoresIniciales(plantacion?: PlantacionEditable | null): ValoresDelFormulario {
  return {
    lugar: plantacion?.lugar ?? '',
    periodo: plantacion?.periodo ?? '',
    descripcion: plantacion?.descripcion ?? '',
    fechaInicio: isoAFecha(plantacion?.fechaInicio),
    objetivoArboles: plantacion?.objetivoArboles != null ? String(plantacion.objetivoArboles) : '',
    gpsFrequency: String(plantacion?.gpsCaptureFrequency ?? GPS_CAPTURE_FREQUENCY_DEFAULT),
    gpsRequired: plantacion?.gpsCaptureRequired ?? GPS_CAPTURE_REQUIRED_DEFAULT,
    fotoEnTodos: plantacion?.photoCaptureAllTrees ?? PHOTO_CAPTURE_ALL_TREES_DEFAULT,
    visibleParaTecnicos: plantacion?.visibleInApp ?? VISIBLE_IN_APP_DEFAULT,
  };
}

/** Valores ya validados → campos a guardar. Vacío es null: vaciar un campo lo borra. */
export function aCamposDePlantacion(valores: ValoresDelFormulario): CamposDePlantacion {
  const descripcion = valores.descripcion.trim();
  const objetivo = valores.objetivoArboles.trim();
  return {
    lugar: valores.lugar.trim(),
    periodo: valores.periodo.trim(),
    descripcion: descripcion === '' ? null : descripcion,
    fechaInicio: fechaAIso(valores.fechaInicio),
    objetivoArboles: objetivo === '' ? null : Number(objetivo),
    gpsCaptureFrequency: Number(valores.gpsFrequency.trim()),
    gpsCaptureRequired: valores.gpsRequired,
    photoCaptureAllTrees: valores.fotoEnTodos,
    visibleInApp: valores.visibleParaTecnicos,
  };
}
