import { useId, type ComponentProps } from 'react';
import { cx } from '../lib/classNames';
import { FormField } from './FormField';
import styles from './Input.module.css';

type InputProps = ComponentProps<'input'> & {
  label: string;
  error?: string;
  hint?: string;
  /** Oculta el label visualmente (toolbars densas); sigue accesible. */
  labelOculto?: boolean;
};

export function Input({ label, error, hint, labelOculto, id, className, ...rest }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <FormField id={inputId} label={label} hint={hint} error={error} labelOculto={labelOculto}>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={cx(styles.input, error && styles.inputError, className)}
        {...rest}
      />
    </FormField>
  );
}
