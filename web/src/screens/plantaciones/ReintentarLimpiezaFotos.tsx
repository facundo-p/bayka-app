import { useMutation } from '@tanstack/react-query';
import { Button } from '../../components/Button';
import { ErrorEnvio } from '../../components/FormularioModal';
import styles from '../../components/Formulario.module.css';
import { limpiarFotosPendientes } from '../../services/adminPlantacionesService';
import { textoLimpiezaFotos } from './eliminacion';

/**
 * Para un superadmin, en el resultado de eliminar con fotos pendientes: reintenta
 * la limpieza sin tener que invocar la edge function a mano (#523). Si quedan
 * fotos, el botón sigue disponible.
 */
export function ReintentarLimpiezaFotos({ plantacionId }: { plantacionId: string }) {
  const limpieza = useMutation({ mutationFn: () => limpiarFotosPendientes(plantacionId) });
  const quedanFotos = !limpieza.data || limpieza.data.pendientes > 0;
  return (
    <>
      {limpieza.data && <p className={styles.info}>{textoLimpiezaFotos(limpieza.data)}</p>}
      <ErrorEnvio mensaje={limpieza.error?.message ?? null} />
      {quedanFotos && (
        <div className={styles.acciones}>
          <Button
            type="button"
            variant="secondary"
            loading={limpieza.isPending}
            onClick={() => limpieza.mutate()}
          >
            Reintentar limpieza de fotos
          </Button>
        </div>
      )}
    </>
  );
}
