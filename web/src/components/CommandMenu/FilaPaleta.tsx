import { cx } from '../../lib/classNames';
import type { PropsOpcion } from '../../hooks/useListboxNavegable';
import { metaDeTipo } from './tiposResultado';
import type { ItemPaleta } from './construirItems';
import styles from './CommandMenu.module.css';

const TAMANO_ICONO = 16;

interface FilaPaletaProps {
  item: ItemPaleta;
  propsOpcion: PropsOpcion;
  onElegir: () => void;
}

/** Título, meta y posición de la fila según sea acción o resultado de entidad. */
function contenidoFila(item: ItemPaleta) {
  if (item.clase === 'accion') {
    const { Icono, titulo } = item.accion;
    return { Icono, titulo, meta: undefined as string | undefined };
  }
  const { Icono } = metaDeTipo(item.resultado.tipo);
  return { Icono, titulo: item.resultado.titulo, meta: item.resultado.meta };
}

export function FilaPaleta({ item, propsOpcion, onElegir }: FilaPaletaProps) {
  const { Icono, titulo, meta } = contenidoFila(item);
  return (
    <button
      {...propsOpcion}
      type="button"
      className={cx(styles.fila, propsOpcion['aria-selected'] && styles.filaResaltada)}
      onClick={onElegir}
    >
      <Icono size={TAMANO_ICONO} aria-hidden className={styles.filaIcono} />
      <span className={styles.filaTitulo}>{titulo}</span>
      {meta && <span className={styles.filaMeta}>{meta}</span>}
    </button>
  );
}
