import { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { useNovedadesNoVistas } from '../hooks/useNovedadesNoVistas';
import { VERSION_APP } from '../lib/entorno';
import { iniciales } from '../lib/iniciales';
import { etiquetaRol, nombreVisible } from '../lib/presentacionUsuario';
import { RUTA } from '../lib/rutas';
import type { Perfil } from '../repositories/profileRepository';
import { ConfirmarModal } from './ConfirmarModal';
import styles from './UserMenu.module.css';

/** Link a Novedades con la versión deployada; el dot avisa que hay una versión
 *  que este navegador todavía no vio. En teléfono queda solo la versión. */
function EnlaceNovedades() {
  const hayNoVistas = useNovedadesNoVistas();
  const etiqueta = hayNoVistas
    ? `Novedades, versión ${VERSION_APP}, hay novedades nuevas`
    : `Novedades, versión ${VERSION_APP}`;
  return (
    <Link to={RUTA.novedades} className={styles.novedades} aria-label={etiqueta}>
      <span>
        <span className={styles.novedadesTexto}>{'Novedades · '}</span>
        {VERSION_APP}
      </span>
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

/**
 * Footer del sidebar: la identidad es el botón de salida —en teléfono se pliega
 * al avatar— y debajo el acceso a Novedades. Cerrar sesión pregunta antes: el
 * ícono suelto que lo hacía de una es un toque accidental de distancia, y
 * volver cuesta email y contraseña.
 */
export function UserMenu() {
  const { perfil, signOut } = useAuth();
  const [confirmando, setConfirmando] = useState(false);
  if (!perfil) return null;
  const nombre = nombreVisible(perfil.nombre, perfil.id);
  return (
    <div className={styles.footer}>
      <div className={styles.fila}>
        <button
          type="button"
          className={styles.identidad}
          aria-haspopup="dialog"
          onClick={() => setConfirmando(true)}
        >
          <IdentidadPerfil perfil={perfil} />
        </button>
      </div>
      <EnlaceNovedades />
      {confirmando && (
        <ConfirmarModal
          titulo="¿Cerrar sesión?"
          descripcion={`Estás como ${nombre}, ${etiquetaRol(perfil.rol)}.`}
          aviso="Para volver a entrar vas a necesitar tu email y tu contraseña."
          confirmarEtiqueta="Cerrar sesión"
          accion={signOut}
          onClose={() => setConfirmando(false)}
        />
      )}
    </div>
  );
}
