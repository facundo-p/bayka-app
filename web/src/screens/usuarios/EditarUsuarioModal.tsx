import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Modal } from '../../components';
import type { UsuarioConAsignaciones } from '../../queries/usuarioQueries';
import { actualizarNombre } from '../../repositories/profileRepository';
import { cambiarEmail } from '../../services/adminUsersService';
import { emailValido } from '../../../../supabase/functions/admin-users/nucleo';
import { nombreVisible } from './presentacion';
import styles from './ModalUsuarios.module.css';

/** Edita nombre (directo a profiles) y email (vía edge function, que lo cambia
 *  en Auth y el trigger sincroniza profiles). Solo envía lo que cambió. */
export function EditarUsuarioModal({
  usuario,
  onClose,
}: {
  usuario: UsuarioConAsignaciones;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState(usuario.nombre);
  const [email, setEmail] = useState(usuario.email ?? '');
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  const nombreCambio = nombre.trim() !== usuario.nombre;
  const emailCambio = email.trim() !== (usuario.email ?? '');
  const valido =
    nombre.trim() !== '' &&
    (nombreCambio || emailCambio) &&
    (!emailCambio || emailValido(email.trim()));

  const mutacion = useMutation({
    mutationFn: async () => {
      if (nombreCambio) await actualizarNombre(usuario.id, nombre.trim());
      if (emailCambio) await cambiarEmail(usuario.id, email.trim());
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      onClose();
    },
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
