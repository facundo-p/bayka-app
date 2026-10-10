import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { coloresDeHabilitadas, consultaEspeciesHabilitadas } from '../services/coloresDePlantacion';
import type { EspecieDePlantacion } from '../queries/especieQueries';
import type { ColorEspecie } from '../theme/coloresEspecie';
import { useIdPlantacion } from './useIdPlantacion';

const SIN_ESPECIES: EspecieDePlantacion[] = [];

/** Color de cada especie en la plantación de la ruta (#777). */
export function useColoresEspecie(): ColorEspecie {
  const plantationId = useIdPlantacion();
  const { data } = useQuery({
    ...consultaEspeciesHabilitadas(plantationId),
    enabled: plantationId !== '',
  });
  return useMemo(() => coloresDeHabilitadas(data ?? SIN_ESPECIES), [data]);
}
