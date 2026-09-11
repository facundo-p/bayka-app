import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { BarraHerramientas, SegmentedControl } from '../../components';
import { rutaSeccion, SEGMENTO_DATOS, type SegmentoDatos } from './seccionesDatos';

const OPCIONES: Array<{ value: SegmentoDatos; label: string }> = [
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

/**
 * Toolbar de la tab Datos: selector de sección + filtros + recuento. Árboles no
 * pasa `recuento`: su pie ya dice "Mostrando 1–30 de 30" y tiene la paginación.
 */
export function DatosToolbar({ segmento, recuento, children }: DatosToolbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  // Los filtros viajan en el querystring: sobreviven al cambio de sección.
  const cambiarSegmento = (proximo: SegmentoDatos) =>
    void navigate(rutaSeccion(proximo, new URLSearchParams(location.search)));

  return (
    <BarraHerramientas
      encabezado={
        <SegmentedControl
          options={OPCIONES}
          value={segmento}
          onChange={cambiarSegmento}
          size="sm"
          aria-label="Sección de datos"
        />
      }
      recuento={recuento}
    >
      {children}
    </BarraHerramientas>
  );
}
