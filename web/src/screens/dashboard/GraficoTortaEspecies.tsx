import { Cell, Legend, Pie, PieChart, Tooltip } from 'recharts';
import { porcentaje, type DistribucionEspecie } from '../../queries/dashboardQueries';
import { GraficoCard } from './GraficoCard';
import { prepararTorta } from './prepararTorta';

/** Torta por especie: minoritarias en "Otras", N/N en amarillo. */
export function GraficoTortaEspecies({ distribucion }: { distribucion: DistribucionEspecie[] }) {
  const segmentos = prepararTorta(distribucion);
  const total = segmentos.reduce((suma, segmento) => suma + segmento.cantidad, 0);
  return (
    <GraficoCard titulo="Árboles por especie">
      <PieChart>
        <Pie data={segmentos} dataKey="cantidad" nameKey="nombre">
          {segmentos.map((segmento) => (
            <Cell key={segmento.nombre} fill={segmento.color} />
          ))}
        </Pie>
        <Tooltip formatter={(valor) => `${valor} (${porcentaje(Number(valor), total)}%)`} />
        <Legend />
      </PieChart>
    </GraficoCard>
  );
}
