import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Modal, Select } from '../../components';
import type { UsuarioConAsignaciones } from '../../queries/usuarioQueries';
import { cambiarRol, ROL, type Rol } from '../../repositories/profileRepository';
import { ADVERTENCIA_SUPERADMIN, nombreVisible, ROLES } from './presentacion';
import styles from './ModalUsuarios.module.css';

function CuerpoCambiarRol({
  rol,
  onCambiar,
  advertencia,
  errorEnvio,
}: {
  rol: Rol;
  onCambiar: (rol: Rol) => void;
  advertencia: boolean;
  errorEnvio: string | null;
}) {
  return (
    <>
      <Select
        label="Nuevo rol"
        value={rol}
        onChange={(event) => onCambiar(event.target.value as Rol)}
      >
        {ROLES.map(({ valor, etiqueta }) => (
          <option key={valor} value={valor}>
            {etiqueta}
          </option>
        ))}
      </Select>
      {advertencia && (
        <p className={styles.advertencia} role="status">
          {ADVERTENCIA_SUPERADMIN}
        </p>
      )}
      {errorEnvio && (
        <p className={styles.errorEnvio} role="alert">
          {errorEnvio}
        </p>
      )}
    </>
  );
}

export function CambiarRolModal({
  usuario,
  onClose,
}: {
  usuario: UsuarioConAsignaciones;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [rol, setRol] = useState<Rol>(usuario.rol);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const mutacion = useMutation({
    mutationFn: () => cambiarRol(usuario.id, rol),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      onClose();
    },
    onError: (error: Error) => setErrorEnvio(error.message),
  });
  return (
    <Modal open title={`Cambiar rol de ${nombreVisible(usuario)}`} onClose={onClose}>
      <div className={styles.form}>
        <CuerpoCambiarRol
          rol={rol}
          onCambiar={setRol}
          advertencia={rol === ROL.SUPERADMIN && usuario.rol !== ROL.SUPERADMIN}
          errorEnvio={errorEnvio}
        />
        <div className={styles.acciones}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={rol === usuario.rol}
            loading={mutacion.isPending}
            onClick={() => mutacion.mutate()}
          >
            Confirmar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
