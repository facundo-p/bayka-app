import { useState } from 'react';
import type { ParcelaConStats } from '../../queries/dataExplorerQueries';
import type { AlcanceMetrica } from './ResumenPlantacion';

/** Parcela elegida en la tira del dashboard: clickear la misma la suelta. */
export function useFiltroParcela(parcelas: ParcelaConStats[]) {
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  // Si la parcela seleccionada ya no está en la lista, el filtro se cae solo.
  const parcela = parcelas.find((candidata) => candidata.id === seleccionada) ?? null;
  const alternar = (id: string) => setSeleccionada((actual) => (actual === id ? null : id));
  const alcance: AlcanceMetrica | undefined = parcela
    ? { codigo: parcela.codigo, nombre: parcela.nombre, onVerTodos: () => setSeleccionada(null) }
    : undefined;
  return { parcela, alcance, alternar };
}
