import { useNavigate } from 'react-router';
import { CardTabla, Table } from '../../components';
import { useColumnasVisibles } from '../../hooks/useColumnasVisibles';
import { AYUDA_FILA } from '../../lib/ayudaFila';
import { pluralizar } from '../../lib/formato';
import { rutaPlantacion } from '../../lib/rutas';
import { SUSTANTIVO } from '../../lib/sustantivos';
import type { PlantacionConStats } from '../../queries/plantationQueries';
import { COLUMNAS_PLANTACIONES } from './columnas';

/** Tabla de plantaciones: cada fila lleva a su detalle. */
export function ListadoPlantaciones({ visibles }: { visibles: PlantacionConStats[] }) {
  const navigate = useNavigate();
  const columnas = useColumnasVisibles(COLUMNAS_PLANTACIONES);
  return (
    <CardTabla
      pie={`${pluralizar(visibles.length, SUSTANTIVO.plantacion)} · ${AYUDA_FILA.detalle}`}
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
