import type { ComponentProps, ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { usePopoverAnclado } from '../hooks/usePopoverAnclado';
import { cx } from '../lib/classNames';
import { TAMANO_ICONO } from '../theme/iconos';
import { Button } from './Button';
import styles from './PanelFiltros.module.css';

type BotonFiltrosProps = Omit<ComponentProps<typeof Button>, 'children' | 'variant'> & {
  activos: number;
};

/** «Filtros» con la cuenta de los que están puestos: abre la hoja o el panel. */
export function BotonFiltros({ activos, ...boton }: BotonFiltrosProps) {
  return (
    <Button variant="contorno" {...boton}>
      <SlidersHorizontal size={TAMANO_ICONO.md} aria-hidden />
      Filtros
      {activos > 0 && <span className={styles.cuenta}>{activos}</span>}
    </Button>
  );
}

interface PieProps {
  activos: number;
  onLimpiar?: () => void;
  recuento?: ReactNode;
}

function Pie({ activos, onLimpiar, recuento }: PieProps) {
  if (!onLimpiar && !recuento) return null;
  return (
    <div className={styles.pie}>
      {onLimpiar && (
        <Button variant="contorno" size="sm" disabled={activos === 0} onClick={onLimpiar}>
          Limpiar
        </Button>
      )}
      {recuento && <span className={styles.recuento}>{recuento}</span>}
    </div>
  );
}

interface PanelFiltrosProps extends PieProps {
  /** Nombre accesible del panel. */
  titulo: string;
  children: ReactNode;
}

type Popover = ReturnType<typeof usePopoverAnclado>;

/** Limpiar deshabilita su propio botón: el foco pasa al primer filtro en vez de perderse. */
function conFocoAlLimpiar(popover: Popover, onLimpiar?: () => void) {
  if (!onLimpiar) return undefined;
  return () => {
    onLimpiar();
    popover.enfocarPrimero();
  };
}

function Caja({ popover, titulo, children, ...pie }: PanelFiltrosProps & { popover: Popover }) {
  return (
    <div
      ref={popover.refs.panel}
      id={popover.idPanel}
      role="dialog"
      aria-label={titulo}
      className={cx(styles.panel, styles[popover.lado])}
    >
      <p className={styles.cabecera}>
        <span className={styles.titulo}>Filtros</span> se aplican al toque
      </p>
      <div className={styles.cuerpo}>{children}</div>
      <Pie {...pie} onLimpiar={conFocoAlLimpiar(popover, pie.onLimpiar)} />
    </div>
  );
}

/**
 * Los filtros de una barra, detrás de un botón que abre un popover anclado
 * (#844). Se aplican al toque, como en la hoja del teléfono: el pie solo
 * limpia y muestra cuánto quedó.
 */
export function PanelFiltros(props: PanelFiltrosProps) {
  const popover = usePopoverAnclado();
  return (
    <div
      ref={popover.refs.contenedor}
      className={styles.ancla}
      onKeyDown={popover.alTeclear}
      onBlur={popover.alPerderFoco}
    >
      <BotonFiltros
        ref={popover.refs.disparador}
        size="sm"
        className={styles.disparador}
        activos={props.activos}
        aria-haspopup="dialog"
        aria-expanded={popover.abierto}
        aria-controls={popover.abierto ? popover.idPanel : undefined}
        onClick={popover.alternar}
      />
      {popover.abierto && <Caja popover={popover} {...props} />}
    </div>
  );
}
