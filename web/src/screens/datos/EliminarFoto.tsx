import { Trash2 } from 'lucide-react';
import { BotonIcono, Button, ConfirmarModal } from '../../components';
import { TAMANO_ICONO } from '../../theme/iconos';
import { descripcionEliminarFoto, TEXTO_ELIMINAR_FOTO as T } from './eliminacionDeFoto';
import type { EliminarFoto } from './useEliminarFoto';

/** Sobre la miniatura. Deshabilitado, el tooltip dice por qué. */
export function BotonEliminarFoto({ eliminar }: { eliminar: EliminarFoto }) {
  return (
    <BotonIcono
      variante="contorno"
      tamano="sm"
      destructiva
      etiqueta={T.eliminar}
      title={eliminar.motivoBloqueo ?? T.eliminar}
      disabled={eliminar.motivoBloqueo !== null}
      onClick={eliminar.pedir}
    >
      <Trash2 size={TAMANO_ICONO.md} aria-hidden />
    </BotonIcono>
  );
}

/** En la foto ampliada, con texto. */
export function BotonEliminarFotoAmpliada({
  eliminar,
  className,
}: {
  eliminar: EliminarFoto;
  className?: string;
}) {
  return (
    <Button
      variant="destructiva"
      className={className}
      title={eliminar.motivoBloqueo ?? undefined}
      disabled={eliminar.motivoBloqueo !== null}
      onClick={eliminar.pedir}
    >
      <Trash2 size={TAMANO_ICONO.md} aria-hidden />
      {T.eliminar}
    </Button>
  );
}

export function ConfirmarEliminarFoto({
  idArbol,
  eliminar,
}: {
  idArbol: string;
  eliminar: EliminarFoto;
}) {
  if (!eliminar.confirmando) return null;
  return (
    <ConfirmarModal
      titulo={T.eliminar}
      descripcion={descripcionEliminarFoto(idArbol)}
      aviso={T.avisoEliminar}
      confirmarEtiqueta={T.eliminar}
      destructiva
      accion={eliminar.eliminar}
      alCompletar={eliminar.alCompletar}
      onClose={eliminar.cerrar}
    />
  );
}
