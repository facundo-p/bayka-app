import { useState } from 'react';
import { Link, Outlet, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Download, MoreHorizontal, Pencil, Plus } from 'lucide-react';
import {
  Button,
  CabeceraSeccion,
  Cargando,
  Divisor,
  EmptyState,
  ErrorConReintento,
  EstadoPlantacionBadge,
  MenuDesplegable,
  PlantacionFormModal,
  TabNav,
  Topbar,
  type ItemDesplegable,
  type TabItem,
} from '../components';
import { useDescarga } from '../hooks/useDescarga';
import { BP, useMediaQuery } from '../hooks/useMediaQuery';
import { usePlantacion } from '../hooks/usePlantacion';
import { formatearFechaCorta } from '../lib/fechas';
import { CLAVE_QUERY } from '../queries/clavesQuery';
import type { Plantacion } from '../queries/plantationQueries';
import { idsGenerados } from '../queries/idsQueries';
import { listarPuntosGps } from '../queries/mapaQueries';
import { listarFilasExportacion } from '../queries/exportacionQueries';
import { construirKml, nombreArchivoKml, TIPO_MIME_KML } from '../services/exportarKml';
import { descargarTexto } from '../services/descargas';
import { descargarCsvExportacion } from '../services/exportarCsv';
import { descargarXlsxExportacion } from '../services/exportarXlsx';
import { GenerarIdsModal } from './plantaciones/GenerarIdsModal';
import { TAMANO_ICONO } from '../theme/iconos';
import styles from './PlantacionDetailScreen.module.css';

const MENSAJE_SIN_PUNTOS = 'Esta plantación no tiene puntos GPS para exportar.';
const MENSAJE_ERROR_KML = 'No se pudieron cargar los puntos GPS.';
const MENSAJE_SIN_ARBOLES = 'Esta plantación no tiene árboles para exportar.';
const MENSAJE_ERROR_EXPORT = 'No se pudieron cargar los árboles para exportar.';
/** La planilla se arma con los IDs definitivos: sin generarlos no hay qué exportar. */
const MOTIVO_IDS_PENDIENTES = 'Generá los IDs de la plantación para exportar la planilla';

function tabsDePlantacion(id: string): TabItem[] {
  return [
    { to: `/plantaciones/${id}`, label: 'Dashboard', end: true },
    { to: `/plantaciones/${id}/datos`, label: 'Datos' },
    { to: `/plantaciones/${id}/configuracion`, label: 'Configuración' },
  ];
}

function VolverAlListado() {
  return (
    <Link to="/plantaciones" className={styles.volver}>
      ← Volver a plantaciones
    </Link>
  );
}

function PlantacionNoEncontrada() {
  return (
    <EmptyState
      title="Plantación no encontrada"
      description="El enlace puede estar vencido o la plantación fue eliminada."
    >
      <VolverAlListado />
    </EmptyState>
  );
}

/** Línea de metadatos: período · fecha de creación. */
function lineaMeta(plantacion: Plantacion): string {
  return `${plantacion.periodo} · Creada ${formatearFechaCorta(plantacion.createdAt)}`;
}

/** Descarga los puntos GPS como KML (Google Maps/Earth); no descarga si no hay puntos. */
function useDescargaKml(plantacion: Plantacion) {
  return useDescarga(async () => {
    const puntos = await listarPuntosGps(plantacion.id);
    if (puntos.length === 0) return MENSAJE_SIN_PUNTOS;
    const nombreDocumento = `Puntos GPS – ${plantacion.lugar} (${plantacion.periodo})`;
    const kml = construirKml(puntos, { nombreDocumento });
    descargarTexto(kml, nombreArchivoKml(plantacion.lugar, plantacion.periodo), TIPO_MIME_KML);
    return null;
  }, MENSAJE_ERROR_KML);
}

/** Serializador de planilla: recibe las filas ya cargadas y dispara la descarga. */
type DescargarPlanilla = (
  filas: Awaited<ReturnType<typeof listarFilasExportacion>>,
  lugar: string,
  periodo: string,
) => void | Promise<void>;

/** Descarga los árboles como planilla (CSV o XLSX según el serializador); no descarga si no hay árboles. */
function useDescargaPlanilla(plantacion: Plantacion, descargarPlanilla: DescargarPlanilla) {
  return useDescarga(async () => {
    const filas = await listarFilasExportacion(plantacion.id);
    if (filas.length === 0) return MENSAJE_SIN_ARBOLES;
    await descargarPlanilla(filas, plantacion.lugar, plantacion.periodo);
    return null;
  }, MENSAJE_ERROR_EXPORT);
}

type Descarga = ReturnType<typeof useDescargaKml>;

interface AccionesProps {
  kml: Descarga;
  xlsx: Descarga;
  csv: Descarga;
  /** Las planillas necesitan los IDs definitivos; el KML no. */
  idsPendientes: boolean;
  onEditar: () => void;
  /** La generación es exclusiva de la web, server-side vía RPC (#232): abre
   *  el modal de confirmación. */
  onGenerarIds: () => void;
}

/** Las tres descargas como ítems de menú. */
function itemsExportar({ kml, xlsx, csv, idsPendientes }: AccionesProps): ItemDesplegable[] {
  const motivoPlanilla = idsPendientes ? MOTIVO_IDS_PENDIENTES : null;
  return [
    { clave: 'kml', etiqueta: 'Descargar KML', onSeleccionar: () => void kml.descargar() },
    {
      clave: 'xlsx',
      etiqueta: 'Exportar Excel',
      motivo: motivoPlanilla,
      onSeleccionar: () => void xlsx.descargar(),
    },
    {
      clave: 'csv',
      etiqueta: 'Exportar CSV',
      motivo: motivoPlanilla,
      onSeleccionar: () => void csv.descargar(),
    },
  ];
}

