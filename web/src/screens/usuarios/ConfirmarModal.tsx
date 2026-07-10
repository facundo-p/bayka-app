import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Modal } from '../../components';
import styles from './ModalUsuarios.module.css';

/** Confirmación genérica para acciones de usuario (desactivar, reactivar,
 *  reenviar invitación): describe el efecto, ejecuta y refresca el listado.
 *  Con textoExito, al terminar muestra el resultado en lugar de cerrarse. */
export function ConfirmarModal({
  titulo,
  descripcion,
  confirmarEtiqueta,
  destructiva = false,
  accion,
  textoExito,
  onClose,
}: {
  titulo: string;
  descripcion: string;
  confirmarEtiqueta: string;
  destructiva?: boolean;
  accion: () => Promise<void>;
  textoExito?: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [completada, setCompletada] = useState(false);
  const mutacion = useMutation({
    mutationFn: accion,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      if (textoExito) setCompletada(true);
      else onClose();
    },
    onError: (errorEnvio: Error) => setError(errorEnvio.message),
  });

  if (completada && textoExito) {
    return (
      <Modal open title={titulo} onClose={onClose}>
        <div className={styles.form}>
          <p className={styles.info} role="status">
            {textoExito}
          </p>
          <div className={styles.acciones}>
            <Button type="button" onClick={onClose}>
              Listo
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open title={titulo} onClose={onClose}>
      <div className={styles.form}>
        <p className={styles.info}>{descripcion}</p>
        {error && (
          <p className={styles.errorEnvio} role="alert">
            {error}
          </p>
        )}
        <div className={styles.acciones}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant={destructiva ? 'danger' : 'primary'}
            loading={mutacion.isPending}
            onClick={() => mutacion.mutate()}
          >
            {confirmarEtiqueta}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
