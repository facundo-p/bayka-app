import { LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { iniciales } from '../lib/iniciales';
import { ROL, type Perfil } from '../repositories/profileRepository';
import styles from './UserMenu.module.css';

const ETIQUETA_ROL: Record<Perfil['rol'], string> = {
  [ROL.SUPERADMIN]: 'Superadmin',
  [ROL.ADMIN]: 'Administrador',
  [ROL.TECNICO]: 'Técnico',
};

/** Footer del sidebar: avatar con iniciales + nombre + rol + cerrar sesión. */
export function UserMenu() {
  const { perfil, signOut } = useAuth();
  if (!perfil) return null;

  return (
    <div className={styles.fila}>
      <div className={styles.avatar} aria-hidden>
        {iniciales(perfil.nombre)}
      </div>
      <div className={styles.datos}>
        <span className={styles.nombre}>{perfil.nombre}</span>
        <span className={styles.rol}>{ETIQUETA_ROL[perfil.rol]}</span>
      </div>
      <button
        type="button"
        className={styles.salir}
        onClick={() => void signOut()}
        aria-label="Cerrar sesión"
      >
        <LogOut size={18} aria-hidden />
      </button>
    </div>
  );
}
