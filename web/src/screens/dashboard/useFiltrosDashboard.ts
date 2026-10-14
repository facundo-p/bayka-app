import { useMemo, useState } from 'react';
import type { FiltrosDashboard } from '../../queries/dashboardQueries';
import type { ParcelaConStats } from '../../queries/dataExplorerQueries';
import { alternar } from './filtrosDashboard';

/** Parcela y especie elegidas en el dashboard: una de cada una a la vez. */
export function useFiltrosDashboard(parcelas: ParcelaConStats[]) {
  const [parcelaElegida, setParcelaElegida] = useState<string | null>(null);
  const [especieCodigo, setEspecieCodigo] = useState<string | null>(null);
  // Si la parcela elegida ya no está en la lista, ese filtro se cae solo.
  const parcela = parcelas.find((candidata) => candidata.id === parcelaElegida) ?? null;
  const parcelaId = parcela?.id ?? null;
  const filtros: FiltrosDashboard = useMemo(
    () => ({ parcelaId, especieCodigo }),
    [parcelaId, especieCodigo],
  );
  return {
    parcela,
    filtros,
    alternarParcela: (id: string) => setParcelaElegida((actual) => alternar(actual, id)),
    alternarEspecie: (codigo: string) => setEspecieCodigo((actual) => alternar(actual, codigo)),
    limpiar: () => {
      setParcelaElegida(null);
      setEspecieCodigo(null);
    },
  };
}
