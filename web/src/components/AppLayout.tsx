import { Outlet, useLocation } from 'react-router';
import { CommandMenuProvider } from '../hooks/useCommandMenu';
import { BarraLateral } from './BarraLateral';
import { CommandMenu } from './CommandMenu/CommandMenu';
import { ErrorBoundary } from './ErrorBoundary';
import styles from './AppLayout.module.css';

const MENSAJE_PANTALLA_ROTA = 'Algo salió mal al mostrar esta pantalla.';

/** Vive dentro del gate de sesión: montado en el login consultaría plantaciones
 *  como anónimo y dejaría un `[]` cacheado que después ven todas las pantallas. */
export function AppLayout() {
  // Clave por ruta: al navegar, el boundary se desmonta y la pantalla nueva arranca limpia.
  const { pathname } = useLocation();
  return (
    <CommandMenuProvider>
      <div className={styles.shell}>
        <BarraLateral />
        <div className={styles.content}>
          <main className={styles.main}>
            <ErrorBoundary key={pathname} mensaje={MENSAJE_PANTALLA_ROTA}>
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
        <CommandMenu />
      </div>
    </CommandMenuProvider>
  );
}
