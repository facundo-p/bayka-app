import { useMemo } from 'react';
import type { PuntoGps } from '../queries/mapaQueries';
import { MapaPuntos } from './mapa/MapaPuntos';
import styles from './PlantationMap.module.css';

/** Especie de la leyenda. Tipo estructural: el mapa no importa de `screens/`. */
export interface EspecieLeyenda {
  codigo: string;
  nombre: string;
  color: string;
}

interface PlantationMapProps {
  puntos: PuntoGps[];
  /** Especies del alcance visible: los nombres salen de acá y no de los puntos. */
  leyenda: EspecieLeyenda[];
  /** Código de la parcela cuando el mapa está filtrado. */
  parcelaFiltro?: string;
}

/** Panel del dashboard: chrome (título) sobre el mapa satelital. */
export function PlantationMap({ puntos, leyenda, parcelaFiltro }: PlantationMapProps) {
  const colorPorCodigo = useMemo(
    () => new Map(leyenda.map(({ codigo, color }) => [codigo, color])),
    [leyenda],
  );
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.tituloFila}>
          <h3 className={styles.titulo}>Mapa de la plantación</h3>
          <p className={styles.subtitulo}>
            {parcelaFiltro ? `Parcela ${parcelaFiltro}` : 'Puntos GPS registrados'} · imagen
            satelital
          </p>
        </div>
      </div>
      {puntos.length === 0 ? (
        <div className={styles.vacio}>
          {parcelaFiltro
            ? `Sin puntos GPS en la parcela ${parcelaFiltro}`
            : 'Sin puntos GPS todavía'}
        </div>
      ) : (
        <MapaPuntos puntos={puntos} colorPorCodigo={colorPorCodigo} variante="panel" />
      )}
    </div>
  );
}
