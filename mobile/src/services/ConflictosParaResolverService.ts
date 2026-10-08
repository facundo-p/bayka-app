/**
 * Los conflictos de sincronización tal como los muestra "Resolver cambios" (#804):
 * con lo que hay hoy y, si no se puede conservar lo propio, por qué. Guardar
 * aplica la elección de cada uno.
 */
import {
  conflictosDeSyncEnContexto, especieEnPlantacion, type ConflictoDeSyncEnContexto,
} from '../queries/conflictosDeSyncQueries';
import { plantacionEditablePorId } from '../queries/estadoDeEdicionQueries';
import { puedeEditarArbolesDe } from '../repositories/edicionDeArboles';
import { validateGroupUniqueness } from '../repositories/GroupRepository';
import { conservarLaMia, descartarConflicto } from './ConflictosDeSyncService';
import {
  CAMPO_EN_CONFLICTO, ERROR_DE_CONFLICTO, esCampoDeGrupo, type CampoEnConflicto,
} from '../constants/conflictoDeSync';
import { ERROR_DE_EDICION, type ErrorDeDuplicado } from '../constants/errorDeEdicion';
import { esEspecieRecuperada } from '../utils/speciesHelpers';
import { entidadPresente, valorReaplicable, type MotivoSinConservar } from '../utils/conflictosDeSync';
import { syncLog } from '../utils/syncLogger';

export interface ConflictoParaResolver extends ConflictoDeSyncEnContexto {
  /** Null si se puede conservar lo del teléfono. */
  motivo: MotivoSinConservar | null;
}

/** La especie propia sigue en el catálogo y en la plantación. */
async function especieReaplicable({ conflicto, especies }: ConflictoDeSyncEnContexto): Promise<boolean> {
  if (typeof conflicto.mio !== 'string' || !especies.mia || esEspecieRecuperada(especies.mia.codigo)) return false;
  return especieEnPlantacion(conflicto.plantacionId, conflicto.mio);
}

function reaplicable(c: ConflictoDeSyncEnContexto): Promise<boolean> | boolean {
  if (c.conflicto.campo === CAMPO_EN_CONFLICTO.especie) return especieReaplicable(c);
  return valorReaplicable(c.conflicto.campo, c.conflicto.mio);
}

/** El nombre o el código propio ya lo usa otro grupo de la parcela. */
async function choqueDeGrupo({ conflicto, grupo }: ConflictoDeSyncEnContexto): Promise<ErrorDeDuplicado | null> {
  if (!grupo || typeof conflicto.mio !== 'string') return null;
  if (conflicto.campo === CAMPO_EN_CONFLICTO.nombre) {
    return validateGroupUniqueness(grupo.parcelaId, conflicto.mio, grupo.codigo, grupo.id);
  }
  if (conflicto.campo === CAMPO_EN_CONFLICTO.codigo) {
    return validateGroupUniqueness(grupo.parcelaId, grupo.nombre, conflicto.mio.toUpperCase(), grupo.id);
  }
  return null;
}

/** Los mismos rechazos que `conservarLaMia`, antes de intentarlo. */
export async function motivoParaNoConservar(c: ConflictoDeSyncEnContexto): Promise<MotivoSinConservar | null> {
  const { campo, plantacionId, grupoId } = c.conflicto;
  if (!entidadPresente(c)) return ERROR_DE_CONFLICTO.inexistente;
  if (!(await plantacionEditablePorId(plantacionId))) return ERROR_DE_EDICION.plantacionNoEditable;
  if (!esCampoDeGrupo(campo) && !(await puedeEditarArbolesDe(grupoId))) return ERROR_DE_EDICION.sinPermiso;
  if (!(await reaplicable(c))) return ERROR_DE_CONFLICTO.sinValor;
  return choqueDeGrupo(c);
}

export async function conflictosParaResolver(plantacionId: string): Promise<ConflictoParaResolver[]> {
  const conflictos = await conflictosDeSyncEnContexto(plantacionId);
  return Promise.all(conflictos.map(async (c) => ({ ...c, motivo: await motivoParaNoConservar(c) })));
}

export interface EleccionDeConflicto {
  entidadId: string;
  campo: CampoEnConflicto;
  conservar: boolean;
}

async function resolverUno({ entidadId, campo, conservar }: EleccionDeConflicto): Promise<boolean> {
  try {
    const resultado = conservar ? await conservarLaMia(entidadId, campo) : await descartarConflicto(entidadId, campo);
    return resultado.success;
  } catch (e) {
    syncLog.error(`No se pudo resolver el conflicto ${campo} de ${entidadId}:`, e);
    return false;
  }
}

/** Aplica cada elección. Devuelve cuántas no se pudieron aplicar: esas quedan pendientes. */
export async function resolverConflictosDeSync(elecciones: EleccionDeConflicto[]): Promise<number> {
  let fallidas = 0;
  for (const eleccion of elecciones) {
    if (!(await resolverUno(eleccion))) fallidas += 1;
  }
  return fallidas;
}
