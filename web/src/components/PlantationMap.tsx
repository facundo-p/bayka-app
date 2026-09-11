import { useMemo } from 'react';
import { concordar, formatearEntero, type Sustantivo } from '../lib/formato';
import type { PuntoGps } from '../queries/mapaQueries';
import { MapaPuntos } from './mapa/MapaPuntos';
import { PuntoColor } from './PuntoColor';
import styles from './PlantationMap.module.css';

/** Cantidad de especies que entran en la leyenda (las principales por orden). */
const MAX_LEYENDA = 6;

const PUNTO: Sustantivo = { singular: 'punto', plural: 'puntos' };

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

function Leyenda({ leyenda }: { leyenda: EspecieLeyenda[] }) {
  return (
    <div className={styles.leyenda}>
      {leyenda.slice(0, MAX_LEYENDA).map(({ codigo, nombre, color }) => (
        <span key={codigo} className={styles.item}>
          <PuntoColor color={color} tamano="lg" conAro />
          {nombre}
        </span>
      ))}
    </div>
  );
}

/** Panel del dashboard: chrome (título + leyenda + chip) sobre el mapa satelital. */
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
        <div className={styles.headerDerecha}>
          {puntos.length > 0 && <Leyenda leyenda={leyenda} />}
          <span className={styles.chip}>
            <span className={styles.chipNumero}>{formatearEntero(puntos.length)}</span>
            {concordar(puntos.length, PUNTO)}
          </span>
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
