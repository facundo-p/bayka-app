import { useId, type ComponentProps } from 'react';
import { cx } from '../lib/classNames';
import { FormField } from './FormField';
import styles from './Input.module.css';

type InputProps = ComponentProps<'input'> & {
  label: string;
  error?: string;
  hint?: string;
};

export function Input({ label, error, hint, id, className, ...rest }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <FormField id={inputId} label={label} hint={hint} error={error}>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={cx(styles.input, error && styles.inputError, className)}
        {...rest}
      />
    </FormField>
  );
}
