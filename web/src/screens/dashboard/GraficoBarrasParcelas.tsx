import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import type { DistribucionParcela } from '../../queries/dashboardQueries';
import { COLOR_GRAFICO_BARRAS, COLOR_GRAFICO_GRILLA } from '../../theme/chartColors';
import { GraficoCard } from './GraficoCard';

/** Barras de cantidad de árboles por parcela, etiquetadas por código. */
export function GraficoBarrasParcelas({ distribucion }: { distribucion: DistribucionParcela[] }) {
  return (
    <GraficoCard titulo="Árboles por parcela">
      <BarChart data={distribucion}>
        <CartesianGrid stroke={COLOR_GRAFICO_GRILLA} vertical={false} />
        <XAxis dataKey="codigo" />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="cantidad" name="Árboles" fill={COLOR_GRAFICO_BARRAS} />
      </BarChart>
    </GraficoCard>
  );
}
