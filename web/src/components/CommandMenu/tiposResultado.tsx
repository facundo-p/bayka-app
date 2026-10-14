import {
  Box,
  Leaf,
  MapPin,
  Microscope,
  Sprout,
  TreePine,
  User,
  type LucideIcon,
} from 'lucide-react';
import type { TipoResultado } from '../../queries/buscarQueries';

/** Etiqueta del encabezado del grupo y su ícono por tipo de entidad. */
type MetaTipo = { etiqueta: string; Icono: LucideIcon };

const META_POR_TIPO: Record<TipoResultado, MetaTipo> = {
  plantacion: { etiqueta: 'Plantaciones', Icono: Sprout },
  parcela: { etiqueta: 'Parcelas', Icono: MapPin },
  grupo: { etiqueta: 'Grupos', Icono: Box },
  arbol: { etiqueta: 'Árboles', Icono: TreePine },
  especie: { etiqueta: 'Especies', Icono: Leaf },
  especieCientifica: { etiqueta: 'Especies científicas', Icono: Microscope },
  usuario: { etiqueta: 'Usuarios', Icono: User },
};

/** Orden de aparición de los grupos en la paleta. */
export const ORDEN_TIPOS: TipoResultado[] = [
  'plantacion',
  'parcela',
  'grupo',
  'arbol',
  'especie',
  'especieCientifica',
  'usuario',
];

export function metaDeTipo(tipo: TipoResultado): MetaTipo {
  return META_POR_TIPO[tipo];
}
