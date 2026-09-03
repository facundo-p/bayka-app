import { useState } from 'react';
import { Link, Outlet, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Download, Pencil, Plus } from 'lucide-react';
import {
  Breadcrumb,
  Button,
  Cargando,
  EmptyState,
  ErrorConReintento,
  EstadoPlantacionBadge,
  PlantacionFormModal,
  TabNav,
  Topbar,
  type TabItem,
} from '../components';
import { useDescarga } from '../hooks/useDescarga';
import { formatearFechaCorta } from '../lib/fechas';
import { obtenerPlantacion, type Plantacion } from '../queries/plantationQueries';
import { idsGenerados } from '../queries/idsQueries';
import { listarPuntosGps } from '../queries/mapaQueries';
import { listarFilasExportacion } from '../queries/exportacionQueries';
import { construirKml, nombreArchivoKml, TIPO_MIME_KML } from '../services/exportarKml';
import { descargarTexto } from '../services/descargas';
import { descargarCsvExportacion } from '../services/exportarCsv';
import { descargarXlsxExportacion } from '../services/exportarXlsx';
import { GenerarIdsModal } from './plantaciones/GenerarIdsModal';
import styles from './PlantacionDetailScreen.module.css';

const MENSAJE_SIN_PUNTOS = 'Esta plantación no tiene puntos GPS para exportar.';
const MENSAJE_ERROR_KML = 'No se pudieron cargar los puntos GPS.';
const MENSAJE_SIN_ARBOLES = 'Esta plantación no tiene árboles para exportar.';
const MENSAJE_ERROR_EXPORT = 'No se pudieron cargar los árboles para exportar.';

const TAMANO_ICONO = 16;

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

type DescargaPlanilla = ReturnType<typeof useDescargaPlanilla>;

/** "Generar IDs" abre el modal de confirmación (issue #232: la generación es
 *  exclusiva de la web, server-side vía RPC transaccional). */
function BotonGenerarIds({ plantationId }: { plantationId: string }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setAbierto(true)}>
        <Plus size={TAMANO_ICONO} />
        Generar IDs
      </Button>
      {abierto && <GenerarIdsModal plantationId={plantationId} onClose={() => setAbierto(false)} />}
    </>
  );
}

/** Botones de exportación de la planilla, uno por formato (XLSX nativo y CSV). */
function BotonesExportar({ xlsx, csv }: { xlsx: DescargaPlanilla; csv: DescargaPlanilla }) {
  return (
    <>
      <Button variant="secondary" onClick={() => void xlsx.descargar()} loading={xlsx.descargando}>
        <Download size={TAMANO_ICONO} />
        Exportar Excel
      </Button>
      <Button variant="secondary" onClick={() => void csv.descargar()} loading={csv.descargando}>
        <Download size={TAMANO_ICONO} />
        Exportar CSV
      </Button>
    </>
  );
}

/** Estado de IDs: "Generar IDs" hasta generarlos, los botones de exportación
 *  (XLSX/CSV) después. */
function BotonEstadoIds({
  plantationId,
  xlsx,
  csv,
}: {
  plantationId: string;
  xlsx: DescargaPlanilla;
  csv: DescargaPlanilla;
}) {
  const { data: generados } = useQuery({
    queryKey: ['ids-generados', plantationId],
    queryFn: () => idsGenerados(plantationId),
  });
  if (generados === undefined) return null;
  return generados ? (
    <BotonesExportar xlsx={xlsx} csv={csv} />
  ) : (
    <BotonGenerarIds plantationId={plantationId} />
  );
}

/** Acciones de la topbar: descarga de KML (siempre visible) + botón de estado
 *  de IDs. El mensaje inline cubre "sin puntos GPS" y "sin árboles". */
function AccionesDetalle({ plantacion }: { plantacion: Plantacion }) {
  const kml = useDescargaKml(plantacion);
  const xlsx = useDescargaPlanilla(plantacion, descargarXlsxExportacion);
  const csv = useDescargaPlanilla(plantacion, descargarCsvExportacion);
  const mensaje = xlsx.mensaje ?? csv.mensaje ?? kml.mensaje;
  return (
    <div className={styles.acciones}>
      {mensaje && (
        <span className={styles.mensajeAccion} role="alert">
          {mensaje}
        </span>
      )}
      <Button variant="secondary" onClick={() => void kml.descargar()} loading={kml.descargando}>
        <Download size={TAMANO_ICONO} />
        Descargar KML
      </Button>
      <BotonEstadoIds plantationId={plantacion.id} xlsx={xlsx} csv={csv} />
    </div>
  );
}

function BloqueTitulo({ plantacion, onEditar }: { plantacion: Plantacion; onEditar: () => void }) {
  return (
    <div className={styles.titulo}>
      <div className={styles.encabezadoFila}>
        <EstadoPlantacionBadge estado={plantacion.estado} />
        <h1 className={styles.lugar}>{plantacion.lugar}</h1>
        <button type="button" className={styles.editar} onClick={onEditar}>
          <Pencil size={TAMANO_ICONO} aria-hidden />
          Editar
        </button>
      </div>
      <p className={styles.meta}>{lineaMeta(plantacion)}</p>
    </div>
  );
}

/** Shell del detalle: topbar + título + tabs; cada tab se renderiza en el Outlet. */
export function PlantacionDetailScreen() {
  const { id = '' } = useParams();
  const [editando, setEditando] = useState(false);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['plantacion', id],
    queryFn: () => obtenerPlantacion(id),
  });

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
    <section>
      <Topbar
        left={
          <Breadcrumb
            items={[{ label: 'Plantaciones', to: '/plantaciones' }, { label: data.lugar }]}
          />
        }
        right={<AccionesDetalle plantacion={data} />}
      />
      <BloqueTitulo plantacion={data} onEditar={() => setEditando(true)} />
      <div className={styles.tabs}>
        <TabNav label="Secciones de la plantación" tabs={tabsDePlantacion(data.id)} />
      </div>
      <div className={styles.contenido}>
        <Outlet />
      </div>
      {editando && (
        <PlantacionFormModal plantacion={data} onClose={() => setEditando(false)} />
      )}
    </section>
  );
}
