import { Button, EmptyState } from '../components';
import { useAuth } from '../hooks/useAuth';
import styles from './SinAccesoScreen.module.css';

/** Pantalla para usuarios con sesión pero sin rol de administración. */
export function SinAccesoScreen() {
  const { signOut } = useAuth();
  return (
    <div className={styles.contenedor}>
      <EmptyState
        icon="🔒"
        title="Sin acceso"
        description="La web de gestión es solo para administradores. Si creés que deberías tener acceso, contactá al administrador de tu organización."
      >
        <Button variant="secondary" onClick={() => void signOut()}>
          Cerrar sesión
        </Button>
      </EmptyState>
    </div>
  );
}
