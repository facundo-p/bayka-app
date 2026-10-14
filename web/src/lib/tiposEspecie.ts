/**
 * Textos de la clasificación de especies (#752). Los valores son los de
 * `shared/tiposEspecie.ts`, que espeja el contrato y el CHECK de la base.
 */
import type { Opcion } from '../components/opcion';
import {
  SUBTIPO_ESPECIE,
  TIPO_ESPECIE,
  TIPOS_ESPECIE,
  type SubtipoEspecie,
  type TipoEspecie,
} from '../../../shared/tiposEspecie';

export const ETIQUETA_TIPO_ESPECIE: Record<TipoEspecie, string> = {
  [TIPO_ESPECIE.flora]: 'Flora',
};

export const ETIQUETA_SUBTIPO_ESPECIE: Record<SubtipoEspecie, string> = {
  [SUBTIPO_ESPECIE.arbol]: 'Árbol',
  [SUBTIPO_ESPECIE.arbusto]: 'Arbusto',
};

/** Los subtipos válidos de un tipo, como opciones de un selector. */
export function opcionesDeSubtipo(tipo: TipoEspecie): Array<Opcion<SubtipoEspecie>> {
  return TIPOS_ESPECIE.subtiposPorTipo[tipo].map((subtipo) => ({
    value: subtipo,
    label: ETIQUETA_SUBTIPO_ESPECIE[subtipo],
  }));
}
