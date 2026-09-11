import { LogOut } from 'lucide-react';
import { Link } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { useNovedadesNoVistas } from '../hooks/useNovedadesNoVistas';
import { VERSION_APP } from '../lib/entorno';
import { iniciales } from '../lib/iniciales';
import { etiquetaRol, nombreVisible } from '../lib/presentacionUsuario';
import type { Perfil } from '../repositories/profileRepository';
import { TAMANO_ICONO } from '../theme/iconos';
import { BotonIcono } from './BotonIcono';
import styles from './UserMenu.module.css';

/** Link a Novedades con la versión deployada; el dot avisa que hay una versión
 *  que este navegador todavía no vio. */
function EnlaceNovedades() {
  const hayNoVistas = useNovedadesNoVistas();
  const etiqueta = hayNoVistas
    ? `Novedades, versión ${VERSION_APP}, hay novedades nuevas`
    : `Novedades, versión ${VERSION_APP}`;
  return (
    <Link to="/novedades" className={styles.novedades} aria-label={etiqueta}>
      Novedades · {VERSION_APP}
      {hayNoVistas && <span className={styles.dot} aria-hidden />}
    </Link>
  );
}

function IdentidadPerfil({ perfil }: { perfil: Perfil }) {
  const nombre = nombreVisible(perfil.nombre, perfil.id);
  return (
    <>
      <div className={styles.avatar} aria-hidden>
        {iniciales(nombre)}
      </div>
      <div className={styles.datos}>
        <span className={styles.nombre}>{nombre}</span>
        <span className={styles.rol}>{etiquetaRol(perfil.rol)}</span>
      </div>
    </>
  );
}

/** Footer del sidebar: avatar con iniciales + nombre + rol + cerrar sesión, y
 *  debajo el acceso a Novedades. */
export function UserMenu() {
  const { perfil, signOut } = useAuth();
  if (!perfil) return null;
  return (
    <div className={styles.footer}>
      <div className={styles.fila}>
        <IdentidadPerfil perfil={perfil} />
        <BotonIcono variante="fantasma" etiqueta="Cerrar sesión" onClick={() => void signOut()}>
          <LogOut size={TAMANO_ICONO.lg} aria-hidden />
        </BotonIcono>
      </div>
      <EnlaceNovedades />
    </div>
  );
}
