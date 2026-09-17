import styles from './Divisor.module.css';

/** Línea vertical fina entre grupos de una barra. */
export function Divisor() {
  return <span className={styles.divisor} aria-hidden="true" />;
}