/** Barra ancha: cada acción con su propio control. */
function AccionesDesplegadas(props: AccionesProps) {
  const { kml, xlsx, csv, idsPendientes, onEditar, onGenerarIds } = props;
  const descargando = kml.descargando || xlsx.descargando || csv.descargando;
  return (
    <>
      <button
        type="button"
        className={styles.botonIcono}
        onClick={onEditar}
        aria-label="Editar"
        title="Editar"
      >
        <Pencil size={TAMANO_ICONO.md} aria-hidden />
      </button>
      <MenuDesplegable
        etiqueta="Exportar"
        items={itemsExportar(props)}
        disparador={(propsDisparador) => (
          <Button variant="secondary" size="sm" loading={descargando} {...propsDisparador}>
            <Download size={TAMANO_ICONO.md} aria-hidden />
            Exportar
            <ChevronDown size={TAMANO_ICONO.sm} aria-hidden />
          </Button>
        )}
      />
      {idsPendientes && (
        <Button variant="primary" size="sm" onClick={onGenerarIds}>
          <Plus size={TAMANO_ICONO.md} aria-hidden />
          Generar IDs
        </Button>
      )}
    </>
  );
}

/** Barra angosta: las mismas acciones en un solo «⋯». Desplegadas se comen
 *  tres renglones de barra y empujan el contenido fuera del primer pantallazo. */
function AccionesPlegadas(props: AccionesProps) {
  const items: ItemDesplegable[] = [
    { clave: 'editar', etiqueta: 'Editar plantación', onSeleccionar: props.onEditar },
    ...itemsExportar(props),
  ];
  if (props.idsPendientes) {
    items.push({ clave: 'ids', etiqueta: 'Generar IDs', onSeleccionar: props.onGenerarIds });
  }
  return (
    <MenuDesplegable
      etiqueta="Acciones de la plantación"
      items={items}
      disparador={(propsDisparador) => (
        <button type="button" className={styles.botonIcono} {...propsDisparador}>
          <MoreHorizontal size={TAMANO_ICONO.lg} aria-hidden />
        </button>
      )}
    />
  );
}

/** Las tres descargas de la barra, con el mensaje que devuelva cualquiera. */
function useDescargasDetalle(plantacion: Plantacion) {
  const kml = useDescargaKml(plantacion);
  const xlsx = useDescargaPlanilla(plantacion, descargarXlsxExportacion);
  const csv = useDescargaPlanilla(plantacion, descargarCsvExportacion);
  return { kml, xlsx, csv, mensaje: xlsx.mensaje ?? csv.mensaje ?? kml.mensaje };
}

/** Lado derecho de la barra: tabs, editar y exportación. El mensaje de
 *  "sin puntos"/"sin árboles" cuelga debajo del botón para no ensanchar la barra. */
function AccionesDetalle({
  plantacion,
  onEditar,
}: {
  plantacion: Plantacion;
  onEditar: () => void;
}) {
  const { kml, xlsx, csv, mensaje } = useDescargasDetalle(plantacion);
  const [generandoIds, setGenerandoIds] = useState(false);
  const plegado = useMediaQuery(BP.tablet);
  const { data: generados } = useQuery({
    queryKey: CLAVE_QUERY.idsGenerados(plantacion.id),
    queryFn: () => idsGenerados(plantacion.id),
  });

  const acciones: AccionesProps = {
    kml,
    xlsx,
    csv,
    idsPendientes: generados === false,
    onEditar,
    onGenerarIds: () => setGenerandoIds(true),
  };

  return (
    <div className={styles.acciones}>
      <TabNav
        variant="segmentada"
        label="Secciones de la plantación"
        tabs={tabsDePlantacion(plantacion.id)}
      />
      <Divisor />
      {plegado ? <AccionesPlegadas {...acciones} /> : <AccionesDesplegadas {...acciones} />}
      {mensaje && (
        <span className={styles.mensajeAccion} role="alert">
          {mensaje}
        </span>
      )}
      {generandoIds && (
        <GenerarIdsModal plantationId={plantacion.id} onClose={() => setGenerandoIds(false)} />
      )}
    </div>
  );
}

/** Lado izquierdo de la barra: el breadcrumb ES el título de la pantalla. */
function CabeceraPlantacion({ plantacion }: { plantacion: Plantacion }) {
  return (
    <CabeceraSeccion
      raiz="Plantaciones"
      raizA="/plantaciones"
      titulo={plantacion.lugar}
      meta={lineaMeta(plantacion)}
    >
      <EstadoPlantacionBadge estado={plantacion.estado} />
    </CabeceraSeccion>
  );
}

/** Shell del detalle: una sola barra con título, tabs y acciones; cada tab
 *  se renderiza en el Outlet y llena el alto restante. */
export function PlantacionDetailScreen() {
  const { id = '' } = useParams();
  const [editando, setEditando] = useState(false);
  const { data, isPending, isError, refetch } = usePlantacion(id);

  if (isPending) return <Cargando />;
  if (isError) {
    return (
      <ErrorConReintento
        mensaje="No se pudo cargar la plantación."
        onReintentar={() => void refetch()}
      />
    );
  }
  if (!data) return <PlantacionNoEncontrada />;
  return (
    <section className={styles.pantalla}>
      <Topbar
        densidad="compacta"
        left={<CabeceraPlantacion plantacion={data} />}
        right={<AccionesDetalle plantacion={data} onEditar={() => setEditando(true)} />}
      />
      <div className={styles.contenido}>
        <Outlet />
      </div>
      {editando && (
        <PlantacionFormModal plantacion={data} onClose={() => setEditando(false)} />
      )}
    </section>
  );
}
