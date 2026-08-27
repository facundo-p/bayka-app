import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Modal } from '../../components';
import { generarIds, seedSugerido } from '../../queries/idsQueries';
import styles from './GenerarIdsModal.module.css';

const MENSAJE_SEED_INVALIDO = 'Ingresá un número entero mayor a 0.';
const ADVERTENCIA_IRREVERSIBLE = 'Esta acción no se puede deshacer.';

/** Estado del formulario: seed editable (precargado con el sugerido del server)
 *  + mutación del RPC. Al éxito invalida el gate de IDs y cierra el modal. */
function useGenerarIds(plantationId: string, onClose: () => void) {
  const queryClient = useQueryClient();
  const [seedEditado, setSeedEditado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data: sugerido } = useQuery({ queryKey: ['seed-sugerido'], queryFn: seedSugerido });
  const seed = seedEditado ?? (sugerido != null ? String(sugerido) : '');

  const mutacion = useMutation({
    mutationFn: (seedElegido: number) => generarIds(plantationId, seedElegido),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ids-generados', plantationId] });
      onClose();
    },
    onError: (errorRpc: Error) => setError(errorRpc.message),
  });

  function confirmar() {
    const seedElegido = Number.parseInt(seed, 10);
    if (Number.isNaN(seedElegido) || seedElegido < 1) return setError(MENSAJE_SEED_INVALIDO);
    setError(null);
    mutacion.mutate(seedElegido);
  }

  return { seed, setSeedEditado, error, confirmar, generando: mutacion.isPending };
}

/**
 * Confirmación de generación de IDs finales (issue #232): seed sugerido
 * (MAX global + 1) editable, advertencia de irreversibilidad (guía UX §15) y
 * ejecución del RPC transaccional server-side.
 */
export function GenerarIdsModal({
  plantationId,
  onClose,
}: {
  plantationId: string;
  onClose: () => void;
}) {
  const { seed, setSeedEditado, error, confirmar, generando } = useGenerarIds(
    plantationId,
    onClose,
  );
  return (
    <Modal open title="Generar IDs" onClose={onClose}>
      <div className={styles.form}>
        <Input
          label="ID global inicial"
          type="number"
          min={1}
          value={seed}
          onChange={(evento) => setSeedEditado(evento.target.value)}
          hint="Sugerido: máximo ID global existente + 1."
        />
        <p className={styles.advertencia}>{ADVERTENCIA_IRREVERSIBLE}</p>
        {error && (
          <p className={styles.errorEnvio} role="alert">
            {error}
          </p>
        )}
        <div className={styles.acciones}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" loading={generando} onClick={confirmar}>
            Generar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
