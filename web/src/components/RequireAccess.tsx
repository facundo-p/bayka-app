import { Link, Navigate, Outlet } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { SinAccesoScreen } from '../screens/SinAccesoScreen';
import { EmptyState } from './EmptyState';
import { Spinner } from './Spinner';
import styles from './RequireAccess.module.css';

/** Gate de acceso: decide qué ver según el estado de autenticación. */
export function RequireAccess() {
  const { estado } = useAuth();
  if (estado === 'cargando') {
    return (
      <div className={styles.cargando}>
        <Spinner />
      </div>
    );
  }
  if (estado === 'anonimo') return <Navigate to="/login" replace />;
  if (estado === 'sin-acceso') return <SinAccesoScreen />;
  return <Outlet />;
}

/** Gate de rol: la gestión de usuarios es exclusiva del superadmin.
 *  Sin redirect silencioso: un admin que navega a mano ve el porqué. */
export function RequireSuperadmin() {
  const { perfil } = useAuth();
  if (perfil?.rol !== 'superadmin') {
    return (
      <EmptyState
        icon="🔒"
        title="Sección solo para superadministradores"
        description="Tu rol no tiene acceso a la gestión de usuarios."
      >
        <Link to="/plantaciones" className={styles.enlace}>
          Ir a Plantaciones
        </Link>
      </EmptyState>
    );
  }
  return <Outlet />;
}
