import { Eye, Sprout } from 'lucide-react';
import { Badge } from '../../components';
import styles from './Plantaciones.module.css';

const TAMANO_ICONO = 16;

/** Lugar de la plantación: ícono en caja suave + nombre. */
export function CeldaLugar({ lugar }: { lugar: string }) {
  return (
    <span className={styles.celdaLugar}>
      <span className={styles.iconoLugar}>
        <Sprout size={TAMANO_ICONO} aria-hidden />
      </span>
      <span className={styles.lugarTexto}>{lugar}</span>
    </span>
  );
}

/** Visibilidad en la app móvil: ojo + "Sí", o badge cuando está oculta. */
export function CeldaVisible({ visible }: { visible: boolean }) {
  if (!visible) return <Badge variant="neutral">Oculta</Badge>;
  return (
    <span className={styles.visibleSi}>
      <Eye size={TAMANO_ICONO} aria-hidden />
      Sí
    </span>
  );
}
