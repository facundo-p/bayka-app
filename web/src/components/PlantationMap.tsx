import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { formatearEntero } from '../lib/formato';
import type { PuntoGps } from '../queries/mapaQueries';
import { COLOR_GRAFICO_NN } from '../theme/chartColors';
import styles from './PlantationMap.module.css';

/** Cantidad de especies que entran en la leyenda (las principales por orden). */
const MAX_LEYENDA = 6;

/** Capa base satelital sin API key (Esri World Imagery). */
const TILE_SATELITE =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

/** Zoom inicial cuando hay un único punto (fitBounds degenera con bounds nulos). */
const ZOOM_PUNTO_UNICO = 17;

/** Borde blanco del punto: color JS de Leaflet (mismo caso que chartColors). */
const BORDE_PUNTO = '#ffffff';

interface PlantationMapProps {
  puntos: PuntoGps[];
  colorPorCodigo: Map<string, string>;
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

/** Mapa satelital con un punto GPS por árbol, coloreado por especie. */
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
          <div className={styles.mapa}>
            <MapContainer scrollWheelZoom={false} zoomControl center={[0, 0]} zoom={2}>
              <TileLayer
                url={TILE_SATELITE}
                attribution="Imágenes © Esri, Maxar"
                maxZoom={19}
              />
              <CapaPuntos puntos={puntos} colorPorCodigo={colorPorCodigo} />
              <AjustarVista puntos={puntos} />
            </MapContainer>
          </div>
          <Leyenda puntos={puntos} colorPorCodigo={colorPorCodigo} />
        </>
      )}
    </div>
  );
}
