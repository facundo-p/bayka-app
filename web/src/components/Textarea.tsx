import { useId, type ComponentProps } from 'react';
import { cx } from '../lib/classNames';
import { FormField } from './FormField';
import styles from './Textarea.module.css';

type TextareaProps = ComponentProps<'textarea'> & {
  label: string;
  error?: string;
  hint?: string;
};

/** Variante multilínea de Input: misma estructura de FormField y control base. */
export function Textarea({ label, error, hint, id, className, rows = 3, ...rest }: TextareaProps) {
  const autoId = useId();
  const textareaId = id ?? autoId;
  return (
    <FormField id={textareaId} label={label} hint={hint} error={error}>
      <textarea
        id={textareaId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        className={cx(styles.textarea, error && styles.textareaError, className)}
        {...rest}
      />
    </FormField>
  );
}
