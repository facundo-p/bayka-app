import { Leaf, Sprout, Users } from 'lucide-react';
import { Link, Outlet } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { CommandMenuTrigger } from './CommandMenuTrigger';
import { NavItem } from './NavItem';
import { SeasonCard } from './SeasonCard';
import { UserMenu } from './UserMenu';
import styles from './AppLayout.module.css';

const TAMANO_ICONO = 18;

function Sidebar() {
  const { perfil } = useAuth();
  const esSuperadmin = perfil?.rol === 'superadmin';

  return (
    <aside className={styles.sidebar}>
      <Link to="/plantaciones" className={styles.brand}>
        <img src="/logo-bayka.png" alt="Bayka" className={styles.logo} />
        <span className={styles.brandOverline}>Plataforma de Gestión</span>
      </Link>

      <CommandMenuTrigger disabled />

      <nav className={styles.nav}>
        <span className={styles.navOverline}>Organización</span>
        <NavItem
          to="/plantaciones"
          icon={<Sprout size={TAMANO_ICONO} />}
          label="Plantaciones"
          activeOnDetail
        />
        <NavItem to="/especies" icon={<Leaf size={TAMANO_ICONO} />} label="Especies" />
        {esSuperadmin && (
          <NavItem to="/usuarios" icon={<Users size={TAMANO_ICONO} />} label="Usuarios" />
        )}
      </nav>

      <SeasonCard />

      <div className={styles.footer}>
        <UserMenu />
      </div>
    </aside>
  );
}

export function AppLayout() {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.content}>
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
