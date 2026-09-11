import { useState } from 'react';
import { Link, Outlet, useParams } from 'react-router';
import { ChevronDown, Download, MoreHorizontal, Pencil, Plus } from 'lucide-react';
import {
  BotonIcono,
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
import { usePlantacion } from '../hooks/usePlantacion';
import { formatearFechaCorta } from '../lib/fechas';
import type { Plantacion } from '../queries/plantationQueries';
import { GenerarIdsModal } from './plantaciones/GenerarIdsModal';
import { useAccionesDetalle, type AccionesProps } from './useAccionesDetalle';
import { TAMANO_ICONO } from '../theme/iconos';
import styles from './PlantacionDetailScreen.module.css';

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

function MenuExportar(props: AccionesProps) {
  const descargando = props.kml.descargando || props.xlsx.descargando || props.csv.descargando;
  return (
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
  );
}

function BotonEditar({ onEditar }: { onEditar: () => void }) {
  return (
    <BotonIcono
      variante="contornoTransparente"
      tamano="sm"
      etiqueta="Editar"
      title="Editar"
      onClick={onEditar}
    >
      <Pencil size={TAMANO_ICONO.md} aria-hidden />
    </BotonIcono>
  );
}

function AccionesDesplegadas(props: AccionesProps) {
  return (
    <>
      <BotonEditar onEditar={props.onEditar} />
      <MenuExportar {...props} />
      {props.idsPendientes && (
        <Button variant="primary" size="sm" onClick={props.onGenerarIds}>
          <Plus size={TAMANO_ICONO.md} aria-hidden />
          Generar IDs
        </Button>
      )}
    </>
  );
}

function itemsPlegados(props: AccionesProps): ItemDesplegable[] {
  const items: ItemDesplegable[] = [
    { clave: 'editar', etiqueta: 'Editar plantación', onSeleccionar: props.onEditar },
    ...itemsExportar(props),
  ];
  if (props.idsPendientes) {
    items.push({ clave: 'ids', etiqueta: 'Generar IDs', onSeleccionar: props.onGenerarIds });
  }
  return items;
}

/** Barra angosta: las mismas acciones en un solo «⋯». Desplegadas se comen
 *  tres renglones de barra y empujan el contenido fuera del primer pantallazo.
 *  Como el «⋯» es el único acceso a esas acciones, va con el destino táctil
 *  completo. */
function AccionesPlegadas(props: AccionesProps) {
  return (
    <MenuDesplegable
      etiqueta="Acciones de la plantación"
      items={itemsPlegados(props)}
      disparador={({ 'aria-label': etiqueta, ...propsDisparador }) => (
        <BotonIcono
          variante="contornoTransparente"
          tamano="md"
          etiqueta={etiqueta}
          {...propsDisparador}
        >
          <MoreHorizontal size={TAMANO_ICONO.lg} aria-hidden />
        </BotonIcono>
      )}
    />
  );
}

interface AccionesDetalleProps {
  plantacion: Plantacion;
  onEditar: () => void;
}

/** Lado derecho de la barra. El mensaje de las descargas cuelga debajo del
 *  botón para no ensanchar la barra. */
function AccionesDetalle({ plantacion, onEditar }: AccionesDetalleProps) {
  const detalle = useAccionesDetalle(plantacion, onEditar);
  const Acciones = detalle.plegado ? AccionesPlegadas : AccionesDesplegadas;
  return (
    <div className={styles.acciones}>
      <TabNav label="Secciones de la plantación" tabs={tabsDePlantacion(plantacion.id)} />
      <Divisor />
      <Acciones {...detalle.acciones} />
      {detalle.mensaje && (
        <span className={styles.mensajeAccion} role="alert">
          {detalle.mensaje}
        </span>
      )}
      {detalle.generandoIds && (
        <GenerarIdsModal plantationId={plantacion.id} onClose={detalle.cerrarGenerarIds} />
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

/** Una sola barra con título, tabs y acciones; cada tab se renderiza en el
 *  Outlet y llena el alto restante. */
function DetallePlantacion({ plantacion }: { plantacion: Plantacion }) {
  const [editando, setEditando] = useState(false);
  return (
    <section>
      <Topbar
        densidad="compacta"
        left={<CabeceraPlantacion plantacion={plantacion} />}
        right={<AccionesDetalle plantacion={plantacion} onEditar={() => setEditando(true)} />}
      />
      <div className={styles.contenido}>
        <Outlet />
      </div>
      {editando && (
        <PlantacionFormModal plantacion={plantacion} onClose={() => setEditando(false)} />
      )}
    </section>
  );
}

export function PlantacionDetailScreen() {
  const { id = '' } = useParams();
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
  return <DetallePlantacion plantacion={data} />;
}
