import { Fragment } from 'react';
import { Link } from 'react-router';
import { cx } from '../lib/classNames';
import styles from './Breadcrumb.module.css';

interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

/** Breadcrumb de la topbar (Plantaciones › Otoño 2026 — La Maluka). */
export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className={styles.nav} aria-label="Migas de navegación">
      {items.map((item, indice) => {
        const esUltimo = indice === items.length - 1;
        return (
          <Fragment key={`${item.label}-${indice}`}>
            {indice > 0 && (
              <span className={styles.separador} aria-hidden>
                ›
              </span>
            )}
            {item.to && !esUltimo ? (
              <Link className={styles.link} to={item.to}>
                {item.label}
              </Link>
            ) : (
              <span className={cx(styles.item, esUltimo && styles.current)} aria-current={esUltimo ? 'page' : undefined}>
                {item.label}
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
