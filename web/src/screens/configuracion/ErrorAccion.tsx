import styles from './SeccionesConfig.module.css';

/** Error de una acción de la card o del modal; nada si no hubo. */
export function ErrorAccion({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null;
  return (
    <p className={styles.errorAccion} role="alert">
      {mensaje}
    </p>
  );
}
