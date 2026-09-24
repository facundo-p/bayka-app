import { ConfirmarModal } from '../../components/ConfirmarModal';
import { useInvalidarArchivado } from '../../hooks/useInvalidarArchivado';
import type { Plantacion } from '../../queries/plantationQueries';
import { CONFIRMACION_REAPERTURA } from './reapertura';

interface ReaperturaModalProps {
  plantacion: Plantacion;
  onClose: () => void;
}

/** Confirmación de devolver una plantación finalizada al estado activo (#470). */
export function ReaperturaModal({ plantacion, onClose }: ReaperturaModalProps) {
  // Cambia el detalle, el listado y la card "Temporada activa": lo mismo que archivar.
  const invalidar = useInvalidarArchivado(plantacion.id);
  return (
    <ConfirmarModal
      titulo={CONFIRMACION_REAPERTURA.titulo(plantacion.lugar)}
      descripcion={CONFIRMACION_REAPERTURA.descripcion(plantacion.lugar)}
      aviso={CONFIRMACION_REAPERTURA.aviso}
      confirmarEtiqueta={CONFIRMACION_REAPERTURA.etiqueta}
      accion={() => CONFIRMACION_REAPERTURA.servicio(plantacion.id)}
      alCompletar={invalidar}
      onClose={onClose}
    />
  );
}
