/** Piezas que repiten el panel y los modales de usuarios. */
import { Input } from '../../components';
import { ADVERTENCIA_SUPERADMIN } from './presentacion';
import type { CamposUsuario } from './useValoresUsuario';
import styles from './ModalUsuarios.module.css';

interface CamposContactoProps {
  campos: CamposUsuario;
  /** En el alta el email es obligatorio: a esa dirección va la invitación. */
  emailRequerido?: boolean;
}

/** Nombre y email de una persona. */
export function CamposContacto({ campos, emailRequerido = false }: CamposContactoProps) {
  const { valores, alEscribir } = campos;
  return (
    <>
      <Input label="Nombre" required value={valores.nombre} onChange={alEscribir('nombre')} />
      <Input
        label="Email"
        type="email"
        required={emailRequerido}
        value={valores.email}
        onChange={alEscribir('email')}
      />
    </>
  );
}

/** Aviso al elegir superadmin, el rol con acceso total. */
export function AvisoSuperadmin({ className = styles.advertencia }: { className?: string }) {
  return (
    <p className={className} role="status">
      {ADVERTENCIA_SUPERADMIN}
    </p>
  );
}
