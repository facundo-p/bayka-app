import type { ComponentProps } from 'react';
import { Check, Minus } from 'lucide-react';
import { cx } from '../lib/classNames';
import { TAMANO_ICONO } from '../theme/iconos';
import styles from './Casilla.module.css';

/** Más grueso que el default de lucide: a 14px el tilde fino no se lee sobre el fondo marcado. */
const GROSOR_TILDE = 3;

interface CasillaProps {
  marcada: boolean;
  /** Maestro con algunas filas marcadas: guion en vez de tilde. */
  parcial?: boolean;
}

/** Dibujo del checkbox. El color marcado sale de `--casilla-color`, así cada lista usa el suyo. */
function Casilla({ marcada, parcial = false }: CasillaProps) {
  return (
    <span className={cx(styles.casilla, (marcada || parcial) && styles.marcada)} aria-hidden>
      {parcial ? (
        <Minus size={TAMANO_ICONO.sm} strokeWidth={GROSOR_TILDE} />
      ) : (
        marcada && <Check size={TAMANO_ICONO.sm} strokeWidth={GROSOR_TILDE} />
      )}
    </span>
  );
}

type BotonCasillaProps = CasillaProps &
  Omit<ComponentProps<'button'>, 'type' | 'role' | 'aria-checked'>;

/** Botón con rol de checkbox: la casilla y, detrás, lo que reciba como hijos. */
export function BotonCasilla({ marcada, parcial = false, children, ...resto }: BotonCasillaProps) {
  return (
    <button type="button" role="checkbox" aria-checked={parcial ? 'mixed' : marcada} {...resto}>
      <Casilla marcada={marcada} parcial={parcial} />
      {children}
    </button>
  );
}
