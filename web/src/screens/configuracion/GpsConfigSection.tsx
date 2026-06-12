import { useState } from 'react';
import { useParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Button,
  Card,
  Cargando,
  CheckboxField,
  ErrorConReintento,
  Input,
} from '../../components';
import { obtenerPlantacion, type Plantacion } from '../../queries/plantationQueries';
import {
  actualizarConfigGps,
  MENSAJE_GPS_SIN_MIGRACION,
} from '../../repositories/plantationRepository';
import { errorFrecuenciaGps } from '../../services/plantacionValidaciones';
import { useInvalidarPlantacion } from './useInvalidarPlantacion';
import styles from './SeccionesConfig.module.css';

/** El mensaje de migración faltante se muestra tal cual; el resto, genérico. */
function mensajeErrorGuardar(error: Error | null): string | null {
  if (!error) return null;
  return error.message === MENSAJE_GPS_SIN_MIGRACION
    ? error.message
    : 'No se pudo guardar la configuración GPS.';
}

function FormGps({ plantacion }: { plantacion: Plantacion }) {
  const [frecuencia, setFrecuencia] = useState(String(plantacion.gpsCaptureFrequency));
  const [obligatoria, setObligatoria] = useState(plantacion.gpsCaptureRequired);
  const [errorValidacion, setErrorValidacion] = useState<string | undefined>();
  const invalidar = useInvalidarPlantacion(plantacion.id);
  const mutacion = useMutation({
    mutationFn: () =>
      actualizarConfigGps(plantacion.id, { frecuencia: Number(frecuencia.trim()), obligatoria }),
    onSuccess: invalidar,
  });
  const hayCambios =
    frecuencia.trim() !== String(plantacion.gpsCaptureFrequency) ||
    obligatoria !== plantacion.gpsCaptureRequired;

  // Se valida acá, antes de tocar la base: un valor inválido nunca llega al update.
  const guardar = () => {
    const errorFrecuencia = errorFrecuenciaGps(frecuencia);
    setErrorValidacion(errorFrecuencia);
    if (!errorFrecuencia) mutacion.mutate();
  };

  return (
    <div className={styles.formConfig}>
      <div className={styles.campoCorto}>
        <Input
          label="Frecuencia de captura (cada N árboles)"
          type="number"
          min={1}
          step={1}
          value={frecuencia}
          onChange={(event) => setFrecuencia(event.target.value)}
          error={errorValidacion}
        />
      </div>
      <CheckboxField
        label="Captura obligatoria"
        checked={obligatoria}
        onChange={(event) => setObligatoria(event.target.checked)}
      />
      <p className={styles.textoAyuda}>
        El cambio afecta solo a los registros futuros; los árboles ya registrados no se modifican.
      </p>
      {mutacion.isError && (
        <p className={styles.errorAccion} role="alert">
          {mensajeErrorGuardar(mutacion.error)}
        </p>
      )}
      <Button onClick={guardar} disabled={!hayCambios} loading={mutacion.isPending}>
        Guardar
      </Button>
    </div>
  );
}

/** Frecuencia y obligatoriedad de la captura GPS al registrar árboles. */
export function GpsConfigSection() {
  const { id = '' } = useParams();
  const plantacion = useQuery({
    queryKey: ['plantacion', id],
    queryFn: () => obtenerPlantacion(id),
  });

  return (
    <Card title="Captura GPS">
      {plantacion.isPending && <Cargando />}
      {plantacion.isError && (
        <ErrorConReintento
          mensaje="No se pudo cargar la configuración GPS."
          onReintentar={() => void plantacion.refetch()}
        />
      )}
      {plantacion.data && <FormGps plantacion={plantacion.data} />}
    </Card>
  );
}
