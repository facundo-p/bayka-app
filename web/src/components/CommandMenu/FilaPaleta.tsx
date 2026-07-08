import { cx } from '../../lib/classNames';
import { metaDeTipo } from './tiposResultado';
import type { ItemPaleta } from './construirItems';
import styles from './CommandMenu.module.css';

const TAMANO_ICONO = 16;

interface FilaPaletaProps {
  /** Id único y estable de la opción, para aria-activedescendant del input. */
  id: string;
  item: ItemPaleta;
  resaltado: boolean;
  onElegir: () => void;
  onResaltar: () => void;
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

export function FilaPaleta({ id, item, resaltado, onElegir, onResaltar }: FilaPaletaProps) {
  const { Icono, titulo, meta } = contenidoFila(item);
  return (
    <button
      id={id}
      type="button"
      role="option"
      aria-selected={resaltado}
      data-resaltado={resaltado}
      className={cx(styles.fila, resaltado && styles.filaResaltada)}
      onClick={onElegir}
      onMouseMove={onResaltar}
    >
      <Icono size={TAMANO_ICONO} aria-hidden className={styles.filaIcono} />
      <span className={styles.filaTitulo}>{titulo}</span>
      {meta && <span className={styles.filaMeta}>{meta}</span>}
    </button>
  );
}
