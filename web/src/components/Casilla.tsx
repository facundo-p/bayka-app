import { Check, Minus } from 'lucide-react';
import { cx } from '../lib/classNames';
import { esParcial, estanTodas, type EstadoMaestro } from '../lib/seleccionMaestro';
import { TAMANO_ICONO } from '../theme/iconos';
import styles from './Casilla.module.css';

/** Más grueso que el default de lucide: a 14px el tilde fino no se lee sobre el fondo marcado. */
const GROSOR_TILDE = 3;

interface CasillaProps {
  marcada: boolean;
  /** Maestro con algunas filas marcadas: guion en vez de tilde. */
  parcial?: boolean;
}

/**
 * Dibujo del checkbox; el rol y el click los pone el botón que la contiene. El
 * color marcado sale de `--casilla-color`, así cada lista usa el suyo.
 */
export function Casilla({ marcada, parcial = false }: CasillaProps) {
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

export function CasillaMaestro({ estado }: { estado: EstadoMaestro }) {
  return <Casilla marcada={estanTodas(estado)} parcial={esParcial(estado)} />;
}
