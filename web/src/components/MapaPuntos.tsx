import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { cx } from '../lib/classNames';
import type { PuntoGps } from '../queries/mapaQueries';
import { COLOR_GRAFICO_NN } from '../theme/chartColors';
import styles from './MapaPuntos.module.css';

/** Capa base satelital sin API key (Esri World Imagery). */
const TILE_SATELITE =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

/** Zoom inicial cuando hay un único punto (fitBounds degenera con bounds nulos). */
const ZOOM_PUNTO_UNICO = 17;

/** Borde blanco del punto: color JS de Leaflet (mismo caso que chartColors). */
const BORDE_PUNTO = '#ffffff';

/** Variante de tamaño: panel del dashboard (360px) o compacto del modal (220px). */
type VarianteMapa = 'panel' | 'compacto';

interface MapaPuntosProps {
  puntos: PuntoGps[];
  colorPorCodigo: Map<string, string>;
  variante?: VarianteMapa;
}

function colorDePunto(punto: PuntoGps, colorPorCodigo: Map<string, string>): string {
  return colorPorCodigo.get(punto.codigo) ?? COLOR_GRAFICO_NN;
}

/** Ajusta la vista a los puntos y revalida el tamaño tras montar (evita tiles
 *  grises cuando el panel aparece al cambiar de tab). */
function AjustarVista({ puntos }: { puntos: PuntoGps[] }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    if (puntos.length === 0) return;
    if (puntos.length === 1) {
      map.setView([puntos[0].lat, puntos[0].lng], ZOOM_PUNTO_UNICO);
      return;
    }
    const limites = L.latLngBounds(puntos.map((punto) => [punto.lat, punto.lng]));
    map.fitBounds(limites, { padding: [24, 24] });
  }, [map, puntos]);
  return null;
}

/** Renderer canvas único: dibuja los ~7600 puntos en un solo elemento en vez de
 *  miles de markers DOM. Por eso NO se usa markercluster: el canvas absorbe el
 *  volumen sin agrupar. */
function CapaPuntos({
  puntos,
  colorPorCodigo,
}: {
  puntos: PuntoGps[];
  colorPorCodigo: Map<string, string>;
}) {
  const renderer = useMemo(() => L.canvas(), []);
  return (
    <>
      {puntos.map((punto, indice) => (
        <CircleMarker
          key={indice}
          center={[punto.lat, punto.lng]}
          renderer={renderer}
          radius={4}
          weight={1}
          color={BORDE_PUNTO}
          fillColor={colorDePunto(punto, colorPorCodigo)}
          fillOpacity={1}
        />
      ))}
    </>
  );
}

/**
 * Núcleo reutilizable del mapa: contenedor satelital con un CircleMarker por
 * punto GPS coloreado por especie. Sin puntos no renderiza nada (el caller
 * maneja su propio estado vacío). Usado por el panel del dashboard
 * (`PlantationMap`) y el detalle de un árbol (`ArbolDetalleModal`).
 */
export function MapaPuntos({ puntos, colorPorCodigo, variante = 'panel' }: MapaPuntosProps) {
  if (puntos.length === 0) return null;
  return (
    <div className={cx(styles.contenedor, styles[variante])}>
      <MapContainer scrollWheelZoom={false} zoomControl center={[0, 0]} zoom={2}>
        <TileLayer url={TILE_SATELITE} attribution="Imágenes © Esri, Maxar" maxZoom={19} />
        <CapaPuntos puntos={puntos} colorPorCodigo={colorPorCodigo} />
        <AjustarVista puntos={puntos} />
      </MapContainer>
    </div>
  );
}
