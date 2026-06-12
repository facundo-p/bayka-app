import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { Badge } from './Badge';
import { Button } from './Button';
import styles from './AppLayout.module.css';

type NavItem = { to: string; label: string; soloSuperadmin?: boolean };

const NAV_ITEMS: NavItem[] = [
  { to: '/plantaciones', label: 'Plantaciones' },
  { to: '/usuarios', label: 'Usuarios', soloSuperadmin: true },
];

function navLinkClassName({ isActive }: { isActive: boolean }): string {
  return isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink;
}

function Sidebar() {
  const { perfil } = useAuth();
  const items = NAV_ITEMS.filter((item) => !item.soloSuperadmin || perfil?.rol === 'superadmin');
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.wordmark}>BAYKA</span>
        <span className={styles.brandSubtitle}>Gestión</span>
      </div>
      <nav className={styles.nav}>
        {items.map(({ to, label }) => (
          <NavLink key={to} to={to} className={navLinkClassName}>
            {label}
          </NavLink>
        ))}
      </nav>
      <div className={styles.sidebarFooter} />
    </aside>
  );
}

function HeaderUsuario() {
  const { perfil, signOut } = useAuth();
  if (!perfil) return null;
  return (
    <div className={styles.headerUsuario}>
      <span className={styles.headerNombre}>{perfil.nombre}</span>
      <Badge>{perfil.rol}</Badge>
      <Button variant="secondary" onClick={() => void signOut()}>
        Salir
      </Button>
    </div>
  );
}

export function AppLayout() {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.content}>
        <header className={styles.header}>
          <HeaderUsuario />
        </header>
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
