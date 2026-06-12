import { useQueryClient } from '@tanstack/react-query';

/** Invalida el detalle de la plantación y el listado general (badges/stats). */
export function useInvalidarPlantacion(plantationId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['plantacion', plantationId] }),
      queryClient.invalidateQueries({ queryKey: ['plantaciones'] }),
    ]);
}
