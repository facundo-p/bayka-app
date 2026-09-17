import type { ComponentProps } from 'react';
import { cx } from '../lib/classNames';
import styles from './BotonIcono.module.css';

type BotonIconoProps = Omit<ComponentProps<'button'>, 'aria-label' | 'className'> & {
  /** Nombre accesible: el botón no tiene texto visible. */
  etiqueta: string;
  /** `fantasma`: sin borde ni fondo. `contorno`: borde sobre blanco.
   *  `contornoTransparente`: borde sobre el fondo de lo que lo contiene. */
  variante: 'fantasma' | 'contorno' | 'contornoTransparente';
  /** Caja fija de control. Sin tamaño, la caja es el ícono con un aro. */
  tamano?: 'sm' | 'md';
  /** Quitar o borrar: el hover lo avisa en rojo. */
  destructiva?: boolean;
};

/** Botón de solo ícono. El ícono va como children. */
export function BotonIcono({
  etiqueta,
  variante,
  tamano,
  destructiva = false,
  type = 'button',
  children,
  ...rest
}: BotonIconoProps) {
  const clase = cx(
    styles.boton,
    styles[variante],
    tamano && styles[tamano],
    destructiva && styles.destructiva,
  );
  return (
    <button type={type} aria-label={etiqueta} className={clase} {...rest}>
      {children}
    </button>
  );
}
