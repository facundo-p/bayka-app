import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import { formatearMes } from '../../lib/fechas';
import type { RegistrosMes } from '../../queries/dashboardQueries';
import { COLOR_GRAFICO_GRILLA, COLOR_GRAFICO_LINEA } from '../../theme/chartColors';
import { GraficoCard } from './GraficoCard';

const GROSOR_LINEA = 2;

/** Línea de registros por mes ('YYYY-MM'), a lo ancho de la grilla. */
export function GraficoLineaMensual({ registros }: { registros: RegistrosMes[] }) {
  return (
    <GraficoCard titulo="Registros por mes" ancho>
      <LineChart data={registros}>
        <CartesianGrid stroke={COLOR_GRAFICO_GRILLA} vertical={false} />
        <XAxis dataKey="mes" tickFormatter={formatearMes} />
        <YAxis allowDecimals={false} />
        <Tooltip labelFormatter={(mes) => formatearMes(String(mes))} />
        <Line
          type="monotone"
          dataKey="cantidad"
          name="Registros"
          stroke={COLOR_GRAFICO_LINEA}
          strokeWidth={GROSOR_LINEA}
        />
      </LineChart>
    </GraficoCard>
  );
}
