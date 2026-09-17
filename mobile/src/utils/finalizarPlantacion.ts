/**
 * Datos sin subir bloquean la finalización (#537): con la plantación finalizada el
 * server ya no los acepta y quedan solo en este dispositivo.
 */
import type { ResumenDePendientes } from '../queries/catalogQueries';
import { detalleDePendientes } from './avisoEliminarDelDispositivo';

export function tienePendientes(r: ResumenDePendientes): boolean {
  return r.activaCount + r.finalizadaCount + r.parcelas + r.fotos + r.borrados > 0;
}

export function mensajeFinalizarConPendientes(r: ResumenDePendientes): string {
  return `Falta sincronizar: ${detalleDePendientes(r)}. Sincroniza antes de finalizar: una vez finalizada, esos datos ya no se pueden subir.`;
}

export function ayudaFinalizarConPendientes(detalle: string): string {
  return `Sincroniza antes de finalizar: ${detalle}`;
}
