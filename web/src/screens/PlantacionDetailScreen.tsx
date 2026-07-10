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
import { formatearFechaCorta } from '../lib/fechas';
import { obtenerPlantacion, type Plantacion } from '../queries/plantationQueries';
import { idsGenerados } from '../queries/idsQueries';
import { listarPuntosGps } from '../queries/mapaQueries';
import {
  construirKml,
  descargarTexto,
  nombreArchivoKml,
  TIPO_MIME_KML,
} from '../services/exportarKml';
import styles from './PlantacionDetailScreen.module.css';

const MENSAJE_SIN_PUNTOS = 'Esta plantación no tiene puntos GPS para exportar.';
const MENSAJE_ERROR_KML = 'No se pudieron cargar los puntos GPS.';

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

/** Línea de metadatos: período · superficie (si hay) · fecha de creación. */
function lineaMeta(plantacion: Plantacion): string {
  const partes = [plantacion.periodo];
  if (plantacion.superficieHa != null) partes.push(`${plantacion.superficieHa} ha`);
  partes.push(`Creada ${formatearFechaCorta(plantacion.createdAt)}`);
  return partes.join(' · ');
}

/**
 * Descarga los puntos GPS de la plantación como KML (Google Maps/Earth):
 * carga los puntos, arma el XML y dispara la descarga. Expone estado de carga
 * y un mensaje para el caso "sin puntos" (no se descarga un archivo vacío).
 */
function useDescargaKml(plantacion: Plantacion) {
  const [descargando, setDescargando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  async function descargar() {
    setMensaje(null);
    setDescargando(true);
    try {
      const puntos = await listarPuntosGps(plantacion.id);
      if (puntos.length === 0) return setMensaje(MENSAJE_SIN_PUNTOS);
      const nombreDocumento = `Puntos GPS – ${plantacion.lugar} (${plantacion.periodo})`;
      const kml = construirKml(puntos, { nombreDocumento });
      descargarTexto(kml, nombreArchivoKml(plantacion.lugar, plantacion.periodo), TIPO_MIME_KML);
    } catch {
      setMensaje(MENSAJE_ERROR_KML);
    } finally {
      setDescargando(false);
    }
  }
  return { descargar, descargando, mensaje };
}

/** Botón de estado de IDs (regla de mobile): "Generar IDs" hasta generarlos,
 *  "Exportar" después. Ambos sin backend web todavía (no-op). */
function BotonEstadoIds({ plantationId }: { plantationId: string }) {
  const { data: generados } = useQuery({
    queryKey: ['ids-generados', plantationId],
    queryFn: () => idsGenerados(plantationId),
  });
  if (generados === undefined) return null;
  return generados ? (
    <Button variant="secondary" onClick={() => {}}>
      Exportar
    </Button>
  ) : (
    <Button variant="primary" onClick={() => {}}>
      <Plus size={TAMANO_ICONO} />
      Generar IDs
    </Button>
  );
}

/** Acciones de la topbar: descarga de KML (siempre visible) + botón de estado
 *  de IDs. El mensaje inline cubre el caso "sin puntos GPS". */
function AccionesDetalle({ plantacion }: { plantacion: Plantacion }) {
  const { descargar, descargando, mensaje } = useDescargaKml(plantacion);
  return (
    <div className={styles.acciones}>
      {mensaje && (
        <span className={styles.mensajeAccion} role="alert">
          {mensaje}
        </span>
      )}
      <Button variant="secondary" onClick={() => void descargar()} loading={descargando}>
        <Download size={TAMANO_ICONO} />
        Descargar KML
      </Button>
      <BotonEstadoIds plantationId={plantacion.id} />
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
