/** Textos de la pantalla "Resolver cambios" (#634): etiquetas, valores y quién/cuándo. */
import type { CampoDePlantacion } from './camposDePlantacion';
import type { ConflictoDeCampo, ValorDeCampo } from './conflictosDeEdicion';
import { isoAFecha } from './fechaDeCalendario';
import { conPuntosDeMiles } from './formularioDePlantacion';

export const ETIQUETA_DE_CAMPO: Record<CampoDePlantacion, string> = {
  lugar: 'Lugar',
  periodo: 'Periodo',
  descripcion: 'Descripción',
  fechaInicio: 'Fecha de inicio',
  objetivoArboles: 'Objetivo de árboles',
  gpsCaptureFrequency: 'Capturar GPS cada N árboles',
  gpsCaptureRequired: 'Captura GPS obligatoria',
  photoCaptureAllTrees: 'Foto en todos los botones',
  visibleInApp: 'Visible para técnicos',
};

const SIN_VALOR = 'Sin dato';

export function textoDeValor(campo: CampoDePlantacion, valor: ValorDeCampo): string {
  if (valor === null || valor === undefined || valor === '') return SIN_VALOR;
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (typeof valor === 'number') return conPuntosDeMiles(valor);
  return campo === 'fechaInicio' ? isoAFecha(valor) : valor;
}

// Timestamp ISO de Postgres o de JS, con microsegundos y offset opcionales.
const PATRON_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}(?::?\d{2})?)?$/;

function minutosDeOffset(offset: string | undefined): number {
  const partes = offset ? /^([+-])(\d{2}):?(\d{2})?$/.exec(offset) : null;
  if (!partes) return 0;
  const [, signo, horas, minutos = '0'] = partes;
  return (signo === '-' ? -1 : 1) * (Number(horas) * 60 + Number(minutos));
}

/**
 * Parseo manual: `new Date()` de Hermes no garantiza aceptar microsegundos ni `+00:00`.
 * Sin offset se toma como UTC, que es como lo guarda el server.
 */
export function parsearTimestamp(iso: string): Date | null {
  const m = PATRON_TIMESTAMP.exec(iso.trim());
  if (!m) return null;
  const [, anio, mes, dia, hora, minuto, segundo = '0', fraccion = '0', offset] = m;
  const ms = Number(fraccion.padEnd(3, '0').slice(0, 3));
  const utc = Date.UTC(Number(anio), Number(mes) - 1, Number(dia), Number(hora), Number(minuto), Number(segundo), ms);
  return new Date(utc - minutosDeOffset(offset) * 60_000);
}

const dos = (n: number) => String(n).padStart(2, '0');

function mismoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "hoy 10:12", "ayer 17:40" o "24/09 10:12", en la hora del teléfono. */
export function textoDeMomento(iso: string | null, ahora: Date = new Date()): string | null {
  const fecha = iso ? parsearTimestamp(iso) : null;
  if (!fecha) return null;
  const hora = `${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`;
  const ayer = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 1);
  if (mismoDia(fecha, ahora)) return `hoy ${hora}`;
  if (mismoDia(fecha, ayer)) return `ayer ${hora}`;
  return `${dos(fecha.getDate())}/${dos(fecha.getMonth() + 1)} ${hora}`;
}

function conDetalle(prefijo: string, detalles: (string | null)[]): string {
  const presentes = detalles.filter(Boolean);
  return presentes.length > 0 ? `${prefijo} · ${presentes.join(', ')}` : prefijo;
}

export function origenDeMiCambio(conflicto: ConflictoDeCampo): string {
  return conDetalle('Tu cambio', ['este teléfono', textoDeMomento(conflicto.mioEn)]);
}

export function origenDelCambioWeb(conflicto: ConflictoDeCampo): string {
  return conDetalle('En la web', [conflicto.editadoPor, textoDeMomento(conflicto.editadoEn)]);
}

export function textoAnterior(conflicto: ConflictoDeCampo): string {
  return `Antes de los dos cambios: ${textoDeValor(conflicto.campo, conflicto.anterior)}`;
}
