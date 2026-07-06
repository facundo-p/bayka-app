import { Button } from './Button';
import styles from './ErrorConReintento.module.css';

interface ErrorConReintentoProps {
  mensaje: string;
  onReintentar: () => void;
}

/** Mensaje de error de carga con botón de reintento. */
export function ErrorConReintento({ mensaje, onReintentar }: ErrorConReintentoProps) {
  return (
    <div className={styles.error} role="alert">
      <p className={styles.texto}>{mensaje}</p>
      <Button variant="secondary" onClick={onReintentar}>
        Reintentar
      </Button>
    </div>
  );
}
