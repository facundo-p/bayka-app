/**
 * Qué se borró. Discrimina las filas de `borrados_pendientes`.
 *
 * `arbol` y `grupo` viajan en el payload del RPC `sincronizar_borrados`: cruzan el
 * contrato con el server (#467), duplicados en
 * `supabase/migrations/036_sincronizar_borrados.sql` porque SQL no puede importar
 * la constante. Renombrarlos rompe la propagación.
 *
 * `foto` es la foto quitada de un árbol que sigue existiendo (#498). No cruza el
 * contrato: va por `quitar_fotos_arboles`, que recibe solo ids.
 */
export const ENTIDAD_BORRADA = {
  arbol: 'arbol',
  grupo: 'grupo',
  foto: 'foto',
} as const;

export type EntidadBorrada = (typeof ENTIDAD_BORRADA)[keyof typeof ENTIDAD_BORRADA];

/** Los tipos que borran filas en el server, vía `sincronizar_borrados`. */
export const ENTIDADES_DE_FILA: readonly EntidadBorrada[] = [ENTIDAD_BORRADA.arbol, ENTIDAD_BORRADA.grupo];

/** Las fotos quitadas, vía `quitar_fotos_arboles`. */
export const FOTOS_QUITADAS: readonly EntidadBorrada[] = [ENTIDAD_BORRADA.foto];
