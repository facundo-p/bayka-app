import { NavLink, Outlet } from 'react-router';
import styles from './AppLayout.module.css';

const NAV_ITEMS = [
  { to: '/plantaciones', label: 'Plantaciones' },
  { to: '/usuarios', label: 'Usuarios' },
] as const;

function navLinkClassName({ isActive }: { isActive: boolean }): string {
  return isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink;
}

function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.wordmark}>BAYKA</span>
        <span className={styles.brandSubtitle}>Gestión</span>
      </div>
      <nav className={styles.nav}>
        {NAV_ITEMS.map(({ to, label }) => (
          <NavLink key={to} to={to} className={navLinkClassName}>
            {label}
          </NavLink>
        ))}
      </nav>
      {/* Footer vacío: el bloque de usuario/logout llega con el issue de auth */}
      <div className={styles.sidebarFooter} />
    </aside>
  );
}

export function AppLayout() {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.content}>
        {/* Header vacío: reserva espacio para acciones contextuales futuras */}
        <header className={styles.header} />
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
