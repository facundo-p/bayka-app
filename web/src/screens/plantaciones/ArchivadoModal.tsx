import { ConfirmarModal } from '../../components/ConfirmarModal';
import { useInvalidarArchivado } from '../../hooks/useInvalidarArchivado';
import type { Plantacion } from '../../queries/plantationQueries';
import { accionDeArchivado, CONFIRMACION_ARCHIVADO } from './archivado';

interface ArchivadoModalProps {
  plantacion: Plantacion;
  onClose: () => void;
}

/** Confirmación de archivar o desarchivar, según cómo esté la plantación. */
export function ArchivadoModal({ plantacion, onClose }: ArchivadoModalProps) {
  const invalidar = useInvalidarArchivado(plantacion.id);
  const confirmacion = CONFIRMACION_ARCHIVADO[accionDeArchivado(plantacion)];
  return (
    <ConfirmarModal
      titulo={confirmacion.titulo(plantacion.lugar)}
      descripcion={confirmacion.descripcion(plantacion.lugar)}
      confirmarEtiqueta={confirmacion.etiqueta}
      destructiva={confirmacion.destructiva}
      accion={() => confirmacion.servicio(plantacion.id)}
      alCompletar={invalidar}
      onClose={onClose}
    />
  );
}
