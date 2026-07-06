import { Card } from '../../components';
import { cx } from '../../lib/classNames';
import { formatearEntero } from '../../lib/formato';
import { porcentaje, type DashboardData } from '../../queries/dashboardQueries';
import styles from './DashboardTab.module.css';

interface KpiCardProps {
  valor: string | number;
  label: string;
  /** true: el valor se pinta en color de alerta (pendientes). */
  alerta?: boolean;
}

/** Tarjeta KPI secundaria, densa: un valor y su etiqueta. */
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
  const avance = porcentaje(totalArboles, objetivo);
  return `${formatearEntero(totalArboles)} de ${formatearEntero(objetivo)} (${avance}%)`;
}

interface KpiHeroProps {
  totalArboles: number;
  objetivoArboles: number | null;
}

/** Métrica protagonista: árboles totales en grande; objetivo cuando existe. */
function KpiHero({ totalArboles, objetivoArboles }: KpiHeroProps) {
  return (
    <Card className={styles.kpiHero}>
      <p className={styles.kpiHeroValor}>{formatearEntero(totalArboles)}</p>
      <p className={styles.kpiLabel}>Árboles totales</p>
      {objetivoArboles !== null && (
        <p className={styles.kpiHeroObjetivo}>
          Objetivo: {textoObjetivo(totalArboles, objetivoArboles)}
        </p>
      )}
    </Card>
  );
}

interface KpiCardsProps {
  datos: DashboardData;
  /** Objetivo de árboles (migración 024); null si no está definido. */
  objetivoArboles: number | null;
}

/** Bloque de KPIs: métrica hero + conteos | tasas de calidad | alertas. */
export function KpiCards({ datos, objetivoArboles }: KpiCardsProps) {
  return (
    <div className={styles.kpis}>
      <KpiHero totalArboles={datos.totalArboles} objetivoArboles={objetivoArboles} />
      <div className={styles.kpisSecundarios}>
        <KpiCard valor={formatearEntero(datos.totalParcelas)} label="Parcelas" />
        <KpiCard valor={formatearEntero(datos.totalGrupos)} label="Grupos" />
        <KpiCard valor={formatearEntero(datos.especiesUsadas)} label="Especies" />
        <KpiCard valor={`${datos.porcentajeConGps}%`} label="Con GPS" />
        <KpiCard valor={`${datos.porcentajeConFoto}%`} label="Con foto" />
        <KpiCard
          valor={formatearEntero(datos.arbolesNN)}
          label="N/N pendientes"
          alerta={datos.arbolesNN > 0}
        />
      </div>
    </div>
  );
}
