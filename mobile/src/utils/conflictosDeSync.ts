/**
 * Reglas puras de los conflictos de sincronización (#795): si lo propio se puede
 * volver a aplicar y qué opción arranca marcada.
 */
import {
  CAMPO_EN_CONFLICTO, esCampoDeGrupo, type CampoEnConflicto, type ErrorDeConflicto, type PuntoGps,
} from '../constants/conflictoDeSync';
import type { ErrorDeDuplicado, ErrorDeEdicion } from '../constants/errorDeEdicion';
import { ESTADO_GRUPO } from '../constants/estados';
import { esGroupTipo } from '../constants/groupTipo';
import { ELECCION, type Eleccion, type PlantacionConCambios } from './conflictosDeEdicion';

/** Por qué no se puede conservar lo del teléfono. */
export type MotivoSinConservar = ErrorDeConflicto | ErrorDeEdicion | ErrorDeDuplicado;

type PuntoCompleto = PuntoGps & { latitude: number; longitude: number; gpsCapturedAt: string };

/** Un punto con latitud, longitud y momento de captura: lo que hace falta para reaplicarlo. */
export function puntoCompleto(valor: unknown): valor is PuntoCompleto {
  const p = valor as Partial<PuntoGps> | null;
  return p?.latitude != null && p.longitude != null && p.gpsCapturedAt != null;
}

const esTextoConValor = (valor: unknown): valor is string => typeof valor === 'string' && valor !== '';

const esEstadoReaplicable = (valor: unknown) =>
  valor === ESTADO_GRUPO.activa || valor === ESTADO_GRUPO.finalizada;

/** Si el valor propio tiene la forma que necesita su campo. La especie se valida aparte, contra la plantación. */
export function valorReaplicable(campo: CampoEnConflicto, mio: unknown): boolean {
  switch (campo) {
    case CAMPO_EN_CONFLICTO.gps: return puntoCompleto(mio);
    case CAMPO_EN_CONFLICTO.estado: return esEstadoReaplicable(mio);
    case CAMPO_EN_CONFLICTO.tipo: return esGroupTipo(mio);
    default: return esTextoConValor(mio);
  }
}

/** El árbol o el grupo del conflicto sigue en el teléfono. */
export function entidadPresente(c: { conflicto: { campo: CampoEnConflicto }; arbol: unknown; grupo: unknown }): boolean {
  return esCampoDeGrupo(c.conflicto.campo) ? c.grupo != null : c.arbol != null;
}

/** Identifica una versión del conflicto: si el servidor vuelve a cambiar el dato, la fila se reemplaza y la elección vuelve a empezar. */
export function claveDeConflicto(c: { entidadId: string; campo: CampoEnConflicto; detectadoEn: string }): string {
  return `${c.entidadId}:${c.campo}:${c.detectadoEn}`;
}

/** Arranca marcado lo del teléfono, salvo que no se pueda conservar. */
export function eleccionDeConflicto(
  elegida: Eleccion | undefined,
  motivo: MotivoSinConservar | null,
): Eleccion {
  if (motivo) return ELECCION.web;
  return elegida ?? ELECCION.mio;
}

type ConflictoElegible = {
  conflicto: { entidadId: string; campo: CampoEnConflicto; detectadoEn: string };
  motivo: MotivoSinConservar | null;
};

/** Qué se aplica al guardar: conservar lo propio o quedarse con lo del servidor, por conflicto. */
export function eleccionesAGuardar(conflictos: ConflictoElegible[], elegidas: Record<string, Eleccion>) {
  return conflictos.map(({ conflicto, motivo }) => ({
    entidadId: conflicto.entidadId,
    campo: conflicto.campo,
    conservar: eleccionDeConflicto(elegidas[claveDeConflicto(conflicto)], motivo) === ELECCION.mio,
  }));
}

/**
 * Las plantaciones de una corrida de sync que tienen conflictos sin resolver, nuevos o
 * de antes: el grupo no termina de sincronizarse hasta que se elija. Con `soloEsta`,
 * la corrida fue de una sola plantación.
 */
export function plantacionesConConflictos(
  porPlantacion: ReadonlyMap<string, number>,
  plantaciones: { id: string; lugar: string }[],
  soloEsta: string | null,
): PlantacionConCambios[] {
  return plantaciones
    .filter((p) => (soloEsta === null || p.id === soloEsta) && (porPlantacion.get(p.id) ?? 0) > 0)
    .map((p) => ({ plantacionId: p.id, nombre: p.lugar, cantidad: porPlantacion.get(p.id) ?? 0 }));
}
