import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type { PreviewEliminacion } from '../../../../supabase/functions/admin-users/nucleo';
import { nombreVisible } from '../../lib/presentacionUsuario';
import { CLAVE_QUERY, familia } from '../../queries/clavesQuery';
import type { UsuarioConAsignaciones } from '../../queries/usuarioQueries';
import { eliminarUsuario, previsualizarEliminacion } from '../../services/adminUsersService';
import { ConfirmarModal } from '../../components/ConfirmarModal';
import { AVISO_ELIMINAR, copyEliminar, TEXTO_REVISANDO_DATOS } from './confirmaciones';

function descripcion(nombre: string, preview: UseQueryResult<PreviewEliminacion, Error>): string {
  if (preview.data) return copyEliminar(nombre, preview.data);
  if (preview.error) return preview.error.message;
  return TEXTO_REVISANDO_DATOS;
}

interface EliminarUsuarioModalProps {
  usuario: UsuarioConAsignaciones;
  onClose: () => void;
}

/** Eliminar también le borra las membresías: los técnicos asignados de cada plantación cambian. */
function useEliminar(userId: string) {
  const queryClient = useQueryClient();
  return async () => {
    await eliminarUsuario(userId);
    await queryClient.invalidateQueries({ queryKey: familia(CLAVE_QUERY.plantacionUsuarios) });
  };
}

/** Confirma la eliminación con lo que va a pasar según sus datos; sin preview no se confirma. */
export function EliminarUsuarioModal({ usuario, onClose }: EliminarUsuarioModalProps) {
  const nombre = nombreVisible(usuario.nombre, usuario.id);
  const eliminar = useEliminar(usuario.id);
  const preview = useQuery({
    queryKey: CLAVE_QUERY.previewEliminacionUsuario(usuario.id),
    queryFn: () => previsualizarEliminacion(usuario.id),
    // Los conteos cambian con cada sincronización: nunca mostrar uno cacheado.
    gcTime: 0,
    staleTime: 0,
  });
  return (
    <ConfirmarModal
      titulo={`Eliminar a ${nombre}`}
      descripcion={descripcion(nombre, preview)}
      aviso={AVISO_ELIMINAR}
      confirmarEtiqueta="Eliminar"
      destructiva
      deshabilitada={!preview.data}
      accion={eliminar}
      onClose={onClose}
    />
  );
}
