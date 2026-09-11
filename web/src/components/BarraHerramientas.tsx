import type { ReactNode } from 'react';
import { concordar, formatearEntero } from '../lib/formato';
import { Divisor } from './Divisor';
import styles from './BarraHerramientas.module.css';

interface BarraHerramientasProps {
  /** Bloque que abre la barra: el buscador, o el selector de sección en Datos.
   *  Un divisor lo separa de los filtros. */
  encabezado?: ReactNode;
  /** Filtros y selectores propios de la pantalla. */
  children?: ReactNode;
  /** Recuento de lo que quedó visible, pegado a la derecha. */
  recuento?: ReactNode;
}

/**
 * Fila de herramientas compartida por los listados (Plantaciones, Datos,
 * Especies, Usuarios). Antes era el mismo bloque de CSS copiado en los cuatro
 * módulos: un cambio de estilo obligaba a tocar cuatro archivos.
 */
export function BarraHerramientas({ encabezado, children, recuento }: BarraHerramientasProps) {
  return (
    <div className={styles.barra}>
      {encabezado}
      {encabezado && children && <Divisor />}
      {children}
      {recuento && <span className={styles.recuento}>{recuento}</span>}
    </div>
  );
}

/** Número destacado dentro del recuento: mono, para que alinee entre pantallas. */
export function RecuentoNumero({ children }: { children: ReactNode }) {
  return <strong className={styles.recuentoNumero}>{children}</strong>;
}

interface RecuentoItemProps {
  cantidad: number;
  singular: string;
  plural: string;
}

/** Un término del recuento: la cifra en mono, para que alinee entre pantallas,
 *  y el sustantivo concordado. */
export function RecuentoItem({ cantidad, singular, plural }: RecuentoItemProps) {
  return (
    <>
      <strong className={styles.recuentoNumero}>{formatearEntero(cantidad)}</strong>{' '}
      {concordar(cantidad, singular, plural)}
    </>
  );
}
