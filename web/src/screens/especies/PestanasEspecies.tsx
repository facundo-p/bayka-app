import { TabNav, type TabItem } from '../../components';
import { RUTA } from '../../lib/rutas';

const PESTANAS: TabItem[] = [
  { to: RUTA.especies, label: 'Comunes', end: true },
  { to: RUTA.especiesCientificas, label: 'Científicas' },
];

/** Especies comunes y científicas (#753): dos listados del mismo catálogo. */
export function PestanasEspecies() {
  return <TabNav label="Catálogos de especies" tabs={PESTANAS} />;
}
