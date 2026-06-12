import { useState } from 'react';
import { useParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, Cargando, CheckboxField, ErrorConReintento } from '../../components';
import { obtenerPlantacion, type Plantacion } from '../../queries/plantationQueries';
import {
  actualizarVisibilidad,
  MENSAJE_VISIBILIDAD_SIN_MIGRACION,
} from '../../repositories/plantationRepository';
import { useInvalidarPlantacion } from './useInvalidarPlantacion';
import styles from './SeccionesConfig.module.css';

/** El mensaje de migración faltante se muestra tal cual; el resto, genérico. */
function mensajeErrorVisibilidad(error: Error | null): string | null {
  if (!error) return null;
  return error.message === MENSAJE_VISIBILIDAD_SIN_MIGRACION
    ? error.message
    : 'No se pudo actualizar la visibilidad.';
}

function ToggleVisibilidad({ plantacion }: { plantacion: Plantacion }) {
  // Estado local para feedback inmediato: el guardado es al cambiar, sin
  // botón aparte, y si el update falla se vuelve al valor anterior.
  const [visible, setVisible] = useState(plantacion.visibleInApp);
  const invalidar = useInvalidarPlantacion(plantacion.id);
  const mutacion = useMutation({
    mutationFn: (nuevoValor: boolean) => actualizarVisibilidad(plantacion.id, nuevoValor),
    onSuccess: invalidar,
    onError: (_error, nuevoValor) => setVisible(!nuevoValor),
  });
  const cambiar = (nuevoValor: boolean) => {
    setVisible(nuevoValor);
    mutacion.mutate(nuevoValor);
  };

  return (
    <div className={styles.formConfig}>
      <CheckboxField
        label="Visible para técnicos en la app"
        checked={visible}
        disabled={mutacion.isPending}
        onChange={(event) => cambiar(event.target.checked)}
      />
      <p className={styles.textoAyuda}>
        Si se desactiva, los técnicos no verán esta plantación en la app; sus datos pendientes
        igual sincronizan.
      </p>
      {mutacion.isError && (
        <p className={styles.errorAccion} role="alert">
          {mensajeErrorVisibilidad(mutacion.error)}
        </p>
      )}
    </div>
  );
}

/** Muestra u oculta la plantación para los técnicos en Bayka App. */
export function VisibilidadConfigSection() {
  const { id = '' } = useParams();
  const plantacion = useQuery({
    queryKey: ['plantacion', id],
    queryFn: () => obtenerPlantacion(id),
  });

  return (
    <Card title="Visibilidad en Bayka App">
      {plantacion.isPending && <Cargando />}
      {plantacion.isError && (
        <ErrorConReintento
          mensaje="No se pudo cargar la visibilidad."
          onReintentar={() => void plantacion.refetch()}
        />
      )}
      {plantacion.data && <ToggleVisibilidad plantacion={plantacion.data} />}
    </Card>
  );
}
