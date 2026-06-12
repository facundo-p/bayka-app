import styles from './PlaceholderScreen.module.css';

interface PlaceholderScreenProps {
  title: string;
}

/** Pantalla provisoria hasta que el issue de cada sección la implemente. */
export function PlaceholderScreen({ title }: PlaceholderScreenProps) {
  return (
    <section>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.hint}>Sección en construcción.</p>
    </section>
  );
}
