import { cx } from '../lib/classNames';
import styles from './SegmentedControl.module.css';

interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
  sublabel?: string;
}

interface SegmentedControlProps<T extends string | number> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  'aria-label'?: string;
  size?: 'md' | 'sm';
}

/** Selector segmentado genérico (Datos Árboles/Grupos/Parcelas, presets GPS). */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  size = 'md',
  ...rest
}: SegmentedControlProps<T>) {
  return (
    <div className={styles.group} role="radiogroup" aria-label={rest['aria-label']}>
      {options.map((opcion) => {
        const activo = opcion.value === value;
        return (
          <button
            key={String(opcion.value)}
            type="button"
            role="radio"
            aria-checked={activo}
            className={cx(styles.option, size === 'sm' && styles.sm, activo && styles.active)}
            onClick={() => onChange(opcion.value)}
          >
            <span className={styles.label}>{opcion.label}</span>
            {opcion.sublabel && <span className={styles.sublabel}>{opcion.sublabel}</span>}
          </button>
        );
      })}
    </div>
  );
}
