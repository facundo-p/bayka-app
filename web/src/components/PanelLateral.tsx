import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from '../lib/classNames';
import { useCerrarConEscape } from '../hooks/useCerrarConEscape';
import styles from './PanelLateral.module.css';

const TAMANO_ICONO_CERRAR = 18;

interface PanelLateralProps {
  /** Identidad del encabezado: punto/avatar + título + meta. */
  cabecera: ReactNode;
  /** Botones del pie; sin pie el panel es de solo lectura. */
  pie?: ReactNode;
  /** Nombre accesible del panel y del botón de cierre. */
  etiqueta: string;
  onCerrar: () => void;
  children: ReactNode;
}

/**
 * Columna de detalle al costado de un listado. No es un modal: no tiene
 * overlay, no atrapa el foco y no cierra al clickear afuera — clickear otra
 * fila cambia el panel en vez de cerrarlo. Cierra con Escape o con la X.
 */
export function PanelLateral({ cabecera, pie, etiqueta, onCerrar, children }: PanelLateralProps) {
  useCerrarConEscape(true, onCerrar);
  return (
    <aside className={styles.panel} aria-label={etiqueta}>
      <div className={styles.cabecera}>
        <div className={styles.identidad}>{cabecera}</div>
        <button
          type="button"
          className={styles.cerrar}
          aria-label={`Cerrar ${etiqueta}`}
          onClick={onCerrar}
        >
          <X size={TAMANO_ICONO_CERRAR} aria-hidden />
        </button>
      </div>
      <div className={styles.cuerpo}>{children}</div>
      {pie && <div className={styles.pie}>{pie}</div>}
    </aside>
  );
}

/**
 * Grilla listado + panel: el listado ocupa todo el ancho hasta que hay panel.
 * Acá y no en cada pantalla, para no repetir la misma grilla en las tres.
 */
export function LayoutConPanel({ panel, children }: { panel?: ReactNode; children: ReactNode }) {
  return (
    <div className={cx(styles.layout, Boolean(panel) && styles.layoutConPanel)}>
      {children}
      {panel}
    </div>
  );
}
