import type { ReactNode } from 'react';
import { useLocation } from 'react-router';
import { BarraHerramientas, SegmentedControl, type Opcion } from '../../components';
import { SEGMENTO_DATOS, type SegmentoDatos } from '../../lib/rutas';
import { filtrosAlCambiarDeSeccion } from './filtrosUrl';
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
  /** Buscador de la sección, a la vista después del selector. */
  busqueda?: ReactNode;
  /** Filtros propios de la sección, en el panel de filtros. */
  children?: ReactNode;
  /** Nombre del panel de filtros. */
  tituloFiltros?: string;
  filtrosActivos?: number;
  onLimpiar?: () => void;
  /** Botones sobre el listado, al final de la fila. */
  acciones?: ReactNode;
}

function SelectorSeccion({ segmento }: { segmento: SegmentoDatos }) {
  const irA = useIrASeccion();
  const location = useLocation();
  const cambiar = (proximo: SegmentoDatos) =>
    irA(proximo, filtrosAlCambiarDeSeccion(location.search));
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
 * Toolbar de la tab Datos: selector de sección + buscador + filtros + recuento.
 * Árboles no pasa `recuento`: su pie ya dice "Mostrando 1–30 de 30" y tiene la
 * paginación.
 */
export function DatosToolbar(props: DatosToolbarProps) {
  const { segmento, recuento, children, tituloFiltros = 'Filtros', ...resto } = props;
  return (
    <BarraHerramientas
      encabezado={<SelectorSeccion segmento={segmento} />}
      busqueda={resto.busqueda}
      recuento={recuento}
      acciones={resto.acciones}
      tituloFiltros={tituloFiltros}
      filtrosActivos={resto.filtrosActivos ?? 0}
      onLimpiar={resto.onLimpiar}
    >
      {children}
    </BarraHerramientas>
  );
}
