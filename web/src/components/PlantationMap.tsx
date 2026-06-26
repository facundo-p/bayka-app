import { useMemo } from 'react';
import { formatearEntero } from '../lib/formato';
import type { PuntoGps } from '../queries/mapaQueries';
import { MapaPuntos } from './MapaPuntos';
import styles from './PlantationMap.module.css';

/** Cantidad de especies que entran en la leyenda (las principales por orden). */
const MAX_LEYENDA = 6;

interface PlantationMapProps {
  puntos: PuntoGps[];
  colorPorCodigo: Map<string, string>;
}

/** Especies de la leyenda: las principales por orden de inserción + N/N si está. */
function especiesLeyenda(colorPorCodigo: Map<string, string>): [string, string][] {
  return [...colorPorCodigo.entries()].slice(0, MAX_LEYENDA);
}

function Leyenda({
  puntos,
  colorPorCodigo,
}: {
  puntos: PuntoGps[];
  colorPorCodigo: Map<string, string>;
}) {
  const nombrePorCodigo = useMemo(
    () => new Map(puntos.map((punto) => [punto.codigo, punto.nombre])),
    [puntos],
  );
  return (
    <div className={styles.leyenda}>
      {especiesLeyenda(colorPorCodigo).map(([codigo, color]) => (
        <span key={codigo} className={styles.item}>
          <span className={styles.punto} style={{ backgroundColor: color }} />
          {nombrePorCodigo.get(codigo) ?? codigo}
        </span>
      ))}
    </div>
  );
}

/** Panel del dashboard: chrome (header + chip + leyenda) sobre el mapa satelital. */
export function PlantationMap({ puntos, colorPorCodigo }: PlantationMapProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.titulo}>Mapa de la plantación</h3>
          <p className={styles.subtitulo}>Puntos GPS registrados · imagen satelital</p>
        </div>
        <span className={styles.chip}>
          <span className={styles.chipNumero}>{formatearEntero(puntos.length)}</span>
          puntos
        </span>
      </div>
      {puntos.length === 0 ? (
        <div className={styles.vacio}>Sin puntos GPS todavía</div>
      ) : (
        <>
          <MapaPuntos puntos={puntos} colorPorCodigo={colorPorCodigo} variante="panel" />
          <Leyenda puntos={puntos} colorPorCodigo={colorPorCodigo} />
        </>
      )}
    </div>
  );
}
