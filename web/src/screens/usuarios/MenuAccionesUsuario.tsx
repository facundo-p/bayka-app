import { MoreHorizontal } from 'lucide-react';
import { BotonIcono } from '../../components/BotonIcono';
import { MenuDesplegable, type ItemDesplegable } from '../../components/MenuDesplegable';
import type { AccionUsuario, ItemMenu } from './acciones';
import { TAMANO_ICONO } from '../../theme/iconos';

/** Menú "⋯" de acciones por fila. Las acciones con guard quedan visibles pero
 *  deshabilitadas, con el motivo en el title (nunca ocultas). */
export function MenuAccionesUsuario({
  nombre,
  items,
  onAccion,
}: {
  nombre: string;
  items: ItemMenu[];
  onAccion: (accion: AccionUsuario) => void;
}) {
  const opciones: ItemDesplegable[] = items.map((item) => ({
    clave: item.accion,
    etiqueta: item.etiqueta,
    motivo: item.motivo,
    destructiva: item.destructiva,
    onSeleccionar: () => onAccion(item.accion),
  }));

  return (
    <MenuDesplegable
      etiqueta={`Acciones de ${nombre}`}
      items={opciones}
      disparador={({ 'aria-label': etiqueta, ...props }) => (
        <BotonIcono variante="fantasma" etiqueta={etiqueta} {...props}>
          <MoreHorizontal size={TAMANO_ICONO.lg} aria-hidden />
        </BotonIcono>
      )}
    />
  );
}
