import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cx } from '../lib/classNames';
import { useCerrarConEscape } from '../hooks/useCerrarConEscape';
import { TAMANO_ICONO } from '../theme/iconos';
import { BotonIcono } from './BotonIcono';
import styles from './PanelLateral.module.css';

interface PanelLateralProps {
  /** Identidad del encabezado, normalmente un PanelIdentidad. */
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
        <BotonIcono
          variante="fantasma"
          tamano="sm"
          etiqueta={`Cerrar ${etiqueta}`}
          onClick={onCerrar}
        >
          <X size={TAMANO_ICONO.lg} aria-hidden />
        </BotonIcono>
      </div>
      <div className={styles.cuerpo}>{children}</div>
      {pie && <div className={styles.pie}>{pie}</div>}
    </aside>
  );
}

interface PanelIdentidadProps {
  /** Punto de color o avatar, a la izquierda del título. */
  marca: ReactNode;
  titulo: string;
  /** Renglón tenue bajo el título. */
  meta?: ReactNode;
  /** Al lado del título, en su mismo renglón (ej. el chip con el código). */
  complemento?: ReactNode;
}

/** Cabecera del panel: marca + título, con meta debajo o complemento al lado. */
export function PanelIdentidad({ marca, titulo, meta, complemento }: PanelIdentidadProps) {
  const encabezado = <h2 className={styles.identidadTitulo}>{titulo}</h2>;
  return (
    <div className={cx(styles.identidadFila, meta !== undefined && styles.identidadConMeta)}>
      {marca}
      {meta === undefined ? (
        encabezado
      ) : (
        <span className={styles.identidadTextos}>
          {encabezado}
          <span className={styles.identidadMeta}>{meta}</span>
        </span>
      )}
      {complemento}
    </div>
  );
}

interface PanelBloqueProps {
  titulo: string;
  /** Número a la derecha del rótulo (ej. cuántas plantaciones). */
  contador?: number;
  children: ReactNode;
}

/** Bloque de contexto del cuerpo del panel: rótulo arriba, contenido debajo. */
export function PanelBloque({ titulo, contador, children }: PanelBloqueProps) {
  const rotulo = <span className={styles.bloqueTitulo}>{titulo}</span>;
  return (
    <div className={styles.bloque}>
      {contador === undefined ? (
        rotulo
      ) : (
        <div className={styles.bloqueCabecera}>
          {rotulo}
          <span className={styles.bloqueContador}>{contador}</span>
        </div>
      )}
      {children}
    </div>
  );
}

export interface EnlacePanel {
  clave: string;
  ruta: string;
  texto: string;
  /** Dato corto a la derecha (ej. árboles o rol). */
  detalle: string;
}

/** Lista de enlaces con un dato a la derecha; el texto largo se elide. */
export function PanelListaEnlaces({
  enlaces,
  detalleNumerico = false,
}: {
  enlaces: EnlacePanel[];
  /** Mono y de ancho fijo, para que los números se alineen. */
  detalleNumerico?: boolean;
}) {
  const claseDetalle = cx(styles.enlaceDetalle, detalleNumerico && styles.enlaceDetalleNumerico);
  return (
    <ul className={styles.enlaces}>
      {enlaces.map((enlace) => (
        <li key={enlace.clave} className={styles.enlaceFila}>
          <Link to={enlace.ruta} className={styles.enlace}>
            {enlace.texto}
          </Link>
          <span className={claseDetalle}>{enlace.detalle}</span>
        </li>
      ))}
    </ul>
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
