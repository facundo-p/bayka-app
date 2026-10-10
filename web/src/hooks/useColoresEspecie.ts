import { createContext, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { coloresDeHabilitadas, consultaEspeciesHabilitadas } from '../services/coloresDePlantacion';
import { coloresDeEspecies, type ColorEspecie } from '../theme/coloresEspecie';

const SEPARADOR_CLAVE = '\n';

export type ColoresEspecie = {
  colorDe: ColorEspecie;
  /** false mientras se leen las especies: pintar antes haría parpadear los colores. */
  listo: boolean;
};

/**
 * Colores de especie de la plantación (#777). `presentes` son los códigos de la
 * vista: solo se usan si la plantación no tiene especies habilitadas legibles.
 */
export function useColoresEspecie(
  plantationId: string,
  presentes: readonly string[],
): ColoresEspecie {
  const conPlantacion = plantationId !== '';
  const { data, isPending } = useQuery({
    ...consultaEspeciesHabilitadas(plantationId),
    enabled: conPlantacion,
  });
  // Una clave de texto evita recalcular cuando cambia solo la referencia del array.
  const clavePresentes = presentes.join(SEPARADOR_CLAVE);
  const colorDe = useMemo(
    () => coloresDeHabilitadas(data, clavePresentes.split(SEPARADOR_CLAVE)),
    [data, clavePresentes],
  );
  return { colorDe, listo: !conPlantacion || !isPending };
}

/** Colores de la vista para las celdas y paneles que la componen. */
export const ColoresEspecieContext = createContext<ColorEspecie>(coloresDeEspecies([]));

export function useColorEspecie(): ColorEspecie {
  return useContext(ColoresEspecieContext);
}
