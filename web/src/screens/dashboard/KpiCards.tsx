import { Card } from '../../components';
import { cx } from '../../lib/classNames';
import { porcentaje, type DashboardData } from '../../queries/dashboardQueries';
import styles from './DashboardTab.module.css';

interface KpiCardProps {
  valor: string | number;
  label: string;
  /** true: el valor se pinta en color de alerta (pendientes). */
  alerta?: boolean;
}

function KpiCard({ valor, label, alerta = false }: KpiCardProps) {
  return (
    <Card className={styles.kpiCard}>
      <p className={cx(styles.kpiValor, alerta && styles.kpiAlerta)}>{valor}</p>
      <p className={styles.kpiLabel}>{label}</p>
    </Card>
  );
}

/** Progreso hacia el objetivo de árboles de la plantación. */
function textoObjetivo(totalArboles: number, objetivo: number): string {
  return `${totalArboles} de ${objetivo} (${porcentaje(totalArboles, objetivo)}%)`;
}

interface KpiCardsProps {
  datos: DashboardData;
  /** Objetivo de árboles (migración 024); null si no está definido. */
  objetivoArboles: number | null;
}

/** Fila de tarjetas KPI del dashboard. */
export function KpiCards({ datos, objetivoArboles }: KpiCardsProps) {
  return (
    <div className={styles.kpis}>
      <KpiCard valor={datos.totalArboles} label="Árboles totales" />
      <KpiCard valor={datos.totalParcelas} label="Parcelas" />
      <KpiCard valor={datos.totalGrupos} label="Grupos" />
      <KpiCard valor={datos.especiesUsadas} label="Especies" />
      <KpiCard valor={`${datos.porcentajeConGps}%`} label="Con GPS" />
      <KpiCard valor={`${datos.porcentajeConFoto}%`} label="Con foto" />
      <KpiCard valor={datos.arbolesNN} label="N/N pendientes" alerta={datos.arbolesNN > 0} />
      {objetivoArboles !== null && (
        <KpiCard valor={textoObjetivo(datos.totalArboles, objetivoArboles)} label="Objetivo" />
      )}
    </div>
  );
}
