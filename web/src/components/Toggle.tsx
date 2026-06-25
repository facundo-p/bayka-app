import { cx } from '../lib/classNames';
import styles from './Toggle.module.css';

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  id?: string;
  'aria-label'?: string;
  disabled?: boolean;
}

/** Switch on/off accesible (Configuración GPS / Visibilidad). */
export function Toggle({ checked, onChange, id, disabled, ...rest }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={rest['aria-label']}
      disabled={disabled}
      className={cx(styles.track, checked && styles.on)}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.knob} />
    </button>
  );
}
