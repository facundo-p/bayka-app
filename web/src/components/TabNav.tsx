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
  /** `secundaria`: compacta, para sub-secciones dentro de una tab.
   *  `segmentada`: píldora para la barra única del detalle. */
  variant?: 'principal' | 'secundaria' | 'segmentada';
}

function tabClassName({ isActive }: { isActive: boolean }): string {
  return cx(styles.tab, isActive && styles.tabActiva);
}

const CLASE_VARIANTE = {
  principal: undefined,
  secundaria: styles.navSecundaria,
  segmentada: styles.navSegmentada,
} as const;

/** Tabs de sub-rutas: subrayado azul en la activa, o píldora si es segmentada. */
export function TabNav({ tabs, label, variant = 'principal' }: TabNavProps) {
  return (
    <nav
      className={cx(styles.nav, CLASE_VARIANTE[variant])}
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
