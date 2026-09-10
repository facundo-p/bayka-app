import { Check } from 'lucide-react';
import { cx } from '../../lib/classNames';
import type { PropsOpcion } from '../../hooks/useListboxNavegable';
import type { OpcionConDetalle } from './opcionesConDetalle';
import { TextoOpcion } from './TextoOpcion';
import { TAMANO_ICONO } from '../../theme/iconos';
import styles from './SelectConDetalle.module.css';

interface FilaOpcionProps {
  opcion: OpcionConDetalle;
  elegida: boolean;
  propsOpcion: PropsOpcion;
  onElegir: () => void;
}

export function FilaOpcion({ opcion, elegida, propsOpcion, onElegir }: FilaOpcionProps) {
  return (
    <div
      {...propsOpcion}
      className={cx(styles.opcion, propsOpcion['aria-selected'] && styles.opcionResaltada)}
      // Sin esto el mousedown le saca el foco al buscador antes del click.
      onMouseDown={(evento) => evento.preventDefault()}
      onClick={onElegir}
    >
      <span className={styles.opcionTexto}>
        <TextoOpcion
          opcion={opcion}
          clasePrincipal={cx(styles.opcionPrincipal, elegida && styles.opcionElegida)}
          claseSecundario={styles.opcionSecundario}
        />
      </span>
      {elegida && <Check size={TAMANO_ICONO.md} aria-hidden className={styles.check} />}
    </div>
  );
}
