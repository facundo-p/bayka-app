/**
 * Qué se borró. Discrimina las filas de `borrados_pendientes` y viaja en el payload
 * del RPC `sincronizar_borrados`: los valores cruzan el contrato con el server
 * (#467), duplicados en `supabase/migrations/036_sincronizar_borrados.sql` porque
 * SQL no puede importar la constante. Renombrar un valor rompe la propagación.
 */
export const ENTIDAD_BORRADA = {
  arbol: 'arbol',
  grupo: 'grupo',
} as const;

export type EntidadBorrada = (typeof ENTIDAD_BORRADA)[keyof typeof ENTIDAD_BORRADA];
