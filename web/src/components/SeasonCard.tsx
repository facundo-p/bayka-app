import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { CLAVE_QUERY } from '../queries/clavesQuery';
import {
  listarPlantaciones,
  obtenerTemporadaActivaId,
} from '../queries/plantationQueries';
import { formatearEntero, PORCENTAJE_COMPLETO, porcentajeDeObjetivo } from '../lib/formato';
import { BarraProgreso } from './BarraProgreso';
import styles from './SeasonCard.module.css';

/** Card "Temporada activa" del sidebar: la última plantación activa en la que se
 *  cargaron árboles (registro más reciente). No renderiza nada si no la hay. */
export function SeasonCard() {
  const { data } = useQuery({ queryKey: CLAVE_QUERY.plantaciones(), queryFn: listarPlantaciones });
  const { data: temporadaId } = useQuery({
    queryKey: CLAVE_QUERY.temporadaActiva(),
    queryFn: obtenerTemporadaActivaId,
  });
  if (!data || !temporadaId) return null;

  const temporada = data.find((plantacion) => plantacion.id === temporadaId);
  if (!temporada) return null;

  const pct = porcentajeDeObjetivo(temporada.arboles, temporada.objetivoArboles);
  const ancho = pct ?? (temporada.arboles > 0 ? PORCENTAJE_COMPLETO : 0);

  return (
    <Link to={`/plantaciones/${temporada.id}`} className={styles.card}>
      <span className={styles.overline}>Temporada activa</span>
      <div className={styles.periodoFila}>
        <span className={styles.punto} aria-hidden />
        <span className={styles.periodo}>{temporada.periodo}</span>
      </div>
      <span className={styles.lugar}>{temporada.lugar}</span>
      <BarraProgreso alto="md" porcentaje={ancho} />
      <span className={styles.pie}>
        {formatearEntero(temporada.arboles)} árboles
        {pct !== null && ` · ${pct}%`}
      </span>
    </Link>
  );
}
