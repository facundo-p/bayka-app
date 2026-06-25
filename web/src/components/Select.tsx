import { useId, type ComponentProps } from 'react';
import { cx } from '../lib/classNames';
import { FormField } from './FormField';
import styles from './Select.module.css';

type SelectProps = ComponentProps<'select'> & {
  label: string;
  error?: string;
  hint?: string;
  /** Oculta el label visualmente (toolbars densas); sigue accesible. */
  labelOculto?: boolean;
};

export function Select({ label, error, hint, labelOculto, id, className, ...rest }: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <FormField id={selectId} label={label} hint={hint} error={error} labelOculto={labelOculto}>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        className={cx(styles.select, error && styles.selectError, className)}
        {...rest}
      />
    </FormField>
  );
}
