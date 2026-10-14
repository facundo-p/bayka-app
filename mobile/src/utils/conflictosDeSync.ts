/**
 * Reglas puras de los conflictos de sincronización (#795): si lo propio se puede
 * volver a aplicar y qué opción arranca marcada.
 */
import { CAMPO_EN_CONFLICTO, esCampoDeGrupo, type CampoEnConflicto, type PuntoGps } from '../constants/conflictoDeSync';
import { ESTADO_GRUPO } from '../constants/estados';
import { esGroupTipo } from '../constants/groupTipo';
import type {
  ConflictoDeSync, ConflictoEnContexto, ConflictoParaResolver, EleccionDeConflicto, MotivoSinConservar,
} from '../types/conflictoDeSync';
import { ELECCION, type Eleccion, type PlantacionConCambios } from './conflictosDeEdicion';

type ConCoordenadas = PuntoGps & { latitude: number; longitude: number };
type PuntoCompleto = ConCoordenadas & { gpsCapturedAt: string };

/** Un punto con latitud y longitud: lo que hace falta para mostrarlo. */
export function tieneCoordenadas(valor: unknown): valor is ConCoordenadas {
  const p = valor as Partial<PuntoGps> | null;
  return p?.latitude != null && p.longitude != null;
}

/** Con el momento de captura, además: lo que hace falta para reaplicarlo. */
export function puntoCompleto(valor: unknown): valor is PuntoCompleto {
  return tieneCoordenadas(valor) && valor.gpsCapturedAt != null;
}

const esTextoConValor = (valor: unknown): valor is string => typeof valor === 'string' && valor !== '';

const esEstadoReaplicable = (valor: unknown) =>
  valor === ESTADO_GRUPO.activa || valor === ESTADO_GRUPO.finalizada;

/** En un conflicto de foto, lo propio vacío es la foto quitada en este teléfono (#810). */
export const esFotoQuitada = (mio: unknown): boolean => mio == null || mio === '';

/** Si el valor propio tiene la forma que necesita su campo. Que la especie esté en la plantación se valida aparte. */
export function valorReaplicable(campo: CampoEnConflicto, mio: unknown): boolean {
  switch (campo) {
    case CAMPO_EN_CONFLICTO.gps: return puntoCompleto(mio);
    case CAMPO_EN_CONFLICTO.foto: return esFotoQuitada(mio) || esTextoConValor(mio);
    case CAMPO_EN_CONFLICTO.estado: return esEstadoReaplicable(mio);
    case CAMPO_EN_CONFLICTO.tipo: return esGroupTipo(mio);
    default: return esTextoConValor(mio);
  }
}

/** El árbol o el grupo del conflicto sigue en el teléfono. */
export function entidadPresente(c: ConflictoEnContexto): boolean {
  return esCampoDeGrupo(c.conflicto.campo) ? c.grupo != null : c.arbol != null;
}

/** Identifica el dato en conflicto, sin importar la versión. */
export function idDeConflicto(c: Pick<ConflictoDeSync, 'entidadId' | 'campo'>): string {
  return `${c.entidadId}:${c.campo}`;
}

/** Identifica una versión del conflicto: si el servidor vuelve a cambiar el dato, la fila se reemplaza y la elección vuelve a empezar. */
export function claveDeConflicto(c: Pick<ConflictoDeSync, 'entidadId' | 'campo' | 'detectadoEn'>): string {
  return `${idDeConflicto(c)}:${c.detectadoEn}`;
}

/** Arranca marcado lo del teléfono, salvo que no se pueda conservar. */
export function eleccionDeConflicto(
  elegida: Eleccion | undefined,
  motivo: MotivoSinConservar | null,
): Eleccion {
  if (motivo) return ELECCION.web;
  return elegida ?? ELECCION.mio;
}

/** Qué se aplica al guardar: conservar lo propio o quedarse con lo del servidor, por conflicto. */
export function eleccionesAGuardar(
  conflictos: ConflictoParaResolver[],
  elegidas: Record<string, Eleccion>,
): EleccionDeConflicto[] {
  return conflictos.map(({ conflicto, motivo }) => ({
    entidadId: conflicto.entidadId,
    campo: conflicto.campo,
    detectadoEn: conflicto.detectadoEn,
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
