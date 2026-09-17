import { useId, type ComponentProps } from 'react';
import { cx } from '../lib/classNames';
import { FormField } from './FormField';
import type { Opcion } from './opcion';
import styles from './Select.module.css';

type SelectProps = ComponentProps<'select'> & {
  label: string;
  error?: string;
  hint?: string;
  /** Oculta el label visualmente (toolbars densas); sigue accesible. */
  labelOculto?: boolean;
  /** Van después de los `<option>` que lleguen como children. */
  opciones?: ReadonlyArray<Opcion<string>>;
};

export function Select(props: SelectProps) {
  const { label, error, hint, labelOculto, opciones, id, className, children, ...rest } = props;
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <FormField id={selectId} label={label} hint={hint} error={error} labelOculto={labelOculto}>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        className={cx(styles.select, error && styles.selectError, className)}
        {...rest}
      >
        {children}
        {opciones?.map(({ value, label: etiqueta }) => (
          <option key={value} value={value}>
            {etiqueta}
          </option>
        ))}
      </select>
    </FormField>
  );
}
