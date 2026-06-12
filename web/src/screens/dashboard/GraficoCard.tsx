import type { ReactElement } from 'react';
import { ResponsiveContainer } from 'recharts';
import { Card } from '../../components';
import { cx } from '../../lib/classNames';
import styles from './DashboardTab.module.css';

interface GraficoCardProps {
  titulo: string;
  /** true: el gráfico ocupa todo el ancho de la grilla. */
  ancho?: boolean;
  children: ReactElement;
}

/** Card con título y área de dibujo de altura fija para un gráfico Recharts. */
export function GraficoCard({ titulo, ancho = false, children }: GraficoCardProps) {
  return (
    <Card title={titulo} className={cx(ancho && styles.graficoAncho)}>
      <div className={styles.grafico}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
