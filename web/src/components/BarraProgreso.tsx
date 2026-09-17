import { cx } from '../lib/classNames';
import { varsCss } from '../lib/cssVars';
import { acotarPorcentaje } from '../lib/formato';
import styles from './BarraProgreso.module.css';

/** Un escalón por token `--alto-barra-progreso-*`. */
export type AltoBarra = 'sm' | 'md' | 'lg';

/** `superficie`: carril gris sobre una card clara. `sobrePrimario`: sobre el azul de marca. */
export type FondoBarra = 'superficie' | 'sobrePrimario';

export type RellenoBarra = 'secundario' | 'primarioSuave' | 'degradado';

interface BarraProgresoProps {
  /** Lo que caiga fuera de 0 a 100 se recorta; no se redondea. */
  porcentaje: number;
  alto: AltoBarra;
  fondo?: FondoBarra;
  relleno?: RellenoBarra;
  /** Color por instancia (el de cada especie); pisa a `relleno`. */
  color?: string;
}

export function BarraProgreso(props: BarraProgresoProps) {
  const { porcentaje, alto, fondo = 'superficie', relleno = 'secundario', color } = props;
  const ancho = `${acotarPorcentaje(porcentaje)}%`;
  return (
    <div className={cx(styles.barra, styles[alto], styles[fondo])}>
      <div
        className={cx(styles.relleno, color ? styles.colorPropio : styles[relleno])}
        style={varsCss(color ? { ancho, color } : { ancho })}
      />
    </div>
  );
}
