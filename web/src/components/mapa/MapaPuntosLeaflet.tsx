import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { CAPA_SATELITE } from '../../lib/capaSatelite';
import { cx } from '../../lib/classNames';
import {
  areaConMargen,
  esPuntoUnico,
  extremosDe,
  zoomDeEncuadre,
  zoomDePartida,
  zoomSinChequeo,
  type Extremos,
} from '../../lib/mapa/encuadreSatelital';
import { COLOR_GRAFICO_NN } from '../../theme/chartColors';
import { VARIANTE_MAPA_POR_DEFECTO, type MapaPuntosProps, type PuntoGps } from './types';
import styles from './MapaPuntos.module.css';

/** Aire entre los puntos y el borde del mapa, en px. */
const MARGEN_PX = 24;
const MARGEN_AJUSTE = L.point(MARGEN_PX, MARGEN_PX);

/** Borde blanco del punto: color JS de Leaflet (mismo caso que chartColors). */
const BORDE_PUNTO = '#ffffff';

/** Radio y aro del punto en px: miles de puntos chicos en el dashboard, uno
 *  solo y bien visible en el detalle de árbol. */
type EstiloPunto = { radio: number; aro: number };

const ESTILO_PUNTO: Record<NonNullable<MapaPuntosProps['variante']>, EstiloPunto> = {
  panel: { radio: 4, aro: 1 },
  compacto: { radio: 7, aro: 2 },
};

function colorDePunto(punto: PuntoGps, colorPorCodigo: Map<string, string>): string {
  return colorPorCodigo.get(punto.codigo) ?? COLOR_GRAFICO_NN;
}

/** Zoom de partida y área a chequear, con el mismo margen que usa `fitBounds`. */
function planDeEncuadre(map: L.Map, extremos: Extremos) {
  const limites = L.latLngBounds([extremos.sur, extremos.oeste], [extremos.norte, extremos.este]);
  const zoomQueEntra = map.getBoundsZoom(limites, false, MARGEN_AJUSTE.multiplyBy(2));
  const desde = zoomDePartida(zoomQueEntra, esPuntoUnico(extremos));
  if (desde === null) return null;
  const caja = {
    min: map.project(limites.getNorthWest(), desde),
    max: map.project(limites.getSouthEast(), desde),
  };
  return { limites, desde, area: areaConMargen(caja, desde, MARGEN_PX) };
}

/**
 * Encuadra los puntos con el tope seguro y, si Esri tiene imagen más cerca,
 * se acerca (#827). Revalida el tamaño tras montar (evita tiles grises cuando
 * el panel aparece al cambiar de tab).
 */
function AjustarVista({ puntos }: { puntos: PuntoGps[] }) {
  const map = useMap();
  // Por valor: un array nuevo con los mismos bordes no re-encuadra.
  const { sur, oeste, norte, este } = useMemo(() => extremosDe(puntos), [puntos]);
  useEffect(() => {
    let vigente = true;
    map.invalidateSize();
    const plan = planDeEncuadre(map, { sur, oeste, norte, este });
    if (!plan) return;
    const { limites, desde, area } = plan;
    const encuadrarHasta = (maxZoom: number) =>
      map.fitBounds(limites, { padding: MARGEN_AJUSTE, maxZoom });
    encuadrarHasta(zoomSinChequeo(desde));
    void zoomDeEncuadre(area, desde).then((zoom) => {
      if (vigente && zoom !== zoomSinChequeo(desde)) encuadrarHasta(zoom);
    });
    return () => {
      vigente = false;
    };
  }, [map, sur, oeste, norte, este]);
  return null;
}

/** Renderer canvas único: dibuja los ~7600 puntos en un solo elemento en vez de
 *  miles de markers DOM. Por eso NO se usa markercluster: el canvas absorbe el
 *  volumen sin agrupar. */
function CapaPuntos({
  puntos,
  colorPorCodigo,
  estilo,
}: {
  puntos: PuntoGps[];
  colorPorCodigo: Map<string, string>;
  estilo: EstiloPunto;
}) {
  const renderer = useMemo(() => L.canvas(), []);
  return (
    <>
      {puntos.map((punto, indice) => (
        <CircleMarker
          key={indice}
          center={[punto.lat, punto.lng]}
          renderer={renderer}
          radius={estilo.radio}
          weight={estilo.aro}
          color={BORDE_PUNTO}
          fillColor={colorDePunto(punto, colorPorCodigo)}
          fillOpacity={1}
        />
      ))}
    </>
  );
}

/** Implementación Leaflet del mapa: satelital con un CircleMarker por punto GPS
 *  coloreado por especie. Sin puntos no renderiza nada (el caller maneja el
 *  estado vacío). Usada por `PlantationMap` y `ArbolDetallePanel`. */
export function MapaPuntosLeaflet({
  puntos,
  colorPorCodigo,
  variante = VARIANTE_MAPA_POR_DEFECTO,
}: MapaPuntosProps) {
  if (puntos.length === 0) return null;
  return (
    <div className={cx(styles.contenedor, styles[variante])}>
      <MapContainer
        className={styles.mapa}
        scrollWheelZoom={false}
        zoomControl
        center={[0, 0]}
        zoom={2}
      >
        <TileLayer
          url={CAPA_SATELITE.url}
          attribution={CAPA_SATELITE.atribucion}
          maxZoom={CAPA_SATELITE.zoomMaximo}
        />
        <CapaPuntos
          puntos={puntos}
          colorPorCodigo={colorPorCodigo}
          estilo={ESTILO_PUNTO[variante]}
        />
        <AjustarVista puntos={puntos} />
      </MapContainer>
    </div>
  );
}
