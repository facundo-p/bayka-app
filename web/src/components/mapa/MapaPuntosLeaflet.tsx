import { memo, useEffect, useMemo, type ReactNode } from 'react';
import L, { type LatLngTuple } from 'leaflet';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { CAPA_SATELITE } from '../../lib/capaSatelite';
import { cx } from '../../lib/classNames';
import { colorDePunto } from './fichaPunto';
import { clavesDePuntos } from './clavesDePuntos';
import { useSeleccionPunto, type SeleccionPunto } from './seleccionPunto';
import { VARIANTE_MAPA_POR_DEFECTO, type MapaPuntosProps, type PuntoGps } from './types';
import styles from './MapaPuntos.module.css';

/** Zoom inicial cuando hay un único punto (fitBounds degenera con bounds nulos). */
const ZOOM_PUNTO_UNICO = 17;

/** Borde blanco del punto: color JS de Leaflet (mismo caso que chartColors). */
const BORDE_PUNTO = '#ffffff';

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

type SeleccionarPunto = (punto: PuntoGps) => void;

/** Renderer canvas único: dibuja los ~7600 puntos en un solo elemento en vez de
 *  miles de markers DOM. Por eso NO se usa markercluster: el canvas absorbe el
 *  volumen sin agrupar. Memo: abrir o cerrar el popup no redibuja los puntos. */
const CapaPuntos = memo(function CapaPuntos({
  puntos,
  colorPorCodigo,
  onSeleccionar,
}: {
  puntos: PuntoGps[];
  colorPorCodigo: Map<string, string>;
  onSeleccionar?: SeleccionarPunto;
}) {
  const renderer = useMemo(() => L.canvas(), []);
  const claves = useMemo(() => clavesDePuntos(puntos), [puntos]);
  // El estilo va por `pathOptions`: react-leaflet ignora `fillColor` y compañía
  // cuando cambian en un marker ya montado, y al filtrar los markers se reutilizan.
  return (
    <>
      {puntos.map((punto, indice) => (
        <CircleMarker
          key={claves[indice]}
          center={[punto.lat, punto.lng]}
          renderer={renderer}
          radius={4}
          pathOptions={{
            weight: 1,
            color: BORDE_PUNTO,
            fillColor: colorDePunto(punto, colorPorCodigo),
            fillOpacity: 1,
          }}
          eventHandlers={onSeleccionar && { click: () => onSeleccionar(punto) }}
        />
      ))}
    </>
  );
});

interface PopupDePuntoProps {
  seleccion: SeleccionPunto;
  onCerrar: (id: number) => void;
  children: ReactNode;
}

/** La posición va memoizada: si cambia de referencia, react-leaflet cierra y
 *  reabre el popup en cada render. */
function PopupDePunto({ seleccion, onCerrar, children }: PopupDePuntoProps) {
  const { punto, id } = seleccion;
  const posicion = useMemo<LatLngTuple>(() => [punto.lat, punto.lng], [punto]);
  return (
    <Popup position={posicion} eventHandlers={{ remove: () => onCerrar(id) }}>
      {children}
    </Popup>
  );
}

function PuntosConPopup({ puntos, colorPorCodigo, popup }: MapaPuntosProps) {
  const { seleccion, seleccionar, cerrar } = useSeleccionPunto(puntos);
  return (
    <>
      <CapaPuntos
        puntos={puntos}
        colorPorCodigo={colorPorCodigo}
        onSeleccionar={popup && seleccionar}
      />
      {popup && seleccion && (
        <PopupDePunto key={seleccion.id} seleccion={seleccion} onCerrar={cerrar}>
          {popup(seleccion.punto)}
        </PopupDePunto>
      )}
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
  popup,
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
        <PuntosConPopup puntos={puntos} colorPorCodigo={colorPorCodigo} popup={popup} />
        <AjustarVista puntos={puntos} />
      </MapContainer>
    </div>
  );
}
