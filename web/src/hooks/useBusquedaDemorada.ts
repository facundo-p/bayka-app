import { useState } from 'react';
import { useDebounce } from './useDebounce';

/** Lo que tarda el filtro en seguir al tipeo: filtrar en cada tecla hace saltar la tabla. */
export const DEMORA_BUSQUEDA_MS = 200;

/** Texto del buscador de un listado: el valor del input y el que filtra, demorado. */
export function useBusquedaDemorada() {
  const [busqueda, setBusqueda] = useState('');
  const busquedaDemorada = useDebounce(busqueda, DEMORA_BUSQUEDA_MS);
  return { busqueda, setBusqueda, busquedaDemorada };
}
