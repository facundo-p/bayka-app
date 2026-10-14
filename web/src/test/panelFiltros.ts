import { fireEvent, screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

const BOTON_FILTROS = { name: /^Filtros/ };
const PANEL_FILTROS = { name: /^Filtros/ };

/**
 * Abre el panel de filtros de la barra y devuelve consultas acotadas a él. Los
 * filtros se aplican al toque y el panel sigue abierto: se puede seguir usando.
 */
export async function abrirFiltros(usuario: UserEvent) {
  await usuario.click(screen.getByRole('button', BOTON_FILTROS));
  return within(screen.getByRole('dialog', PANEL_FILTROS));
}

/** Lo mismo con `fireEvent`, para los tests que no usan user-event. */
export function abrirFiltrosSincronico() {
  fireEvent.click(screen.getByRole('button', BOTON_FILTROS));
  return within(screen.getByRole('dialog', PANEL_FILTROS));
}
