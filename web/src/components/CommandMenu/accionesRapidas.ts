import { Leaf, Plus, Settings, Sparkles, Sprout, Users, type LucideIcon } from 'lucide-react';
import type { ScopeContextual } from '../../hooks/useCommandMenu';
import { coincideBusqueda } from '../../lib/normalizarTexto';

/** Acción rápida de la paleta: navegación simple (sin backend nuevo). */
export type AccionRapida = {
  id: string;
  titulo: string;
  Icono: LucideIcon;
  to: string;
};

/** Acciones disponibles; dentro de una plantación se suma ir a su Configuración. */
export function accionesRapidas(scope: ScopeContextual | null): AccionRapida[] {
  const base: AccionRapida[] = [
    { id: 'nueva-plantacion', titulo: 'Nueva plantación', Icono: Plus, to: '/plantaciones' },
    { id: 'ir-plantaciones', titulo: 'Ir a Plantaciones', Icono: Sprout, to: '/plantaciones' },
    { id: 'ir-especies', titulo: 'Ir a Especies', Icono: Leaf, to: '/especies' },
    { id: 'ir-usuarios', titulo: 'Ir a Usuarios', Icono: Users, to: '/usuarios' },
    { id: 'ir-novedades', titulo: 'Ver novedades', Icono: Sparkles, to: '/novedades' },
  ];
  if (scope) {
    base.push({
      id: 'ir-configuracion',
      titulo: 'Ir a Configuración…',
      Icono: Settings,
      to: `/plantaciones/${scope.plantationId}/configuracion`,
    });
  }
  return base;
}

/** Filtra las acciones por el texto escrito (vacío = todas). */
export function filtrarAcciones(acciones: AccionRapida[], texto: string): AccionRapida[] {
  return acciones.filter((accion) => coincideBusqueda([accion.titulo], texto));
}
