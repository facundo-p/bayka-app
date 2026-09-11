import { useNavigate } from 'react-router';
import { CardTabla, Table } from '../../components';
import { useColumnasVisibles } from '../../hooks/useColumnasVisibles';
import { pluralizar } from '../../lib/formato';
import { rutaPlantacion } from '../../lib/rutas';
import { SUSTANTIVO } from '../../lib/sustantivos';
import type { PlantacionConStats } from '../../queries/plantationQueries';
import { COLUMNAS_PLANTACIONES } from './columnas';

const PIE_AYUDA = 'clic en una fila abre el detalle';
const PIE_NOTA = 'Las plantaciones ocultas en la app aparecen marcadas';

/** Tabla de plantaciones: cada fila lleva a su detalle. */
export function ListadoPlantaciones({ visibles }: { visibles: PlantacionConStats[] }) {
  const navigate = useNavigate();
  const columnas = useColumnasVisibles(COLUMNAS_PLANTACIONES);
  return (
    <CardTabla
      pie={`${pluralizar(visibles.length, SUSTANTIVO.plantacion)} · ${PIE_AYUDA}`}
      pieDerecha={PIE_NOTA}
    >
      <Table
        columns={columnas}
        rows={visibles}
        getRowKey={(plantacion) => plantacion.id}
        onRowClick={(plantacion) => void navigate(rutaPlantacion(plantacion.id))}
        emptyMessage="Ninguna plantación coincide con los filtros"
      />
    </CardTabla>
  );
}
