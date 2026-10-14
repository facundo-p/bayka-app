import { createContext, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { coloresDeHabilitadas, consultaEspeciesHabilitadas } from '../services/coloresDePlantacion';
import { colorEspeciePorCodigo, type ColorEspecie } from '../theme/coloresEspecie';

export type ColoresEspecie = {
  colorDe: ColorEspecie;
  /** false mientras se leen las especies: pintar antes haría parpadear los colores. */
  listo: boolean;
};

/** Colores de especie de la plantación (#845): el lugar fijo de cada especie habilitada. */
export function useColoresEspecie(plantationId: string): ColoresEspecie {
  const conPlantacion = plantationId !== '';
  const { data, isPending } = useQuery({
    ...consultaEspeciesHabilitadas(plantationId),
    enabled: conPlantacion,
  });
  const colorDe = useMemo(() => coloresDeHabilitadas(data), [data]);
  return { colorDe, listo: !conPlantacion || !isPending };
}

/** Colores de la vista para las celdas y paneles que la componen; sin provider, por hash. */
export const ColoresEspecieContext = createContext<ColorEspecie>(colorEspeciePorCodigo);

export function useColorEspecie(): ColorEspecie {
  return useContext(ColoresEspecieContext);
}
