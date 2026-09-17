import { Eye, Sprout } from 'lucide-react';
import { Badge } from '../../components';
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

/** Visibilidad en la app móvil: ojo + "Sí", o badge cuando está oculta. */
export function CeldaVisible({ visible }: { visible: boolean }) {
  if (!visible) return <Badge variant="neutral">Oculta</Badge>;
  return (
    <span className={styles.visibleSi}>
      <Eye size={TAMANO_ICONO.md} aria-hidden />
      Sí
    </span>
  );
}
