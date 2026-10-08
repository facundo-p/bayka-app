/**
 * Resolver un conflicto de sincronización (#795). El árbol o el grupo ya tienen el
 * valor del servidor, y su base es ese valor.
 *
 * - Conservar la mía: vuelve a aplicar lo propio como una edición más. El grupo
 *   queda pendiente y el próximo push, con la base del servidor, lo pisa.
 * - Descartar: se queda lo del servidor y se borra lo propio.
 */
import { enTransaccion } from '../database/transaccion';
import { notifyDataChanged } from '../database/liveQuery';
import {
  conflictoDe, quitarConflictos, type ConflictoDeSync,
} from '../repositories/ConflictosDeSyncRepository';
import { cambiarEspecie, updateTreeGps, updateTreePhoto } from '../repositories/TreeRepository';
import {
  finalizeGroup, reactivateGroup, updateGroup, type UpdateGroupResult,
} from '../repositories/GroupRepository';
import { puedeEditarArbolesDe } from '../repositories/edicionDeArboles';
import { plantacionEditablePorId } from '../queries/estadoDeEdicionQueries';
import { getGroupById } from '../queries/plantationDetailQueries';
import { arbolExiste, especieEnPlantacion } from '../queries/conflictosDeSyncQueries';
import { borrarFotosLocales } from './PhotoService';
import {
  CAMPO_EN_CONFLICTO, ERROR_DE_CONFLICTO, type CampoEnConflicto, type ErrorDeConflicto,
} from '../constants/conflictoDeSync';
import { puntoCompleto, valorReaplicable } from '../utils/conflictosDeSync';
import { ERROR_DE_EDICION, type ErrorDeDuplicado, type ErrorDeEdicion } from '../constants/errorDeEdicion';
import { ESTADO_GRUPO } from '../constants/estados';
import { esGroupTipo } from '../constants/groupTipo';

export type ResultadoDeConflicto =
  | { success: true }
  | { success: false; error: ErrorDeConflicto | ErrorDeEdicion | ErrorDeDuplicado | 'unknown' };

const OK: ResultadoDeConflicto = { success: true };
const falla = (error: ErrorDeConflicto | ErrorDeEdicion): ResultadoDeConflicto => ({ success: false, error });

/** Como al cargarla: tiene que ser una de las especies de la plantación. */
async function especieMia(c: ConflictoDeSync): Promise<ResultadoDeConflicto> {
  if (typeof c.mio !== 'string' || !(await especieEnPlantacion(c.plantacionId, c.mio))) {
    return falla(ERROR_DE_CONFLICTO.sinValor);
  }
  return (await cambiarEspecie(c.entidadId, c.mio)) ? OK : falla(ERROR_DE_CONFLICTO.sinValor);
}

async function gpsMio(c: ConflictoDeSync): Promise<ResultadoDeConflicto> {
  if (!puntoCompleto(c.mio)) return falla(ERROR_DE_CONFLICTO.sinValor);
  const { latitude, longitude, gpsAccuracy, gpsCapturedAt } = c.mio;
  await updateTreeGps(c.entidadId, { latitude, longitude, gpsAccuracy, gpsCapturedAt });
  return OK;
}

async function fotoMia(c: ConflictoDeSync): Promise<ResultadoDeConflicto> {
  if (typeof c.mio !== 'string') return falla(ERROR_DE_CONFLICTO.sinValor);
  await updateTreePhoto(c.entidadId, c.mio);
  return OK;
}

/** Los árboles que se pueden editar acá; el grupo, como lo edita su pantalla. */
async function aplicarLoMioDelArbol(c: ConflictoDeSync): Promise<ResultadoDeConflicto> {
  if (!(await arbolExiste(c.entidadId))) return falla(ERROR_DE_CONFLICTO.inexistente);
  if (!(await puedeEditarArbolesDe(c.grupoId))) return falla(ERROR_DE_EDICION.sinPermiso);
  if (c.campo === CAMPO_EN_CONFLICTO.especie) return especieMia(c);
  if (c.campo === CAMPO_EN_CONFLICTO.gps) return gpsMio(c);
  return fotoMia(c);
}

async function estadoMio(c: ConflictoDeSync): Promise<ResultadoDeConflicto> {
  const [grupo] = await getGroupById(c.entidadId);
  if (!grupo) return falla(ERROR_DE_CONFLICTO.inexistente);
  if (!(await plantacionEditablePorId(c.plantacionId))) return falla(ERROR_DE_EDICION.plantacionNoEditable);
  if (c.mio === ESTADO_GRUPO.finalizada) await finalizeGroup(c.entidadId);
  else if (c.mio === ESTADO_GRUPO.activa) await reactivateGroup(c.entidadId);
  else return falla(ERROR_DE_CONFLICTO.sinValor);
  return OK;
}

async function datoMioDelGrupo(c: ConflictoDeSync): Promise<UpdateGroupResult | ResultadoDeConflicto> {
  if (typeof c.mio !== 'string') return falla(ERROR_DE_CONFLICTO.sinValor);
  const [grupo] = await getGroupById(c.entidadId);
  if (!grupo) return falla(ERROR_DE_CONFLICTO.inexistente);
  const campos = { nombre: grupo.nombre, codigo: grupo.codigo, tipo: grupo.tipo, [c.campo]: c.mio };
  if (!esGroupTipo(campos.tipo)) return falla(ERROR_DE_CONFLICTO.sinValor);
  return updateGroup(c.entidadId, { ...campos, tipo: campos.tipo });
}

/** Lo que no tiene la forma de su campo se rechaza antes de tocar nada. */
async function aplicarLoMio(c: ConflictoDeSync): Promise<ResultadoDeConflicto> {
  if (!valorReaplicable(c.campo, c.mio)) return falla(ERROR_DE_CONFLICTO.sinValor);
  switch (c.campo) {
    case CAMPO_EN_CONFLICTO.especie:
    case CAMPO_EN_CONFLICTO.gps:
    case CAMPO_EN_CONFLICTO.foto:
      return aplicarLoMioDelArbol(c);
    case CAMPO_EN_CONFLICTO.estado:
      return estadoMio(c);
    case CAMPO_EN_CONFLICTO.nombre:
    case CAMPO_EN_CONFLICTO.codigo:
    case CAMPO_EN_CONFLICTO.tipo:
      return datoMioDelGrupo(c);
    default: {
      const desconocido: never = c.campo;
      throw new Error(`Campo en conflicto desconocido: ${String(desconocido)}`);
    }
  }
}

/** Vuelve a aplicar lo propio. La foto propia pasa a ser la del árbol: no se borra. */
export async function conservarLaMia(entidadId: string, campo: CampoEnConflicto): Promise<ResultadoDeConflicto> {
  const conflicto = await conflictoDe(entidadId, campo);
  if (!conflicto) return falla(ERROR_DE_CONFLICTO.inexistente);
  const resultado = await aplicarLoMio(conflicto);
  if (!resultado.success) return resultado;
  await enTransaccion((tx) => quitarConflictos(tx, entidadId, [campo]));
  notifyDataChanged();
  return OK;
}

/** Se queda lo del servidor: el conflicto se borra con su foto propia. */
export async function descartarConflicto(entidadId: string, campo: CampoEnConflicto): Promise<ResultadoDeConflicto> {
  if (!(await conflictoDe(entidadId, campo))) return falla(ERROR_DE_CONFLICTO.inexistente);
  const archivos = await enTransaccion((tx) => quitarConflictos(tx, entidadId, [campo]));
  borrarFotosLocales(archivos);
  notifyDataChanged();
  return OK;
}
