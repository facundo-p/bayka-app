import { PuntoColor } from '../PuntoColor';
import type { FichaPunto } from './fichaPunto';
import styles from './PopupArbol.module.css';

/** Qué árbol es el punto clickeado del mapa. */
export function PopupArbol({ ficha }: { ficha: FichaPunto }) {
  const { idArbol, especie, parcela } = ficha;
  return (
    <dl className={styles.ficha}>
      <dt className={styles.etiqueta}>ID Árbol</dt>
      <dd className={styles.idArbol}>{idArbol}</dd>
      <dt className={styles.etiqueta}>Especie</dt>
      <dd className={styles.valor}>
        <PuntoColor color={especie.color} conAro />
        <span className={styles.codigo}>{especie.codigo}</span>
        {`· ${especie.nombre}`}
      </dd>
      <dt className={styles.etiqueta}>Parcela</dt>
      <dd className={styles.valor}>{parcela}</dd>
    </dl>
  );
}
