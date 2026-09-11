import { Leaf, Sprout, Users } from 'lucide-react';
import { Link, Outlet } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { CommandMenuProvider, useCommandMenu } from '../hooks/useCommandMenu';
import { RUTA } from '../lib/rutas';
import { ROL } from '../repositories/profileRepository';
import { CommandMenu } from './CommandMenu/CommandMenu';
import { CommandMenuTrigger } from './CommandMenuTrigger';
import { NavItem } from './NavItem';
import { SeasonCard } from './SeasonCard';
import { UserMenu } from './UserMenu';
import { TAMANO_ICONO } from '../theme/iconos';
import styles from './AppLayout.module.css';

function Sidebar() {
  const { perfil } = useAuth();
  const { abrir } = useCommandMenu();
  const esSuperadmin = perfil?.rol === ROL.SUPERADMIN;

  return (
    <aside className={styles.sidebar}>
      <Link to={RUTA.plantaciones} className={styles.brand}>
        <img src="/logo-bayka.png" alt="Bayka" className={styles.logo} />
        <span className={styles.brandOverline}>Plataforma de Gestión</span>
      </Link>

      <CommandMenuTrigger onClick={abrir} />

      <nav className={styles.nav}>
        <span className={styles.navOverline}>Organización</span>
        <NavItem
          to={RUTA.plantaciones}
          icon={<Sprout size={TAMANO_ICONO.lg} />}
          label="Plantaciones"
          activeOnDetail
        />
        <NavItem to={RUTA.especies} icon={<Leaf size={TAMANO_ICONO.lg} />} label="Especies" />
        {esSuperadmin && (
          <NavItem to={RUTA.usuarios} icon={<Users size={TAMANO_ICONO.lg} />} label="Usuarios" />
        )}
      </nav>

      <SeasonCard />

      <div className={styles.footer}>
        <UserMenu />
      </div>
    </aside>
  );
}

/** Vive dentro del gate de sesión: montado en el login consultaría plantaciones
 *  como anónimo y dejaría un `[]` cacheado que después ven todas las pantallas. */
export function AppLayout() {
  return (
    <CommandMenuProvider>
      <div className={styles.shell}>
        <Sidebar />
        <div className={styles.content}>
          <main className={styles.main}>
            <Outlet />
          </main>
        </div>
        <CommandMenu />
      </div>
    </CommandMenuProvider>
  );
}
