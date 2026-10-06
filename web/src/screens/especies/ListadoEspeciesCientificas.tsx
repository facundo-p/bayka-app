import { CardTabla, LayoutConPanel, Table } from '../../components';
import { useColumnasVisibles } from '../../hooks/useColumnasVisibles';
import { pluralizar } from '../../lib/formato';
import { SUSTANTIVO } from '../../lib/sustantivos';
import type { EspecieCientificaConEspecies } from '../../queries/especieCientificaQueries';
import { COLUMNAS_CIENTIFICAS } from './columnasCientificas';
import { EspecieCientificaPanel } from './EspecieCientificaPanel';

const PIE_AYUDA = 'clic en una fila abre la edición en el panel lateral';
const PIE_NOTA = 'Las que no agrupan ninguna especie aparecen atenuadas';

/** Selección del panel: una especie científica a editar, o el alta. */
export type SeleccionCientifica = { cientifica: EspecieCientificaConEspecies | null };

interface ListadoEspeciesCientificasProps {
  visibles: EspecieCientificaConEspecies[];
  seleccion: SeleccionCientifica | null;
  onSeleccionar: (seleccion: SeleccionCientifica | null) => void;
}

/** Tabla de especies científicas con el panel de edición al costado (#753). */
export function ListadoEspeciesCientificas({
  visibles,
  seleccion,
  onSeleccionar,
}: ListadoEspeciesCientificasProps) {
  const columnas = useColumnasVisibles(COLUMNAS_CIENTIFICAS, seleccion !== null);
  const panel = seleccion && (
    <EspecieCientificaPanel
      // Remonta el panel al cambiar de fila: el campo se reinicializa.
      key={seleccion.cientifica?.id ?? 'alta'}
      cientifica={seleccion.cientifica}
      onCerrar={() => onSeleccionar(null)}
    />
  );
  return (
    <LayoutConPanel panel={panel}>
      <CardTabla
        pie={`${pluralizar(visibles.length, SUSTANTIVO.especieCientifica)} · ${PIE_AYUDA}`}
        pieDerecha={PIE_NOTA}
      >
        <Table
          columns={columnas}
          rows={visibles}
          getRowKey={(cientifica) => cientifica.id}
          claveSeleccionada={seleccion?.cientifica?.id}
          onRowClick={(cientifica) => onSeleccionar({ cientifica })}
          emptyMessage="No hay especies científicas que coincidan con la búsqueda"
        />
      </CardTabla>
    </LayoutConPanel>
  );
}
