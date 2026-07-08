import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import {
  listarPlantaciones,
  type PlantacionConStats,
} from '../queries/plantationQueries';
import { formatearEntero } from '../lib/formato';
import styles from './SeasonCard.module.css';

/** Temporada activa = la plantación 'activa' con más árboles registrados.
 *  Heurística sin campo dedicado de "temporada en curso" en el modelo. */
function temporadaActiva(plantaciones: PlantacionConStats[]): PlantacionConStats | null {
  const activas = plantaciones.filter((plantacion) => plantacion.estado === 'activa');
  if (activas.length === 0) return null;
  return activas.reduce((mejor, actual) => (actual.arboles > mejor.arboles ? actual : mejor));
}

function porcentajeObjetivo(arboles: number, objetivo: number | null): number | null {
  if (!objetivo || objetivo <= 0) return null;
  return Math.min(100, Math.round((arboles / objetivo) * 100));
}

/** Card "Temporada activa" del sidebar. No renderiza nada si no hay activa. */
export function SeasonCard() {
  const { data, isLoading } = useQuery({ queryKey: ['plantaciones'], queryFn: listarPlantaciones });
  if (isLoading || !data) return null;

  const temporada = temporadaActiva(data);
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
