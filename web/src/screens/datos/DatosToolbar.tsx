import type { ReactNode } from 'react';
import { useLocation } from 'react-router';
import { BarraHerramientas, SegmentedControl, type Opcion } from '../../components';
import { SEGMENTO_DATOS, type SegmentoDatos } from '../../lib/rutasPlantacion';
import { useIrASeccion } from './useIrASeccion';

const OPCIONES: ReadonlyArray<Opcion<SegmentoDatos>> = [
  { value: SEGMENTO_DATOS.parcelas, label: 'Parcelas' },
  { value: SEGMENTO_DATOS.grupos, label: 'Grupos' },
  { value: SEGMENTO_DATOS.arboles, label: 'Árboles' },
];

interface DatosToolbarProps {
  segmento: SegmentoDatos;
  /** Texto del recuento a la derecha, ej. "7.642 árboles". */
  recuento?: string;
  /** Filtros propios de la sección, en línea dentro de la toolbar. */
  children?: ReactNode;
}

function SelectorSeccion({ segmento }: { segmento: SegmentoDatos }) {
  const irA = useIrASeccion();
  const location = useLocation();
  // Los filtros viajan en el querystring: sobreviven al cambio de sección.
  const cambiar = (proximo: SegmentoDatos) => irA(proximo, new URLSearchParams(location.search));
  return (
    <SegmentedControl
      options={OPCIONES}
      value={segmento}
      onChange={cambiar}
      size="sm"
      aria-label="Sección de datos"
    />
  );
}

/**
 * Toolbar de la tab Datos: selector de sección + filtros + recuento. Árboles no
 * pasa `recuento`: su pie ya dice "Mostrando 1–30 de 30" y tiene la paginación.
 */
export function DatosToolbar({ segmento, recuento, children }: DatosToolbarProps) {
  return (
    <BarraHerramientas encabezado={<SelectorSeccion segmento={segmento} />} recuento={recuento}>
      {children}
    </BarraHerramientas>
  );
}
