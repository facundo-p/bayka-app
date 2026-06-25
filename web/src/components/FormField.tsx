import type { ReactNode } from 'react';
import { cx } from '../lib/classNames';
import styles from './FormField.module.css';

interface FormFieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  /** Oculta el label visualmente pero lo deja accesible (toolbars densas). */
  labelOculto?: boolean;
  children: ReactNode;
}

/** Estructura compartida de Input/Select: label asociado + hint/error debajo. */
export function FormField({ id, label, hint, error, labelOculto, children }: FormFieldProps) {
  return (
    <div className={styles.field}>
      <label className={cx(styles.label, labelOculto && styles.labelOculto)} htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? (
        <span className={styles.error} role="alert">
          {error}
        </span>
      ) : (
        hint && <span className={styles.hint}>{hint}</span>
      )}
    </div>
  );
}
