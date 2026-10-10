import { Sprout } from 'lucide-react';
import tabla from '../../components/Table.module.css';
import { cx } from '../../lib/classNames';
import { formatearEntero } from '../../lib/formato';
import { TAMANO_ICONO } from '../../theme/iconos';
import styles from './Plantaciones.module.css';

/** Lugar de la plantación: ícono en caja suave + nombre. */
export function CeldaLugar({ lugar }: { lugar: string }) {
  return (
    <span className={styles.celdaLugar}>
      <span className={styles.iconoLugar}>
        <Sprout size={TAMANO_ICONO.md} aria-hidden />
      </span>
      <span className={styles.lugarTexto}>{lugar}</span>
    </span>
  );
}

/** Conteo de la fila, con separador de miles. */
export function CeldaConteo({ cantidad, className }: { cantidad: number; className?: string }) {
  return (
    <span className={cx(tabla.mono, tabla.numero, className)}>{formatearEntero(cantidad)}</span>
  );
}
