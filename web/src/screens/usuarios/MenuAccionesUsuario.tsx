import { MoreHorizontal } from 'lucide-react';
import { BotonIcono } from '../../components/BotonIcono';
import {
  MenuDesplegable,
  type ItemDesplegable,
  type PropsDisparador,
} from '../../components/MenuDesplegable';
import type { AccionUsuario, ItemMenu } from './acciones';
import { TAMANO_ICONO } from '../../theme/iconos';

type AlElegirAccion = (accion: AccionUsuario) => void;

function aItemDesplegable(item: ItemMenu, onAccion: AlElegirAccion): ItemDesplegable {
  return {
    clave: item.accion,
    etiqueta: item.etiqueta,
    motivo: item.motivo,
    destructiva: item.destructiva,
    onSeleccionar: () => onAccion(item.accion),
  };
}

/** El botón "⋯": el nombre accesible que arma el menú va como etiqueta. */
function disparadorMenu({ 'aria-label': etiqueta, ...props }: PropsDisparador) {
  return (
    <BotonIcono variante="fantasma" etiqueta={etiqueta} {...props}>
      <MoreHorizontal size={TAMANO_ICONO.lg} aria-hidden />
    </BotonIcono>
  );
}

interface MenuAccionesUsuarioProps {
  nombre: string;
  items: ItemMenu[];
  onAccion: AlElegirAccion;
}

/** Menú "⋯" de acciones por fila. Las acciones con guard quedan visibles pero
 *  deshabilitadas, con el motivo en el title (nunca ocultas). */
export function MenuAccionesUsuario({ nombre, items, onAccion }: MenuAccionesUsuarioProps) {
  return (
    <MenuDesplegable
      etiqueta={`Acciones de ${nombre}`}
      items={items.map((item) => aItemDesplegable(item, onAccion))}
      disparador={disparadorMenu}
    />
  );
}
