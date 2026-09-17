import { CardTabla, LayoutConPanel, Table } from '../../components';
import { useColumnasVisibles } from '../../hooks/useColumnasVisibles';
import { pluralizar } from '../../lib/formato';
import { SUSTANTIVO } from '../../lib/sustantivos';
import type { EspecieConCatalogoUso } from '../../queries/especieQueries';
import { COLUMNAS_ESPECIES } from './columnas';
import { EspeciePanel } from './EspeciePanel';

const PIE_AYUDA = 'clic en una fila abre la edición en el panel lateral';
const PIE_NOTA = 'Las especies sin uso aparecen atenuadas';

/** Selección del panel: una especie a editar, o el alta (panel vacío). */
export type Seleccion = { especie: EspecieConCatalogoUso | null };

interface ListadoEspeciesProps {
  visibles: EspecieConCatalogoUso[];
  seleccion: Seleccion | null;
  onSeleccionar: (seleccion: Seleccion | null) => void;
}

/** Tabla del catálogo con el panel de edición al costado. */
export function ListadoEspecies({ visibles, seleccion, onSeleccionar }: ListadoEspeciesProps) {
  const columnas = useColumnasVisibles(COLUMNAS_ESPECIES);
  const panel = seleccion && (
    <EspeciePanel
      // Remonta el panel al cambiar de especie: los campos se reinicializan
      // con el estado de la nueva fila.
      key={seleccion.especie?.id ?? 'alta'}
      especie={seleccion.especie}
      onCerrar={() => onSeleccionar(null)}
    />
  );
  return (
    <LayoutConPanel panel={panel}>
      <CardTabla
        pie={`${pluralizar(visibles.length, SUSTANTIVO.especie)} · ${PIE_AYUDA}`}
        pieDerecha={PIE_NOTA}
      >
        <Table
          columns={columnas}
          rows={visibles}
          getRowKey={(especie) => especie.id}
          claveSeleccionada={seleccion?.especie?.id}
          onRowClick={(especie) => onSeleccionar({ especie })}
          emptyMessage="No hay especies que coincidan con la búsqueda"
        />
      </CardTabla>
    </LayoutConPanel>
  );
}
