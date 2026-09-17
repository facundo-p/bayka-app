/** Piezas que repiten el panel y los modales de usuarios. */
import type { ReactNode } from 'react';
import { Button, Input } from '../../components';
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

interface ErrorEnvioProps {
  mensaje: string | null;
  className?: string;
}

/** El error del último envío; sin error no ocupa lugar. */
export function ErrorEnvio({ mensaje, className = styles.errorEnvio }: ErrorEnvioProps) {
  if (!mensaje) return null;
  return (
    <p className={className} role="alert">
      {mensaje}
    </p>
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

interface AccionesModalProps {
  onCancelar: () => void;
  /** La acción principal, a la derecha de Cancelar. */
  children: ReactNode;
}

/** Pie de los modales: Cancelar y la acción principal. */
export function AccionesModal({ onCancelar, children }: AccionesModalProps) {
  return (
    <div className={styles.acciones}>
      <Button type="button" variant="secondary" onClick={onCancelar}>
        Cancelar
      </Button>
      {children}
    </div>
  );
}
