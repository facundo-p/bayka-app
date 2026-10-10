import { useCallback, useMemo } from 'react';
import { concordar, formatearEntero, type Sustantivo } from '../lib/formato';
import type { PuntoGps } from '../queries/mapaQueries';
import { fichaDePunto, type ParcelaFicha } from './mapa/fichaPunto';
import { MapaPuntos } from './mapa/MapaPuntos';
import { PopupArbol } from './mapa/PopupArbol';
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
  /** Nombre de la especie cuando el mapa está filtrado. */
  especieFiltro?: string;
  /** Para nombrar la parcela del árbol en el popup. */
  parcelas?: ParcelaFicha[];
}

function subtituloMapa(parcelaFiltro?: string, especieFiltro?: string): string {
  const filtros = [parcelaFiltro && `Parcela ${parcelaFiltro}`, especieFiltro].filter(Boolean);
  return filtros.length > 0 ? filtros.join(' · ') : 'Puntos GPS registrados';
}

function textoVacio(parcelaFiltro?: string, especieFiltro?: string): string {
  if (!parcelaFiltro && !especieFiltro) return 'Sin puntos GPS todavía';
  const deEspecie = especieFiltro ? ` de ${especieFiltro}` : '';
  const enParcela = parcelaFiltro ? ` en la parcela ${parcelaFiltro}` : '';
  return `Sin puntos GPS${deEspecie}${enParcela}`;
}

/** El popup nombra la parcela con las que ya cargó la pantalla, sin pedir nada. */
function usePopupArbol(parcelas: ParcelaFicha[], colorPorCodigo: Map<string, string>) {
  const parcelasPorId = useMemo(
    () => new Map(parcelas.map((parcela) => [parcela.id, parcela])),
    [parcelas],
  );
  return useCallback(
    (punto: PuntoGps) => <PopupArbol ficha={fichaDePunto(punto, parcelasPorId, colorPorCodigo)} />,
    [parcelasPorId, colorPorCodigo],
  );
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

const SIN_PARCELAS: ParcelaFicha[] = [];

/** Panel del dashboard: chrome (título + leyenda + chip) sobre el mapa satelital. */
export function PlantationMap(props: PlantationMapProps) {
  const { puntos, leyenda, parcelaFiltro, especieFiltro, parcelas = SIN_PARCELAS } = props;
  const colorPorCodigo = useMemo(
    () => new Map(leyenda.map(({ codigo, color }) => [codigo, color])),
    [leyenda],
  );
  const popup = usePopupArbol(parcelas, colorPorCodigo);
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.tituloFila}>
          <h3 className={styles.titulo}>Mapa de la plantación</h3>
          <p className={styles.subtitulo}>
            {subtituloMapa(parcelaFiltro, especieFiltro)} · imagen satelital
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
        <div className={styles.vacio}>{textoVacio(parcelaFiltro, especieFiltro)}</div>
      ) : (
        <MapaPuntos
          puntos={puntos}
          colorPorCodigo={colorPorCodigo}
          variante="panel"
          popup={popup}
        />
      )}
    </div>
  );
}
