import { Outlet, useParams } from 'react-router';
import { TabNav, type TabItem } from '../../components';

function subTabsDeDatos(plantationId: string): TabItem[] {
  const base = `/plantaciones/${plantationId}/datos`;
  return [
    { to: `${base}/parcelas`, label: 'Parcelas' },
    { to: `${base}/grupos`, label: 'Grupos' },
    { to: `${base}/arboles`, label: 'Árboles' },
  ];
}

/** Tab Datos del detalle de plantación: sub-tabs Parcelas / Grupos / Árboles. */
export function DatosTab() {
  const { id = '' } = useParams();
  return (
    <section>
      <TabNav variant="secundaria" label="Datos de la plantación" tabs={subTabsDeDatos(id)} />
      <Outlet />
    </section>
  );
}
