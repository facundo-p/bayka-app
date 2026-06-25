import { cx } from '../../lib/classNames';
import { metaDeTipo } from './tiposResultado';
import type { ItemPaleta } from './construirItems';
import styles from './CommandMenu.module.css';

const TAMANO_ICONO = 16;

interface FilaPaletaProps {
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

export function FilaPaleta({ item, resaltado, onElegir, onResaltar }: FilaPaletaProps) {
  const { Icono, titulo, meta } = contenidoFila(item);
  return (
    <button
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
