import { useParams } from 'react-router';
import type { ParcelaConStats } from '../../queries/dataExplorerQueries';
import { COLUMNAS_PARCELAS } from './columnas';
import { filtrosAParams } from './filtrosUrl';
import { SeccionTablaDatos, type TextosSeccion } from './SeccionTablaDatos';
import { SEGMENTO_DATOS, useIrASeccion } from './seccionesDatos';
import { useParcelasDatos } from './useDatosQueries';

const TEXTOS: TextosSeccion = {
  unidad: 'parcelas',
  cargando: 'Cargando parcelas…',
  error: 'No se pudieron cargar las parcelas.',
  pie: 'Clic en una fila abre los grupos de la parcela',
  vacio: 'La plantación todavía no tiene parcelas',
};

/** Parcelas activas con sus conteos; cada fila abre sus grupos. */
export function ParcelasSection() {
  const { id = '' } = useParams();
  const irA = useIrASeccion();
  const parcelas = useParcelasDatos(id);
  const verGrupos = (parcela: ParcelaConStats) =>
    irA(SEGMENTO_DATOS.grupos, filtrosAParams({ parcelaId: parcela.id }));
  return (
    <SeccionTablaDatos
      segmento={SEGMENTO_DATOS.parcelas}
      consultas={[parcelas]}
      filas={parcelas.data}
      textos={TEXTOS}
      columnas={COLUMNAS_PARCELAS}
      onRowClick={verGrupos}
    />
  );
}
