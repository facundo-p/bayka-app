import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Modal, Select } from '../../components';
import { ROL, type Rol } from '../../repositories/profileRepository';
import { crearUsuario } from '../../services/adminUsersService';
import { emailValido } from '../../../../supabase/functions/admin-users/nucleo';
import { ADVERTENCIA_SUPERADMIN, ROLES } from './presentacion';
import styles from './ModalUsuarios.module.css';

const NOTA_INVITACION = 'Le va a llegar un email para definir su contraseña.';

type Valores = { nombre: string; email: string; rol: Rol };

function CuerpoAgregarUsuario({
  valores,
  onCambiar,
  errorEnvio,
}: {
  valores: Valores;
  onCambiar: (valores: Valores) => void;
  errorEnvio: string | null;
}) {
  return (
    <>
      <Input
        label="Nombre"
        required
        value={valores.nombre}
        onChange={(evento) => onCambiar({ ...valores, nombre: evento.target.value })}
      />
      <Input
        label="Email"
        type="email"
        required
        value={valores.email}
        onChange={(evento) => onCambiar({ ...valores, email: evento.target.value })}
      />
      <Select
        label="Rol"
        value={valores.rol}
        onChange={(evento) => onCambiar({ ...valores, rol: evento.target.value as Rol })}
      >
        {ROLES.map(({ valor, etiqueta }) => (
          <option key={valor} value={valor}>
            {etiqueta}
          </option>
        ))}
      </Select>
      {valores.rol === ROL.SUPERADMIN && (
        <p className={styles.advertencia} role="status">
          {ADVERTENCIA_SUPERADMIN}
        </p>
      )}
      <p className={styles.info}>{NOTA_INVITACION}</p>
      {errorEnvio && (
        <p className={styles.errorEnvio} role="alert">
          {errorEnvio}
        </p>
      )}
    </>
  );
}

/** Alta por invitación: crea el usuario vía la edge function admin-users y
 *  Supabase le envía el email para definir su contraseña. */
export function AgregarUsuarioModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [valores, setValores] = useState<Valores>({ nombre: '', email: '', rol: ROL.TECNICO });
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const mutacion = useMutation({
    mutationFn: () =>
      crearUsuario({
        nombre: valores.nombre.trim(),
        email: valores.email.trim(),
        rol: valores.rol,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      onClose();
    },
    onError: (error: Error) => setErrorEnvio(error.message),
  });
  const valido = valores.nombre.trim() !== '' && emailValido(valores.email.trim());
  return (
    <Modal open title="Agregar usuario" onClose={onClose}>
      <form
        className={styles.form}
        onSubmit={(evento) => {
          evento.preventDefault();
          mutacion.mutate();
        }}
      >
        <CuerpoAgregarUsuario valores={valores} onCambiar={setValores} errorEnvio={errorEnvio} />
        <div className={styles.acciones}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!valido} loading={mutacion.isPending}>
            Enviar invitación
          </Button>
        </div>
      </form>
    </Modal>
  );
}
