import { NavLink } from 'react-router';
import { cx } from '../lib/classNames';
import styles from './TabNav.module.css';

export type TabItem = {
  to: string;
  label: string;
  /** true para la tab index: solo se marca activa en coincidencia exacta. */
  end?: boolean;
};

interface TabNavProps {
  tabs: TabItem[];
  /** Nombre accesible de la navegación. */
  label: string;
  /** `secundaria`: versión compacta para sub-secciones dentro de una tab. */
  variant?: 'principal' | 'secundaria';
}

function tabClassName({ isActive }: { isActive: boolean }): string {
  return cx(styles.tab, isActive && styles.tabActiva);
}

/** Tabs de sub-rutas: subrayado azul en la activa. */
export function TabNav({ tabs, label, variant = 'principal' }: TabNavProps) {
  return (
    <nav
      className={cx(styles.nav, variant === 'secundaria' && styles.navSecundaria)}
      aria-label={label}
    >
      {tabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.end} className={tabClassName}>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
