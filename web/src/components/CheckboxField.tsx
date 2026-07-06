import { useId, type ComponentProps } from 'react';
import styles from './CheckboxField.module.css';

type CheckboxFieldProps = Omit<ComponentProps<'input'>, 'type'> & {
  label: string;
};

/** Checkbox con label asociado, en línea (a diferencia de Input/Select,
 *  el label va al costado del control). */
export function CheckboxField({ label, id, ...rest }: CheckboxFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className={styles.field}>
      <input id={inputId} type="checkbox" className={styles.checkbox} {...rest} />
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
    </div>
  );
}
