import { Search } from 'lucide-react';
import styles from './CommandMenuTrigger.module.css';

interface CommandMenuTriggerProps {
  onClick?: () => void;
  disabled?: boolean;
}

/** Disparador del buscador (⌘K). */
export function CommandMenuTrigger({ onClick, disabled = false }: CommandMenuTriggerProps) {
  return (
    <button type="button" className={styles.trigger} onClick={onClick} disabled={disabled}>
      <Search size={16} aria-hidden />
      <span className={styles.texto}>Buscar…</span>
      <span className={styles.chip}>⌘K</span>
    </button>
  );
}
