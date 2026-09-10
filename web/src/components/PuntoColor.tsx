import { cx } from '../lib/classNames';
import { varsCss } from '../lib/cssVars';
import styles from './PuntoColor.module.css';

interface PuntoColorProps {
  color: string;
  /** `lg`: paneles y leyenda del mapa; `md`, tablas. */
  tamano?: 'md' | 'lg';
  /** Borde blanco y anillo, como los marcadores del mapa. */
  conAro?: boolean;
  /** Solo para separarlo del texto cuando no está dentro de un flex. */
  className?: string;
}

/** Punto de color que precede al nombre de una especie. */
export function PuntoColor({ color, tamano = 'md', conAro = false, className }: PuntoColorProps) {
  return (
    <span
      className={cx(styles.punto, tamano === 'lg' && styles.lg, conAro && styles.aro, className)}
      style={varsCss({ color })}
      aria-hidden
    />
  );
}
