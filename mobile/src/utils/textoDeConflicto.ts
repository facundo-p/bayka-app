/** Textos de la pantalla "Resolver cambios" (#634): etiquetas, valores y quién/cuándo. */
import type { CampoDePlantacion } from './camposDePlantacion';
import type { ConflictoDeCampo, ValorDeCampo } from './conflictosDeEdicion';
import { conPuntosDeMiles, isoAFecha } from './formularioDePlantacion';

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

/** "24/09 10:12", en la hora del teléfono. */
export function textoDeMomento(iso: string | null): string | null {
  if (!iso) return null;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${dos(fecha.getDate())}/${dos(fecha.getMonth() + 1)} ${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`;
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
