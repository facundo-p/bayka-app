import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { SegmentedControl } from '../../components';
import styles from './SeccionesDatos.module.css';

/** Sección activa de la tab Datos (coincide con el sub-segmento de la ruta). */
export type SegmentoDatos = 'arboles' | 'grupos' | 'parcelas';

const OPCIONES: Array<{ value: SegmentoDatos; label: string }> = [
  { value: 'arboles', label: 'Árboles' },
  { value: 'grupos', label: 'Grupos' },
  { value: 'parcelas', label: 'Parcelas' },
];

interface DatosToolbarProps {
  segmento: SegmentoDatos;
  /** Texto del recuento a la derecha, ej. "7.642 árboles". */
  recuento?: string;
  /** Filtros propios de la sección, en línea dentro de la toolbar. */
  children?: ReactNode;
}

/**
 * Toolbar única de la tab Datos: selector de sección + filtros + recuento.
 * Reemplaza al sub-TabNav apilado para ganar densidad (un solo renglón).
 */
export function DatosToolbar({ segmento, recuento, children }: DatosToolbarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Navega a la sección hermana conservando el querystring (filtros + scope).
  const cambiarSegmento = (proximo: SegmentoDatos) => {
    void navigate(`../${proximo}${location.search}`);
  };

  return (
    <div className={styles.toolbar}>
      <SegmentedControl
        options={OPCIONES}
        value={segmento}
        onChange={cambiarSegmento}
        size="sm"
        aria-label="Sección de datos"
      />
      {children && <span className={styles.divisor} aria-hidden="true" />}
      {children}
      {recuento && <span className={styles.recuento}>{recuento}</span>}
    </div>
  );
}
