import { cx } from '../lib/classNames';
import styles from './Spinner.module.css';

interface SpinnerProps {
  size?: 'sm' | 'md';
}

export function Spinner({ size = 'md' }: SpinnerProps) {
  return <span className={cx(styles.spinner, styles[size])} role="status" aria-label="Cargando" />;
}
