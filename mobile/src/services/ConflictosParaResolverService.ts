/**
 * Los conflictos de sincronización tal como los muestra "Resolver cambios" (#804):
 * con lo que hay hoy y, si no se puede conservar lo propio, por qué. Guardar
 * aplica la elección de cada uno.
 */
import { conflictosDeSyncEnContexto, especieEnPlantacion } from '../queries/conflictosDeSyncQueries';
import { plantacionEditablePorId } from '../queries/estadoDeEdicionQueries';
import { conflictoDe } from '../repositories/ConflictosDeSyncRepository';
import { puedeEditarArbolesDe } from '../repositories/edicionDeArboles';
import { validateGroupUniqueness } from '../repositories/GroupRepository';
import { conservarLaMia, descartarConflicto, type ResultadoDeConflicto } from './ConflictosDeSyncService';
import {
  CAMPO_EN_CONFLICTO, ERROR_DE_CONFLICTO, FALLA_AL_RESOLVER, esCampoDeGrupo, type FallaAlResolver,
} from '../constants/conflictoDeSync';
import {
  ERROR_DE_DUPLICADO, ERROR_DE_EDICION, chocaElCodigo, chocaElNombre, type ErrorDeDuplicado,
} from '../constants/errorDeEdicion';
import type {
  ConflictoEnContexto, ConflictoParaResolver, EleccionDeConflicto, FallaDeConflicto, MotivoSinConservar,
} from '../types/conflictoDeSync';
import { esEspecieRecuperada } from '../utils/speciesHelpers';
import { entidadPresente, valorReaplicable } from '../utils/conflictosDeSync';
import { syncLog } from '../utils/syncLogger';

/** Las consultas que comparten los conflictos de un mismo grupo o plantación. */
export interface ReglasDeEdicion {
  plantacionEditable: (plantacionId: string) => Promise<boolean>;
  puedeEditarArboles: (grupoId: string) => Promise<boolean>;
}

const SIN_CACHE: ReglasDeEdicion = {
  plantacionEditable: plantacionEditablePorId,
  puedeEditarArboles: puedeEditarArbolesDe,
};

function porClave(consulta: (clave: string) => Promise<boolean>): (clave: string) => Promise<boolean> {
  const hechas = new Map<string, Promise<boolean>>();
  return (clave) => {
    const hecha = hechas.get(clave) ?? consulta(clave);
    hechas.set(clave, hecha);
    return hecha;
  };
}

/** Cada consulta una sola vez por plantación o grupo durante una carga. */
const reglasDeUnaCarga = (): ReglasDeEdicion => ({
  plantacionEditable: porClave(plantacionEditablePorId),
  puedeEditarArboles: porClave(puedeEditarArbolesDe),
});

/** La especie propia sigue en el catálogo y en la plantación. */
async function especieReaplicable({ conflicto, especies }: ConflictoEnContexto): Promise<boolean> {
  if (typeof conflicto.mio !== 'string' || !especies.mia || esEspecieRecuperada(especies.mia.codigo)) return false;
  return especieEnPlantacion(conflicto.plantacionId, conflicto.mio);
}

function reaplicable(c: ConflictoEnContexto): Promise<boolean> | boolean {
  if (c.conflicto.campo === CAMPO_EN_CONFLICTO.especie) return especieReaplicable(c);
  return valorReaplicable(c.conflicto.campo, c.conflicto.mio);
}

/** El nombre o el código propio ya lo usa otro grupo de la parcela. Solo cuenta el choque del campo propio. */
async function choqueDeGrupo({ conflicto, grupo }: ConflictoEnContexto): Promise<ErrorDeDuplicado | null> {
  if (!grupo || typeof conflicto.mio !== 'string') return null;
  if (conflicto.campo === CAMPO_EN_CONFLICTO.nombre) {
    const error = await validateGroupUniqueness(grupo.parcelaId, conflicto.mio, grupo.codigo, grupo.id);
    return error && chocaElNombre(error) ? ERROR_DE_DUPLICADO.nombre : null;
  }
  if (conflicto.campo === CAMPO_EN_CONFLICTO.codigo) {
    const error = await validateGroupUniqueness(grupo.parcelaId, grupo.nombre, conflicto.mio.toUpperCase(), grupo.id);
    return error && chocaElCodigo(error) ? ERROR_DE_DUPLICADO.codigo : null;
  }
  return null;
}

/** Los mismos rechazos que `conservarLaMia`, antes de intentarlo. */
export async function motivoParaNoConservar(
  c: ConflictoEnContexto,
  reglas: ReglasDeEdicion = SIN_CACHE,
): Promise<MotivoSinConservar | null> {
  const { campo, plantacionId, grupoId } = c.conflicto;
  if (!entidadPresente(c)) return ERROR_DE_CONFLICTO.inexistente;
  if (!(await reglas.plantacionEditable(plantacionId))) return ERROR_DE_EDICION.plantacionNoEditable;
  if (!esCampoDeGrupo(campo) && !(await reglas.puedeEditarArboles(grupoId))) return ERROR_DE_EDICION.sinPermiso;
  if (!(await reaplicable(c))) return ERROR_DE_CONFLICTO.sinValor;
  return choqueDeGrupo(c);
}

export async function conflictosParaResolver(plantacionId: string): Promise<ConflictoParaResolver[]> {
  const conflictos = await conflictosDeSyncEnContexto(plantacionId);
  const reglas = reglasDeUnaCarga();
  return Promise.all(conflictos.map(async (c) => ({ ...c, motivo: await motivoParaNoConservar(c, reglas) })));
}

const aplicar = ({ entidadId, campo, conservar }: EleccionDeConflicto) =>
  (conservar ? conservarLaMia(entidadId, campo) : descartarConflicto(entidadId, campo));

/** Ya resuelto en otro lado cuenta como hecho: no queda nada que elegir. */
const resuelto = (r: ResultadoDeConflicto) => r.success || r.error === ERROR_DE_CONFLICTO.inexistente;

/** Null si quedó resuelto. Si el servidor cambió el dato desde que se eligió, no se aplica: hay que volver a verlo. */
async function resolverUno(eleccion: EleccionDeConflicto): Promise<FallaAlResolver | null> {
  try {
    const actual = await conflictoDe(eleccion.entidadId, eleccion.campo);
    if (!actual) return null;
    if (actual.detectadoEn !== eleccion.detectadoEn) return FALLA_AL_RESOLVER.cambio;
    return resuelto(await aplicar(eleccion)) ? null : FALLA_AL_RESOLVER.error;
  } catch (e) {
    syncLog.error(`No se pudo resolver el conflicto ${eleccion.campo} de ${eleccion.entidadId}:`, e);
    return FALLA_AL_RESOLVER.error;
  }
}

/** Aplica cada elección. Devuelve las que no se aplicaron: esas quedan pendientes. */
export async function resolverConflictosDeSync(elecciones: EleccionDeConflicto[]): Promise<FallaDeConflicto[]> {
  const fallas: FallaDeConflicto[] = [];
  for (const eleccion of elecciones) {
    const falla = await resolverUno(eleccion);
    if (falla) fallas.push({ entidadId: eleccion.entidadId, campo: eleccion.campo, falla });
  }
  return fallas;
}
