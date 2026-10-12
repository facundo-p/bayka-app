import { cx } from '../lib/classNames';
import { varsCss } from '../lib/cssVars';
import { acotarPorcentaje, PORCENTAJE_COMPLETO } from '../lib/formato';
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
  /**
   * Con nombre es un `progressbar` que leen los lectores de pantalla; sin él,
   * acompaña a un número que ya está a la vista y queda como dibujo.
   */
  nombre?: string;
}

function rolDeProgreso(nombre: string | undefined, porcentaje: number) {
  if (!nombre) return {};
  return {
    role: 'progressbar',
    'aria-label': nombre,
    'aria-valuemin': 0,
    'aria-valuemax': PORCENTAJE_COMPLETO,
    'aria-valuenow': Math.round(porcentaje),
  };
}

export function BarraProgreso(props: BarraProgresoProps) {
  const { porcentaje, alto, fondo = 'superficie', relleno = 'secundario', color, nombre } = props;
  const acotado = acotarPorcentaje(porcentaje);
  const ancho = `${acotado}%`;
  return (
    <div
      className={cx(styles.barra, styles[alto], styles[fondo])}
      {...rolDeProgreso(nombre, acotado)}
    >
      <div
        className={cx(styles.relleno, color ? styles.colorPropio : styles[relleno])}
        style={varsCss(color ? { ancho, color } : { ancho })}
      />
    </div>
  );
}
