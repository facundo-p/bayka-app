import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button, Input, Modal } from '../../components';
import { validarNuevaPassword } from '../../lib/validarPassword';
import type { UsuarioConAsignaciones } from '../../queries/usuarioQueries';
import { cambiarPassword } from '../../services/adminUsersService';
import { nombreVisible } from './presentacion';
import styles from './ModalUsuarios.module.css';

const NOTA_PASSWORD = 'La persona va a poder ingresar de inmediato con la contraseña nueva.';

export function CambiarPasswordModal({
  usuario,
  onClose,
}: {
  usuario: UsuarioConAsignaciones;
  onClose: () => void;
}) {
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mutacion = useMutation({
    mutationFn: () => cambiarPassword(usuario.id, password),
    onSuccess: onClose,
    onError: (errorEnvio: Error) => setError(errorEnvio.message),
  });

  function manejarSubmit(evento: React.FormEvent) {
    evento.preventDefault();
    const invalidez = validarNuevaPassword(password, confirmacion);
    if (invalidez) {
      setError(invalidez);
      return;
    }
    setError(null);
    mutacion.mutate();
  }

  return (
    <Modal open title={`Cambiar contraseña de ${nombreVisible(usuario)}`} onClose={onClose}>
      <form className={styles.form} onSubmit={manejarSubmit}>
        <Input
          label="Contraseña nueva"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(evento) => setPassword(evento.target.value)}
        />
        <Input
          label="Repetir contraseña"
          type="password"
          autoComplete="new-password"
          required
          value={confirmacion}
          onChange={(evento) => setConfirmacion(evento.target.value)}
        />
        <p className={styles.info}>{NOTA_PASSWORD}</p>
        {error && (
          <p className={styles.errorEnvio} role="alert">
            {error}
          </p>
        )}
        <div className={styles.acciones}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={mutacion.isPending}>
            Guardar contraseña
          </Button>
        </div>
      </form>
    </Modal>
  );
}
