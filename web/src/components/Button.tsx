import type { ComponentProps } from 'react';
import { cx } from '../lib/classNames';
import { Spinner } from './Spinner';
import styles from './Button.module.css';

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary' | 'danger';
  /** `sm`: versión compacta para celdas de tabla y acciones secundarias. */
  size?: 'md' | 'sm';
  /** Deshabilita el botón y muestra un spinner inline. */
  loading?: boolean;
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cx(styles.button, styles[variant], size === 'sm' && styles.sm, className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}
