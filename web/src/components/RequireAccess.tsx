import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { SinAccesoScreen } from '../screens/SinAccesoScreen';
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
