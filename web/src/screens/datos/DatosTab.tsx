import { Outlet } from 'react-router';

/**
 * Tab Datos del detalle de plantación. Los sub-tabs Árboles / Grupos / Parcelas
 * y sus filtros viven ahora en la toolbar única de cada sección (DatosToolbar).
 */
export function DatosTab() {
  return (
    <section>
      <Outlet />
    </section>
  );
}
