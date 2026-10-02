/**
 * Cambiar la especie de un árbol desde su detalle (#679): quién puede, las
 * opciones del selector y el árbol que queda. Puro: se testea sin renderizar.
 */
import type { OpcionConDetalle } from '../../components';
import { idDeArbol } from '../../lib/codigoPlantacion';
import type { ArbolDetalle } from '../../queries/dataExplorerQueries';
import type { EspecieDePlantacion } from '../../queries/especieQueries';
import { esArchivada, ESTADO_PLANTACION, type Plantacion } from '../../queries/plantationQueries';
import type { EspecieDelArbol } from '../../repositories/especieDeArbol';
import { ROL, type Perfil } from '../../repositories/profileRepository';

const ROLES_QUE_CAMBIAN_ESPECIE: ReadonlyArray<Perfil['rol']> = [ROL.ADMIN, ROL.SUPERADMIN];

/** Espeja la RPC: admin o superadmin; una finalizada solo el superadmin y una archivada nadie. */
export function puedeCambiarEspecie(
  perfil: Pick<Perfil, 'rol' | 'activo'> | null,
  plantacion: Pick<Plantacion, 'estado' | 'archivadaEn'> | undefined,
): boolean {
  if (!perfil?.activo || !ROLES_QUE_CAMBIAN_ESPECIE.includes(perfil.rol)) return false;
  if (!plantacion || esArchivada(plantacion)) return false;
  return plantacion.estado === ESTADO_PLANTACION.activa || perfil.rol === ROL.SUPERADMIN;
}

/** Código y nombre arriba, nombre científico debajo: se busca por cualquiera. */
export function opcionesDeEspecie(especies: EspecieDePlantacion[]): OpcionConDetalle[] {
  return especies.map((especie) => ({
    valor: especie.id,
    principal: `${especie.codigo} · ${especie.nombre}`,
    secundario: especie.nombreCientifico,
  }));
}

/** La especie elegida como la muestra el árbol; sin código ni nombre si no está entre las cargadas. */
export function especieElegida(
  especies: EspecieDePlantacion[] | undefined,
  especieId: string,
  subId: string,
): EspecieDelArbol {
  const especie = especies?.find((candidata) => candidata.id === especieId);
  return {
    especieId,
    especieCodigo: especie?.codigo ?? null,
    especieNombre: especie?.nombre ?? null,
    subId,
  };
}

/** El SubID lleva el código de la especie: el ID del árbol cambia con ella. */
export function arbolConEspecie(
  arbol: ArbolDetalle,
  especie: EspecieDelArbol,
  codigoPlantacion: string | null,
): ArbolDetalle {
  return { ...arbol, ...especie, idArbol: idDeArbol(especie.subId, codigoPlantacion) };
}
