/** Textos de la pantalla "Resolver cambios" (#634): etiquetas, valores y quién/cuándo. */
import type { CampoDePlantacion } from './camposDePlantacion';
import type { ConflictoDeCampo, ValorDeCampo } from './conflictosDeEdicion';
import type { VistaDeConflicto } from './vistaDeConflicto';
import { isoAFecha } from './fechaDeCalendario';
import { conPuntosDeMiles } from './formularioDePlantacion';
import { MICROSEGUNDOS_POR_MS, microsegundosDesdeEpoch } from '../../../shared/instante';

export const ETIQUETA_DE_CAMPO: Record<CampoDePlantacion, string> = {
  lugar: 'Lugar',
  periodo: 'Periodo',
  codigo: 'Código',
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

/** El timestamp ISO de Postgres o de JS como fecha, con precisión de milisegundos. */
export function parsearTimestamp(iso: string): Date | null {
  const microsegundos = microsegundosDesdeEpoch(iso);
  return microsegundos === null ? null : new Date(Math.floor(microsegundos / MICROSEGUNDOS_POR_MS));
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

/** La tarjeta de un campo de la plantación. */
export function vistaDeConflictoDeCampo(conflicto: ConflictoDeCampo): VistaDeConflicto {
  const { campo } = conflicto;
  return {
    titulo: ETIQUETA_DE_CAMPO[campo],
    mio: { origen: origenDeMiCambio(conflicto), valor: textoDeValor(campo, conflicto.mio) },
    otro: { origen: origenDelCambioWeb(conflicto), valor: textoDeValor(campo, conflicto.web) },
    nota: textoAnterior(conflicto),
  };
}
