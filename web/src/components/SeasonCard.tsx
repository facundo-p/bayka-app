import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { CLAVE_QUERY } from '../queries/clavesQuery';
import { listarPlantaciones, obtenerTemporadaActivaId } from '../queries/plantationQueries';
import { formatearEntero, PORCENTAJE_COMPLETO, porcentajeDeObjetivo } from '../lib/formato';
import { rutaPlantacion } from '../lib/rutas';
import { BarraProgreso } from './BarraProgreso';
import styles from './SeasonCard.module.css';

/** La última plantación activa en la que se cargaron árboles (registro más reciente). */
function useTemporadaActiva() {
  const { data } = useQuery({ queryKey: CLAVE_QUERY.plantaciones(), queryFn: listarPlantaciones });
  const { data: temporadaId } = useQuery({
    queryKey: CLAVE_QUERY.temporadaActiva(),
    queryFn: obtenerTemporadaActivaId,
  });
  if (!temporadaId) return undefined;
  return data?.find((plantacion) => plantacion.id === temporadaId);
}

/** Sin meta, la barra se llena en cuanto hay árboles: la temporada ya arrancó. */
function anchoBarra(arboles: number, avance: number | null): number {
  if (avance !== null) return avance;
  return arboles > 0 ? PORCENTAJE_COMPLETO : 0;
}

/** Card "Temporada activa" del sidebar. No renderiza nada si no hay temporada. */
export function SeasonCard() {
  const temporada = useTemporadaActiva();
  if (!temporada) return null;
  const avance = porcentajeDeObjetivo(temporada.arboles, temporada.objetivoArboles);
  return (
    <Link to={rutaPlantacion(temporada.id)} className={styles.card}>
      <span className={styles.overline}>Temporada activa</span>
      <div className={styles.periodoFila}>
        <span className={styles.punto} aria-hidden />
        <span className={styles.periodo}>{temporada.periodo}</span>
      </div>
      <span className={styles.lugar}>{temporada.lugar}</span>
      <BarraProgreso alto="md" porcentaje={anchoBarra(temporada.arboles, avance)} />
      <span className={styles.pie}>
        {formatearEntero(temporada.arboles)} árboles
        {avance !== null && ` · ${avance}%`}
      </span>
    </Link>
  );
}
