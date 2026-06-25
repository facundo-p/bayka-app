import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { cx } from '../lib/classNames';
import styles from './NavItem.module.css';

interface NavItemProps {
  to: string;
  icon: ReactNode;
  label: string;
  /** Mantiene activo el ítem en rutas de detalle (ej. /plantaciones/:id).
   *  Sin esto se usa match exacto (`end`), para no resaltar el ítem en
   *  sub-rutas que no le corresponden. */
  activeOnDetail?: boolean;
}

/** Ítem de navegación del sidebar. */
export function NavItem({ to, icon, label, activeOnDetail = false }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={!activeOnDetail}
      className={({ isActive }) => cx(styles.item, isActive && styles.activo)}
    >
      <span className={styles.icono} aria-hidden>
        {icon}
      </span>
      {label}
    </NavLink>
  );
}
