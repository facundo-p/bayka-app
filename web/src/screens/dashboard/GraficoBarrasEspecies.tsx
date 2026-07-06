import { Bar, BarChart, Cell, Tooltip, XAxis, YAxis } from 'recharts';
import { porcentaje, type DistribucionEspecie } from '../../queries/dashboardQueries';
import { COLOR_GRAFICO_GRILLA } from '../../theme/chartColors';
import { GraficoCard } from './GraficoCard';
import { prepararRankingEspecies } from './prepararRankingEspecies';

/** Ancho del eje Y con los nombres de especie (caben etiquetas largas). */
const ANCHO_EJE_ESPECIES = 110;

/** Barras horizontales de árboles por especie, ordenadas de mayor a menor.
 *  N/N ("Sin identificar") en amarillo; el ranking se lee en el eje Y. */
export function GraficoBarrasEspecies({ distribucion }: { distribucion: DistribucionEspecie[] }) {
  const barras = prepararRankingEspecies(distribucion);
  const total = barras.reduce((suma, barra) => suma + barra.cantidad, 0);
  return (
    <GraficoCard titulo="Árboles por especie">
      <BarChart data={barras} layout="vertical">
        <XAxis type="number" allowDecimals={false} stroke={COLOR_GRAFICO_GRILLA} />
        <YAxis type="category" dataKey="nombre" width={ANCHO_EJE_ESPECIES} />
        <Tooltip formatter={(valor) => `${valor} (${porcentaje(Number(valor), total)}%)`} />
        <Bar dataKey="cantidad" name="Árboles">
          {barras.map((barra) => (
            <Cell key={barra.nombre} fill={barra.color} />
          ))}
        </Bar>
      </BarChart>
    </GraficoCard>
  );
}
