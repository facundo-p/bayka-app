import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Modal, Select } from '../../components';
import type { UsuarioConAsignaciones } from '../../queries/usuarioQueries';
import {
  actualizarNombre,
  cambiarRol,
  ROL,
  type Rol,
} from '../../repositories/profileRepository';
import { cambiarEmail } from '../../services/adminUsersService';
import { emailValido } from '../../../../supabase/functions/admin-users/nucleo';
import { motivoCambiarRol } from './acciones';
import { ADVERTENCIA_SUPERADMIN, nombreVisible, ROLES } from './presentacion';
import styles from './ModalUsuarios.module.css';

/** Campo de rol: deshabilitado con el motivo visible cuando el guard aplica
 *  (espeja el trigger del server); advierte al promover a superadmin. */
function CampoRol({
  rol,
  rolOriginal,
  motivo,
  onCambiar,
}: {
  rol: Rol;
  rolOriginal: Rol;
  motivo: string | null;
  onCambiar: (rol: Rol) => void;
}) {
  return (
    <>
      <Select
        label="Rol"
        value={rol}
        disabled={motivo !== null}
        title={motivo ?? undefined}
        hint={motivo ?? undefined}
        onChange={(evento) => onCambiar(evento.target.value as Rol)}
      >
        {ROLES.map(({ valor, etiqueta }) => (
          <option key={valor} value={valor}>
            {etiqueta}
          </option>
        ))}
      </Select>
      {rol === ROL.SUPERADMIN && rolOriginal !== ROL.SUPERADMIN && (
        <p className={styles.advertencia} role="status">
          {ADVERTENCIA_SUPERADMIN}
        </p>
      )}
    </>
  );
}

/** Edita nombre (directo a profiles), email (vía edge function, que lo cambia
 *  en Auth y el trigger sincroniza profiles) y rol (directo a profiles, con el
 *  trigger del server como guard final). Solo envía lo que cambió. */
export function EditarUsuarioModal({
  usuario,
  idActual,
  superadminsActivos,
  onClose,
}: {
  usuario: UsuarioConAsignaciones;
  idActual: string | undefined;
  superadminsActivos: number;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState(usuario.nombre);
  const [email, setEmail] = useState(usuario.email ?? '');
  const [rol, setRol] = useState<Rol>(usuario.rol);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  const motivoRol = motivoCambiarRol(usuario, idActual, superadminsActivos);
  const nombreCambio = nombre.trim() !== usuario.nombre;
  const emailCambio = email.trim() !== (usuario.email ?? '');
  const rolCambio = motivoRol === null && rol !== usuario.rol;
  const valido =
    nombre.trim() !== '' &&
    (nombreCambio || emailCambio || rolCambio) &&
    (!emailCambio || emailValido(email.trim()));

  const mutacion = useMutation({
    // Los tres campos tocan backends independientes: en paralelo.
    mutationFn: async () => {
      await Promise.all([
        nombreCambio ? actualizarNombre(usuario.id, nombre.trim()) : null,
        emailCambio ? cambiarEmail(usuario.id, email.trim()) : null,
        rolCambio ? cambiarRol(usuario.id, rol) : null,
      ]);
    },
    // Siempre invalidar: si una parte cambió y otra falló (p.ej. nombre OK,
    // email duplicado), la lista igual debe reflejar lo que sí se guardó.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['usuarios'] }),
    onSuccess: onClose,
    onError: (error: Error) => setErrorEnvio(error.message),
  });

  return (
    <Modal open title={`Editar a ${nombreVisible(usuario)}`} onClose={onClose}>
      <form
        className={styles.form}
        onSubmit={(evento) => {
          evento.preventDefault();
          mutacion.mutate();
        }}
      >
        <Input
          label="Nombre"
          required
          value={nombre}
          onChange={(evento) => setNombre(evento.target.value)}
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(evento) => setEmail(evento.target.value)}
        />
        <CampoRol rol={rol} rolOriginal={usuario.rol} motivo={motivoRol} onCambiar={setRol} />
        {errorEnvio && (
          <p className={styles.errorEnvio} role="alert">
            {errorEnvio}
          </p>
        )}
        <div className={styles.acciones}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!valido} loading={mutacion.isPending}>
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
