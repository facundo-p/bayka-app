import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import {
  listarPlantaciones,
  obtenerTemporadaActivaId,
} from '../queries/plantationQueries';
import { formatearEntero } from '../lib/formato';
import styles from './SeasonCard.module.css';

function porcentajeObjetivo(arboles: number, objetivo: number | null): number | null {
  if (!objetivo || objetivo <= 0) return null;
  return Math.min(100, Math.round((arboles / objetivo) * 100));
}

/** Card "Temporada activa" del sidebar: la última plantación activa en la que se
 *  cargaron árboles (registro más reciente). No renderiza nada si no la hay. */
export function SeasonCard() {
  const { data } = useQuery({ queryKey: ['plantaciones'], queryFn: listarPlantaciones });
  const { data: temporadaId } = useQuery({
    queryKey: ['temporada-activa'],
    queryFn: obtenerTemporadaActivaId,
  });
  if (!data || !temporadaId) return null;

  const temporada = data.find((plantacion) => plantacion.id === temporadaId);
  if (!temporada) return null;

  const pct = porcentajeObjetivo(temporada.arboles, temporada.objetivoArboles);
  const ancho = pct ?? Math.min(100, temporada.arboles > 0 ? 100 : 0);

  return (
    <Link to={`/plantaciones/${temporada.id}`} className={styles.card}>
      <span className={styles.overline}>Temporada activa</span>
      <div className={styles.periodoFila}>
        <span className={styles.punto} aria-hidden />
        <span className={styles.periodo}>{temporada.periodo}</span>
      </div>
      <span className={styles.lugar}>{temporada.lugar}</span>
      <div className={styles.barra}>
        <div className={styles.relleno} style={{ width: `${ancho}%` }} />
      </div>
      <span className={styles.pie}>
        {formatearEntero(temporada.arboles)} árboles
        {pct !== null && ` · ${pct}%`}
      </span>
    </Link>
  );
}
